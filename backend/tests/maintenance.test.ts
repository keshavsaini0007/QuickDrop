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
import { FileModel } from '../src/modules/files/file.model';
import { FolderModel } from '../src/modules/folders/folder.model';
import { UploadSessionModel } from '../src/modules/files/uploadSession.model';
import {
  expireUploadSessions,
  pruneUploadSessions,
  purgeExpiredTrash,
  reconcileStorage,
} from '../src/jobs/maintenance.jobs';
import {
  createUploadSignature,
  deleteCloudinaryAsset,
} from '../src/utils/cloudinaryAssets';

const app = createApp();
let mongo: MongoMemoryServer;

async function clearCollections(): Promise<void> {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function registerUser(email = `maintenance-${Date.now()}-${Math.random()}@example.com`) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Maintenance Owner', email, password: 'TestPass123' });
  const userId = response.body.data.user.id as string;
  const accessToken = response.body.data.accessToken as string;
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('Test user was not created.');
  return { userId, user, accessToken };
}

function oldDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    runtimeAdapters: { os },
  } as mongoose.ConnectOptions);
  await Promise.all([
    UserModel.init(),
    FileModel.init(),
    FolderModel.init(),
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
  (deleteCloudinaryAsset as jest.Mock).mockReset();
  (deleteCloudinaryAsset as jest.Mock).mockResolvedValue(undefined);
});

describe('maintenance jobs', () => {
  it('expires abandoned upload sessions and releases their reservation', async () => {
    const { userId, accessToken } = await registerUser();
    const sign = await request(app)
      .post('/api/files/upload/sign')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ fileName: 'abandoned.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 });

    expect(sign.status).toBe(201);
    const sessionId = sign.body.data.sessionId as string;
    const publicId = sign.body.data.params.public_id as string;
    await UploadSessionModel.updateOne(
      { _id: sessionId },
      { $set: { expiresAt: new Date(Date.now() - 10 * 60 * 1000) } },
    );

    const before = await UserModel.findById(userId);
    expect(before?.storageUsedBytes).toBe(1024);

    const result = await expireUploadSessions(new Date());

    expect(result.expired).toBe(1);
    expect(result.releasedBytes).toBe(1024);
    expect(deleteCloudinaryAsset).toHaveBeenCalledWith(publicId, 'image');
    const session = await UploadSessionModel.findById(sessionId);
    expect(session?.status).toBe('expired');
    const after = await UserModel.findById(userId);
    expect(after?.storageUsedBytes).toBe(0);
  });

  it('repairs a session whose file record exists instead of releasing quota twice', async () => {
    const { userId, accessToken } = await registerUser();
    const sign = await request(app)
      .post('/api/files/upload/sign')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ fileName: 'recovered.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 });
    const publicId = sign.body.data.params.public_id as string;
    const sessionId = sign.body.data.sessionId as string;

    const file = await FileModel.create({
      owner: userId,
      folder: null,
      parentKey: 'root',
      name: 'recovered.jpg',
      nameKey: 'recovered.jpg',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      mediaType: 'image',
      sizeBytes: 2048,
      cloudinaryPublicId: publicId,
      cloudinaryResourceType: 'image',
      deliveryType: 'authenticated',
      isFavorite: false,
      downloadCount: 0,
    });
    await UploadSessionModel.updateOne(
      { _id: sessionId },
      { $set: { expiresAt: new Date(Date.now() - 10 * 60 * 1000) } },
    );

    const result = await expireUploadSessions(new Date());

    expect(result.recovered).toBe(1);
    expect(result.expired).toBe(0);
    expect(deleteCloudinaryAsset).not.toHaveBeenCalled();
    const session = await UploadSessionModel.findById(sessionId);
    expect(session?.status).toBe('completed');
    expect(String(session?.file)).toBe(String(file._id));
    const after = await UserModel.findById(userId);
    expect(after?.storageUsedBytes).toBe(2048);
  });

  it('purges recycle-bin files and folders past retention and releases storage', async () => {
    const { userId } = await registerUser();
    const folder = await FolderModel.create({
      owner: userId,
      parent: null,
      parentKey: 'root',
      name: 'Old folder',
      nameKey: 'old folder',
      deletedAt: oldDate(60),
    });
    const file = await FileModel.create({
      owner: userId,
      folder: folder._id,
      parentKey: folder.id,
      name: 'old.txt',
      nameKey: 'old.txt',
      extension: 'txt',
      mimeType: 'text/plain',
      mediaType: 'document',
      sizeBytes: 4096,
      cloudinaryPublicId: 'quickdrop/test/old',
      cloudinaryResourceType: 'raw',
      deliveryType: 'authenticated',
      isFavorite: false,
      downloadCount: 0,
      deletedAt: oldDate(60),
    });
    await UserModel.updateOne({ _id: userId }, { $set: { storageUsedBytes: 4096 } });

    const result = await purgeExpiredTrash(new Date());

    expect(result.foldersDeleted).toBe(1);
    expect(result.failures).toBe(0);
    expect(await FileModel.findById(file._id)).toBeNull();
    expect(await FolderModel.findById(folder._id)).toBeNull();
    const after = await UserModel.findById(userId);
    expect(after?.storageUsedBytes).toBe(0);
  });

  it('reconciles drifted counters from files plus all unreleased reservations', async () => {
    const { userId, accessToken } = await registerUser();

    await FileModel.create({
      owner: userId,
      folder: null,
      parentKey: 'root',
      name: 'kept.txt',
      nameKey: 'kept.txt',
      extension: 'txt',
      mimeType: 'text/plain',
      mediaType: 'document',
      sizeBytes: 1200,
      cloudinaryPublicId: 'quickdrop/test/kept',
      cloudinaryResourceType: 'raw',
      deliveryType: 'authenticated',
      isFavorite: false,
      downloadCount: 0,
    });
    const sign = await request(app)
      .post('/api/files/upload/sign')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ fileName: 'pending.txt', mimeType: 'text/plain', sizeBytes: 300 });
    expect(sign.status).toBe(201);
    await UserModel.updateOne({ _id: userId }, { $set: { storageUsedBytes: 99999 } });

    const result = await reconcileStorage(new Date());

    expect(result.usersAdjusted).toBe(1);
    const after = await UserModel.findById(userId);
    expect(after?.storageUsedBytes).toBe(1500);
  });

  it('keeps a reservation that is inside the expiry grace period', async () => {
    const { userId, accessToken } = await registerUser();
    const sign = await request(app)
      .post('/api/files/upload/sign')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ fileName: 'grace.txt', mimeType: 'text/plain', sizeBytes: 300 });
    expect(sign.status).toBe(201);
    await UploadSessionModel.updateOne(
      { _id: sign.body.data.sessionId },
      { $set: { expiresAt: new Date(Date.now() - 60 * 1000) } },
    );
    await UserModel.updateOne({ _id: userId }, { $set: { storageUsedBytes: 0 } });

    await reconcileStorage(new Date());

    const after = await UserModel.findById(userId);
    expect(after?.storageUsedBytes).toBe(300);
  });

  it('expires a stuck confirming session and releases its reservation once', async () => {
    const { userId, accessToken } = await registerUser();
    const sign = await request(app)
      .post('/api/files/upload/sign')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ fileName: 'stuck.txt', mimeType: 'text/plain', sizeBytes: 512 });
    expect(sign.status).toBe(201);
    await UploadSessionModel.updateOne(
      { _id: sign.body.data.sessionId },
      {
        $set: {
          status: 'confirming',
          expiresAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
    );

    const result = await expireUploadSessions(new Date());

    expect(result.expired).toBe(1);
    const session = await UploadSessionModel.findById(sign.body.data.sessionId);
    expect(session?.status).toBe('expired');
    const after = await UserModel.findById(userId);
    expect(after?.storageUsedBytes).toBe(0);
  });

  it('prunes only terminal upload sessions past retention', async () => {
    const { userId } = await registerUser();
    const completed = await UploadSessionModel.create({
      owner: userId,
      folder: null,
      parentKey: 'root',
      fileName: 'done.txt',
      nameKey: 'done.txt',
      extension: 'txt',
      mimeType: 'text/plain',
      mediaType: 'document',
      sizeBytes: 10,
      reservedBytes: 10,
      cloudinaryPublicId: 'quickdrop/test/done',
      cloudinaryResourceType: 'raw',
      deliveryType: 'authenticated',
      status: 'completed',
      expiresAt: new Date(),
    });
    await UploadSessionModel.updateOne(
      { _id: completed._id },
      { $set: { updatedAt: oldDate(30) } },
      { timestamps: false },
    );

    const result = await pruneUploadSessions(new Date());

    expect(result.deleted).toBe(1);
    expect(await UploadSessionModel.findById(completed._id)).toBeNull();
  });
});
