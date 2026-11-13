import type { Logger } from 'pino';
import type { AuthUser, ValidatedRequestData } from './domain';

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      user?: AuthUser;
      validated?: ValidatedRequestData;
    }
  }
}

export {};
