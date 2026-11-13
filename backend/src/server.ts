import type { Server } from 'node:http';
import { createApp } from './app';
import { cloudinarySafeConfig, checkCloudinaryConnection } from './config/cloudinary';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env, isProduction } from './config/environment';
import { logger } from './config/logger';
import { startMaintenanceJobs } from './jobs/maintenance.jobs';

let server: Server | undefined;
let stopMaintenance: (() => void) | undefined;
let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down QuickDrop API');

  const forceExit = setTimeout(() => {
    logger.fatal('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    stopMaintenance?.();
    stopMaintenance = undefined;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    await disconnectDatabase();
    clearTimeout(forceExit);
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  logger.info(
    {
      node: process.version,
      environment: env.NODE_ENV,
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
      publicWebBaseUrl: env.PUBLIC_WEB_BASE_URL,
      storageLimitBytes: env.STORAGE_LIMIT_BYTES,
      trashRetentionDays: env.TRASH_RETENTION_DAYS,
      cloudinary: cloudinarySafeConfig,
    },
    'Starting QuickDrop API',
  );

  await connectDatabase();
  const cloudinaryStatus = await checkCloudinaryConnection(true);
  if (cloudinaryStatus.configured) {
    logger.info(
      { ok: cloudinaryStatus.ok, latencyMs: cloudinaryStatus.latencyMs },
      'Cloudinary dependency check completed',
    );
  } else {
    logger.warn('Cloudinary is not configured; upload and preview endpoints will be unavailable.');
  }

  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, environment: env.NODE_ENV },
      `QuickDrop API listening on http://localhost:${env.PORT}`,
    );
  });

  server.requestTimeout = 30000;
  server.headersTimeout = 35000;
  server.keepAliveTimeout = 65000;

  server.on('error', (error) => {
    logger.fatal({ err: error }, 'HTTP server error');
    void shutdown('server-error', 1);
  });

  stopMaintenance = startMaintenanceJobs();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  if (isProduction) void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});

if (require.main === module) {
  bootstrap().catch((error) => {
    logger.fatal({ err: error }, 'Failed to start QuickDrop API');
    void shutdown('bootstrap-failure', 1);
  });
}

export { bootstrap };
