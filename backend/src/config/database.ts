import mongoose from 'mongoose';
import { env, isTest } from './environment';
import { logger } from './logger';

let listenersAttached = false;

function attachConnectionListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    logger.info({ database: mongoose.connection.name }, 'MongoDB connected');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
  mongoose.connection.on('error', (error) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });
}

export async function connectDatabase(uri = env.MONGODB_URI): Promise<void> {
  attachConnectionListeners();

  mongoose.set('strictQuery', true);
  if (env.MONGOOSE_DEBUG && !isTest) {
    mongoose.set(
      'debug',
      (collectionName: string, methodName: string, ...methodArgs: unknown[]) => {
        logger.debug({ collectionName, methodName, methodArgs }, 'MongoDB operation');
      },
    );
  }

  await mongoose.connect(uri, {
    ...(env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {}),
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 0,
  });

  logger.info(
    {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    },
    'MongoDB connection established',
  );
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export default mongoose;
