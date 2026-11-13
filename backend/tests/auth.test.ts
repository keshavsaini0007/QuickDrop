import os from 'node:os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/modules/users/user.model';

const app = createApp();
let mongo: MongoMemoryServer;

async function clearCollections(): Promise<void> {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function registerUser(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  const email = overrides.email ?? `user-${Date.now()}-${Math.random()}@example.com`;
  const password = overrides.password ?? 'TestPass123';
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: overrides.name ?? 'Test User', email, password });

  return { response, email, password };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    runtimeAdapters: { os },
  } as mongoose.ConnectOptions);
  await UserModel.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await clearCollections();
});

describe('authentication', () => {
  it('registers a user and returns a token pair without password data', async () => {
    const { response } = await registerUser();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toContain('@example.com');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('rejects duplicate email addresses', async () => {
    const email = 'duplicate@example.com';
    await registerUser({ email });
    const second = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Another User', email, password: 'TestPass123' });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects unknown fields and weak passwords', async () => {
    const unknownField = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'unknown@example.com', password: 'TestPass123', role: 'admin' });
    expect(unknownField.status).toBe(400);
    expect(unknownField.body.code).toBe('VALIDATION_ERROR');

    const weak = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'weak@example.com', password: 'password' });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe('VALIDATION_ERROR');
  });

  it('logs in, reads the profile, and rejects a wrong password', async () => {
    const { email, password } = await registerUser();

    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'WrongPass123' });
    expect(wrong.status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const anonymous = await request(app).get('/api/users/me');
    expect(anonymous.status).toBe(401);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const { response } = await registerUser();
    const originalRefresh = response.body.data.refreshToken;

    const rotated = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });
    expect(rotated.status).toBe(200);
    const nextRefresh = rotated.body.data.refreshToken;
    expect(nextRefresh).not.toBe(originalRefresh);

    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');

    const revokedFamily = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: nextRefresh });
    expect(revokedFamily.status).toBe(401);
  });

  it('logs out and rejects the revoked refresh token', async () => {
    const { response } = await registerUser();
    const refreshToken = response.body.data.refreshToken;

    const logout = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(200);

    const afterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('resets a password and invalidates old access tokens', async () => {
    const { response, email } = await registerUser();
    const oldAccessToken = response.body.data.accessToken;

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.data.resetToken).toEqual(expect.any(String));

    const reset = await request(app).post('/api/auth/reset-password').send({
      token: forgot.body.data.resetToken,
      password: 'NewTestPass456',
    });
    expect(reset.status).toBe(200);

    const oldAccess = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    expect(oldAccess.status).toBe(401);

    const oldPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'TestPass123' });
    expect(oldPassword.status).toBe(401);

    const newPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewTestPass456' });
    expect(newPassword.status).toBe(200);
  });

  it('updates a profile and changes a password while revoking other sessions', async () => {
    const { response, password } = await registerUser();
    const accessToken = response.body.data.accessToken;

    const update = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' });
    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe('Updated Name');

    const changed = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: password, newPassword: 'ChangedPass789' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.accessToken).toEqual(expect.any(String));

    const oldAccess = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(oldAccess.status).toBe(401);

    const newAccess = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${changed.body.data.accessToken}`);
    expect(newAccess.status).toBe(200);
  });

  it('logs out all sessions', async () => {
    const { response } = await registerUser();
    const accessToken = response.body.data.accessToken;

    const logoutAll = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutAll.status).toBe(200);

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });
});
