process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_PRETTY = 'false';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-bytes';
process.env.REFRESH_TOKEN_PEPPER = 'test-refresh-pepper-that-is-at-least-32-bytes';
process.env.SHARE_TOKEN_PEPPER = 'test-share-pepper-that-is-at-least-32-bytes';
process.env.JWT_SHARE_SECRET = 'test-share-secret-that-is-at-least-32-bytes';
process.env.BCRYPT_SALT_ROUNDS = '10';
process.env.RATE_LIMIT_GLOBAL_MAX = '100000';
process.env.RATE_LIMIT_AUTH_MAX = '100000';
process.env.RATE_LIMIT_UPLOAD_MAX = '100000';
process.env.RATE_LIMIT_PUBLIC_MAX = '100000';
// Unit/integration tests never touch a real Cloudinary account. The dedicated
// `test:cloudinary` script opts in and uses credentials from the shell or .env.
if (process.env.npm_lifecycle_event !== 'test:cloudinary') {
  process.env.CLOUDINARY_CLOUD_NAME = '';
  process.env.CLOUDINARY_API_KEY = '';
  process.env.CLOUDINARY_API_SECRET = '';
}
process.env.DEV_EXPOSE_RESET_TOKEN = 'true';

jest.setTimeout(30000);
