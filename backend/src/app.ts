import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { clientOrigins, env } from './config/environment';
import { httpLogger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimiter';
import { requestContext } from './middleware/requestContext';
import { sanitizeInput } from './middleware/sanitizeInput';
import { notFound } from './middleware/notFound';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { fileRouter } from './modules/files/file.routes';
import { folderRouter } from './modules/folders/folder.routes';
import { shareRouter, publicShareRouter } from './modules/shares/share.routes';
import { storageRouter } from './modules/storage/storage.routes';
import { trashRouter } from './modules/trash/trash.routes';
import { activityRouter } from './modules/activities/activity.routes';
import { sharePageRouter } from './routes/sharePage.routes';
import { ApiError } from './utils/apiError';
import { apiResponse } from './utils/apiResponse';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestContext);
  app.use(httpLogger);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || clientOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new ApiError(403, 'This origin is not allowed.', 'CORS_NOT_ALLOWED'));
      },
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-Request-Id',
        'X-Share-Access-Token',
      ],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86400,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  app.get('/', (_req, res) => {
    apiResponse.ok(
      res,
      {
        name: 'QuickDrop API',
        version: process.env.npm_package_version ?? '0.1.0',
        documentation: 'See docs/API.md',
        health: '/health',
      },
      'QuickDrop API',
    );
  });

  app.use('/health', healthRouter);
  app.use('/s', sharePageRouter);
  app.use(globalLimiter);

  const apiRouter = Router();
  apiRouter.get('/', (_req, res) => {
    apiResponse.ok(
      res,
      { name: 'QuickDrop API', version: process.env.npm_package_version ?? '0.1.0' },
      'QuickDrop API',
    );
  });
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/users', userRouter);
  apiRouter.use('/files', fileRouter);
  apiRouter.use('/folders', folderRouter);
  apiRouter.use('/shares', shareRouter);
  apiRouter.use('/public/shares', publicShareRouter);
  apiRouter.use('/storage', storageRouter);
  apiRouter.use('/trash', trashRouter);
  apiRouter.use('/activities', activityRouter);
  app.use(env.API_PREFIX, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
