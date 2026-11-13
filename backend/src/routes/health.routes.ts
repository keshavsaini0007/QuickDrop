import { Router } from 'express';
import { checkCloudinaryConnection } from '../config/cloudinary';
import { isDatabaseReady } from '../config/database';
import { env } from '../config/environment';
import { apiResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  apiResponse.ok(
    res,
    {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '0.1.0',
      environment: env.NODE_ENV,
    },
    'QuickDrop API is healthy.',
  );
});

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const mongoReady = isDatabaseReady();
    const cloudinaryStatus = await checkCloudinaryConnection();
    const cloudinaryReady = !cloudinaryStatus.configured || cloudinaryStatus.ok;
    const ready = mongoReady && cloudinaryReady;

    apiResponse.ok(
      res,
      {
        status: ready ? 'ready' : 'degraded',
        dependencies: {
          mongodb: { ready: mongoReady },
          cloudinary: {
            configured: cloudinaryStatus.configured,
            ready: cloudinaryStatus.ok,
            latencyMs: cloudinaryStatus.latencyMs,
          },
        },
      },
      ready ? 'QuickDrop API is ready.' : 'QuickDrop API is not ready.',
      ready ? 200 : 503,
    );
  }),
);
