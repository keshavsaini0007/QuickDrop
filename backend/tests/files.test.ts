import os from 'node:os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.mock('../src/config/cloudinary', () => ({
  assertCloudinaryConfigured: jest.fn(),
  cloudinaryConfigured: true,
  cloudinary: {},
  checkCloudinaryConnection: jest.fn(),
}));

jest.mock('../src/utils/cloudinaryAssets', () => ({
  buildPrivateDownloadUrl: jest.fn(() => ({
    url: 'https://example.test/private-download',
    expiresAt: new Date(Date.now() + 300000),
  })),
  buildThumbnailUrl: jest.fn(() => null),
  createUploadSignature: jest.fn(),
  verifyUploadedAsset: jest.fn(),
  deleteCloudinaryAsset: jest.fn(),
}));

import { createApp } from '../src/app';
import { UserModel } from '../src/modules/users/user.model';
import { FolderModel } from '../src/modules/folders/folder.model';
import { FileModel } from '../src/modules/files/file.model';
import { ShareModel } from '../src/modules/shares/share.model';
import { UploadSessionModel } from '../src/modules/files/uploadSession.model';
import {
  createUploadSignature,
  deleteCloudinaryAsset,
  verifyUploadedAsset,
} from '../src/utils/cloudinaryAssets';

const app = createApp();
let mongo: MongoMemoryServer;

async function clearCollections(): Promise<void> {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function registerUser(email = `user-${Date.now()}-${Math.random()}@example.com`) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'File Owner', email, password: 'TestPass123' });
  return {
    accessToken: response.body.data.accessToken as string,
    refreshToken: response.body.data.refreshToken as string,
    email,
    userId: response.body.data.user.id as string,
  };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function uploadFile(
  token: string,
  overrides: Partial<{ fileName: string; mimeType: string; sizeBytes: number; folderId: string }> = {},
) {
  const sign = await request(app)
    .post('/api/files/upload/sign')
    .set(auth(token))
    .send({
      fileName: overrides.fileName ?? 'photo.jpg',
      mimeType: overrides.mimeType ?? 'image/jpeg',
      sizeBytes: overrides.sizeBytes ?? 1000,
      ...(overrides.folderId ? { folderId: overrides.folderId } : {}),
    });

  const publicId = sign.body.data?.params?.public_id as string | undefined;
  if (sign.status === 201 && publicId) {
    (verifyUploadedAsset as jest.Mock).mockResolvedValue({
      publicId,
      resourceType: 'image',
      format: 'jpg',
      version: 1,
      bytes: overrides.sizeBytes ?? 1000,
      etag: 'mock-etag',
      width: 100,
      height: 100,
    });
    const confirm = await request(app)
      .post(`/api/files/upload/${sign.body.data.sessionId}/confirm`)
      .set(auth(token))
      .send({});
    return { sign, confirm, publicId };
  }

  return { sign, confirm: sign, publicId };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    runtimeAdapters: { os },
  } as mongoose.ConnectOptions);
  await Promise.all([
    UserModel.init(),
    FolderModel.init(),
    FileModel.init(),
    ShareModel.init(),
    UploadSessionModel.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await clearCollections();
  (createUploadSignature as jest.Mock).mockImplementation(({ publicId }: { publicId: string }) => ({
    uploadUrl: 'https://api.cloudinary.test/upload',
    params: {
      public_id: publicId,
      timestamp: 123456,
      signature: 'mock-signature',
      api_key: 'mock-key',
    },
  }));
  (verifyUploadedAsset as jest.Mock).mockReset();
  (deleteCloudinaryAsset as jest.Mock).mockResolvedValue(undefined);
});

describe('files', () => {
  it('uploads, lists, previews, renames, favorites, moves, trashes, restores and deletes a file', async () => {
    const { accessToken, userId } = await registerUser();
    const folder = await request(app)
      .post('/api/folders')
      .set(auth(accessToken))
      .send({ name: 'Photos' });
    expect(folder.status).toBe(201);

    const uploaded = await uploadFile(accessToken, {
      folderId: folder.body.data.id,
      fileName: 'holiday.jpg',
      sizeBytes: 2048,
    });
    expect(uploaded.sign.status).toBe(201);
    expect(uploaded.confirm.status).toBe(201);
    expect(uploaded.confirm.body.data.name).toBe('holiday.jpg');
    expect(uploaded.confirm.body.data.folderId).toBe(folder.body.data.id);
    const fileId = uploaded.confirm.body.data.id as string;

    const me = await request(app).get('/api/users/me').set(auth(accessToken));
    expect(me.body.data.storageUsedBytes).toBe(2048);

    const list = await request(app)
      .get(`/api/files?folderId=${folder.body.data.id}`)
      .set(auth(accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(fileId);

    const preview = await request(app)
      .get(`/api/files/${fileId}/preview`)
      .set(auth(accessToken));
    expect(preview.status).toBe(200);
    expect(preview.body.data.url).toBe('https://example.test/private-download');

    const download = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set(auth(accessToken));
    expect(download.status).toBe(200);
    expect(download.body.data.file.downloadCount).toBe(1);

    const renamed = await request(app)
      .patch(`/api/files/${fileId}`)
      .set(auth(accessToken))
      .send({ name: 'holiday-2026.jpg' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('holiday-2026.jpg');

    const favorite = await request(app)
      .patch(`/api/files/${fileId}/favorite`)
      .set(auth(accessToken))
      .send({ isFavorite: true });
    expect(favorite.status).toBe(200);
    expect(favorite.body.data.isFavorite).toBe(true);

    const root = await request(app)
      .patch(`/api/files/${fileId}/move`)
      .set(auth(accessToken))
      .send({ folderId: null });
    expect(root.status).toBe(200);
    expect(root.body.data.folderId).toBeNull();

    const trashed = await request(app)
      .delete(`/api/files/${fileId}`)
      .set(auth(accessToken));
    expect(trashed.status).toBe(200);
    expect(trashed.body.data.deletedAt).toEqual(expect.any(String));

    const trash = await request(app).get('/api/trash').set(auth(accessToken));
    expect(trash.status).toBe(200);
    expect(trash.body.data.totals.files).toBe(1);
    expect(trash.body.data.files[0].id).toBe(fileId);

    const restored = await request(app)
      .post(`/api/files/${fileId}/restore`)
      .set(auth(accessToken));
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeUndefined();

    await request(app).delete(`/api/files/${fileId}`).set(auth(accessToken));
    const deleted = await request(app)
      .delete(`/api/files/${fileId}/permanent`)
      .set(auth(accessToken));
    expect(deleted.status).toBe(200);
    expect(deleteCloudinaryAsset).toHaveBeenCalledTimes(1);

    const after = await request(app).get('/api/users/me').set(auth(accessToken));
    expect(after.body.data.storageUsedBytes).toBe(0);
    expect(after.body.data.id).toBe(userId);
  });

  it('serializes concurrent confirmations without deleting the uploaded asset', async () => {
    const { accessToken } = await registerUser();
    const sign = await request(app)
      .post('/api/files/upload/sign')
      .set(auth(accessToken))
      .send({ fileName: 'race.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 });
    expect(sign.status).toBe(201);
    const publicId = sign.body.data.params.public_id as string;

    (verifyUploadedAsset as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                publicId,
                resourceType: 'image',
                format: 'jpg',
                version: 1,
                bytes: 1000,
              }),
            100,
          ),
        ),
    );

    const confirm = () =>
      request(app)
        .post(`/api/files/upload/${sign.body.data.sessionId}/confirm`)
        .set(auth(accessToken))
        .send({});

    const [first, second] = await Promise.all([confirm(), confirm()]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await FileModel.countDocuments({})).toBe(1);
    expect(deleteCloudinaryAsset).not.toHaveBeenCalled();
    const session = await UploadSessionModel.findById(sign.body.data.sessionId);
    expect(session?.status).toBe('completed');
  });

  it('rejects unsupported types and enforces the per-type size limit', async () => {
    const { accessToken } = await registerUser();
    const unsupported = await request(app)
      .post('/api/files/upload/sign')
      .set(auth(accessToken))
      .send({ fileName: 'script.exe', mimeType: 'application/x-msdownload', sizeBytes: 100 });
    expect(unsupported.status).toBe(400);

    const tooLarge = await request(app)
      .post('/api/files/upload/sign')
      .set(auth(accessToken))
      .send({ fileName: 'huge.jpg', mimeType: 'image/jpeg', sizeBytes: 26 * 1024 * 1024 });
    expect(tooLarge.status).toBe(413);
  });

  it('rejects a duplicate name in the same folder', async () => {
    const { accessToken } = await registerUser();
    await uploadFile(accessToken, { fileName: 'same.jpg' });
    const duplicate = await request(app)
      .post('/api/files/upload/sign')
      .set(auth(accessToken))
      .send({ fileName: 'same.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('NAME_CONFLICT');
  });

  it('rejects a storage reservation that exceeds the quota', async () => {
    const { accessToken, userId } = await registerUser();
    await UserModel.updateOne({ _id: userId }, { $set: { storageLimitBytes: 500 } });
    const result = await request(app)
      .post('/api/files/upload/sign')
      .set(auth(accessToken))
      .send({ fileName: 'big.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 });
    expect(result.status).toBe(413);
    expect(result.body.code).toBe('STORAGE_QUOTA_EXCEEDED');
  });
});

describe('folders', () => {
  it('creates nested folders, moves files, trashes and restores a subtree', async () => {
    const { accessToken } = await registerUser();
    const parent = await request(app)
      .post('/api/folders')
      .set(auth(accessToken))
      .send({ name: 'Parent' });
    const child = await request(app)
      .post('/api/folders')
      .set(auth(accessToken))
      .send({ name: 'Child', parentId: parent.body.data.id });
    expect(child.status).toBe(201);

    const uploaded = await uploadFile(accessToken, {
      folderId: child.body.data.id,
      fileName: 'inside.jpg',
    });
    expect(uploaded.confirm.status).toBe(201);

    const folderDetails = await request(app)
      .get(`/api/folders/${child.body.data.id}`)
      .set(auth(accessToken));
    expect(folderDetails.status).toBe(200);
    expect(folderDetails.body.data.breadcrumbs).toEqual([
      { id: parent.body.data.id, name: 'Parent' },
      { id: child.body.data.id, name: 'Child' },
    ]);

    const trashed = await request(app)
      .delete(`/api/folders/${parent.body.data.id}`)
      .set(auth(accessToken));
    expect(trashed.status).toBe(200);

    const trash = await request(app).get('/api/trash').set(auth(accessToken));
    expect(trash.body.data.totals.folders).toBe(2);
    expect(trash.body.data.totals.files).toBe(1);

    const restored = await request(app)
      .post(`/api/folders/${parent.body.data.id}/restore`)
      .set(auth(accessToken));
    expect(restored.status).toBe(200);

    const list = await request(app)
      .get(`/api/files?folderId=${child.body.data.id}`)
      .set(auth(accessToken));
    expect(list.body.data).toHaveLength(1);
  });

  it('permanently deletes a trashed folder tree including deleted descendants and files', async () => {
    const { accessToken } = await registerUser();
    const parent = await request(app)
      .post('/api/folders')
      .set(auth(accessToken))
      .send({ name: 'Tree root' });
    const child = await request(app)
      .post('/api/folders')
      .set(auth(accessToken))
      .send({ name: 'Tree child', parentId: parent.body.data.id });
    const uploaded = await uploadFile(accessToken, {
      folderId: child.body.data.id,
      fileName: 'tree-file.jpg',
      sizeBytes: 2048,
    });
    expect(uploaded.confirm.status).toBe(201);

    const trashed = await request(app)
      .delete(`/api/folders/${parent.body.data.id}`)
      .set(auth(accessToken));
    expect(trashed.status).toBe(200);

    const deleted = await request(app)
      .delete(`/api/folders/${parent.body.data.id}/permanent`)
      .set(auth(accessToken));
    expect(deleted.status).toBe(200);

    const trash = await request(app).get('/api/trash').set(auth(accessToken));
    expect(trash.body.data.totals).toEqual({ files: 0, folders: 0, items: 0 });
    const folders = await request(app).get('/api/folders').set(auth(accessToken));
    expect(folders.body.data).toHaveLength(0);
    const me = await request(app).get('/api/users/me').set(auth(accessToken));
    expect(me.body.data.storageUsedBytes).toBe(0);
    expect(await FileModel.countDocuments({})).toBe(0);
  });

  it('prevents moving a folder into itself or its descendant', async () => {
    const { accessToken } = await registerUser();
    const parent = await request(app)
      .post('/api/folders')
      .set(auth(accessToken))
      .send({ name: 'Parent' });
    const child = await request(app)
      .post('/api/folders')
      .set(auth(accessToken))
      .send({ name: 'Child', parentId: parent.body.data.id });

    const intoSelf = await request(app)
      .patch(`/api/folders/${parent.body.data.id}`)
      .set(auth(accessToken))
      .send({ parentId: parent.body.data.id });
    expect(intoSelf.status).toBe(400);

    const intoChild = await request(app)
      .patch(`/api/folders/${parent.body.data.id}`)
      .set(auth(accessToken))
      .send({ parentId: child.body.data.id });
    expect(intoChild.status).toBe(400);
  });
});

describe('shares', () => {
  it('creates, unlocks, downloads and revokes a password-protected share', async () => {
    const { accessToken } = await registerUser();
    const uploaded = await uploadFile(accessToken, { fileName: 'shared.jpg' });
    const fileId = uploaded.confirm.body.data.id as string;

    const created = await request(app)
      .post('/api/shares')
      .set(auth(accessToken))
      .send({ fileId, password: 'SharePass123', maxDownloads: 2, expiresInDays: 2 });
    expect(created.status).toBe(201);
    expect(created.body.data.url).toContain('/s/');
    const token = created.body.data.token as string;

    const publicInfo = await request(app).get(`/api/public/shares/${token}`);
    expect(publicInfo.status).toBe(200);
    expect(publicInfo.body.data.share.hasPassword).toBe(true);
    expect(publicInfo.body.data.file.name).toBe('shared.jpg');

    const noPassword = await request(app)
      .post(`/api/public/shares/${token}/access`)
      .send({});
    expect(noPassword.status).toBe(401);
    expect(noPassword.body.code).toBe('SHARE_PASSWORD_REQUIRED');

    const wrongPassword = await request(app)
      .post(`/api/public/shares/${token}/access`)
      .send({ password: 'WrongPass123' });
    expect(wrongPassword.status).toBe(401);

    const unlocked = await request(app)
      .post(`/api/public/shares/${token}/access`)
      .send({ password: 'SharePass123' });
    expect(unlocked.status).toBe(200);
    const accessTokenValue = unlocked.body.data.accessToken as string;

    const download = await request(app)
      .get(`/api/public/shares/${token}/download`)
      .set('X-Share-Access-Token', accessTokenValue);
    expect(download.status).toBe(200);
    expect(download.body.data.url).toBe('https://example.test/private-download');
    expect(download.body.data.share.downloadCount).toBe(1);

    const list = await request(app).get('/api/shares').set(auth(accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].hasPassword).toBe(true);

    const revoked = await request(app)
      .delete(`/api/shares/${created.body.data.share.id}`)
      .set(auth(accessToken));
    expect(revoked.status).toBe(200);

    const afterRevoke = await request(app).get(`/api/public/shares/${token}`);
    expect(afterRevoke.status).toBe(410);
    expect(afterRevoke.body.code).toBe('SHARE_REVOKED');
  });

  it('regenerates a link so the old token stops working', async () => {
    const { accessToken } = await registerUser();
    const uploaded = await uploadFile(accessToken, { fileName: 'regen.jpg' });
    const created = await request(app)
      .post('/api/shares')
      .set(auth(accessToken))
      .send({ fileId: uploaded.confirm.body.data.id });
    const oldToken = created.body.data.token as string;

    const regenerated = await request(app)
      .post(`/api/shares/${created.body.data.share.id}/regenerate`)
      .set(auth(accessToken))
      .send({});
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.token).not.toBe(oldToken);

    const old = await request(app).get(`/api/public/shares/${oldToken}`);
    expect(old.status).toBe(404);
    const current = await request(app).get(`/api/public/shares/${regenerated.body.data.token}`);
    expect(current.status).toBe(200);
  });

  it('serves a public HTML share page and rejects a missing password', async () => {
    const { accessToken } = await registerUser();
    const uploaded = await uploadFile(accessToken, { fileName: 'web-share.jpg' });
    const created = await request(app)
      .post('/api/shares')
      .set(auth(accessToken))
      .send({ fileId: uploaded.confirm.body.data.id, password: 'WebPass123' });
    const token = created.body.data.token as string;

    const page = await request(app).get(`/s/${token}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('web-share.jpg');
    expect(page.text).toContain('This link is password protected');

    const badUnlock = await request(app)
      .post(`/s/${token}/unlock`)
      .type('form')
      .send({ password: 'wrong' });
    expect(badUnlock.status).toBe(401);

    const unlock = await request(app)
      .post(`/s/${token}/unlock`)
      .type('form')
      .send({ password: 'WebPass123' });
    expect(unlock.status).toBe(303);
    expect(unlock.headers['set-cookie']?.[0]).toContain('qd_share_access=');
  });
});

describe('storage and activity', () => {
  it('returns storage breakdown and activity history', async () => {
    const { accessToken } = await registerUser();
    await uploadFile(accessToken, { fileName: 'activity.jpg', sizeBytes: 4096 });

    const storage = await request(app).get('/api/storage').set(auth(accessToken));
    expect(storage.status).toBe(200);
    expect(storage.body.data.summary.usedBytes).toBe(4096);
    expect(storage.body.data.summary.byMedia.image.bytes).toBe(4096);
    expect(storage.body.data.recentFiles).toHaveLength(1);

    const activity = await request(app).get('/api/activities').set(auth(accessToken));
    expect(activity.status).toBe(200);
    expect(activity.body.data.some((item: { type: string }) => item.type === 'file_uploaded')).toBe(
      true,
    );
  });
});
