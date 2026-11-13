import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { env, isDevelopment, isTest } from './environment';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'currentPassword',
  '*.currentPassword',
  'newPassword',
  '*.newPassword',
  'refreshToken',
  '*.refreshToken',
  'resetToken',
  '*.resetToken',
  'accessToken',
  '*.accessToken',
  'token',
  '*.token',
  'signature',
  '*.signature',
  'api_secret',
  '*.api_secret',
  'apiKey',
  '*.apiKey',
];

const transport =
  env.LOG_PRETTY && !isTest
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined;

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[redacted]',
  },
  ...(transport ? { transport } : {}),
});

export function redactUrl(input = ''): string {
  return input
    .replace(/(\/s\/)([^/?#]+)/gi, '$1:token')
    .replace(/(\/api\/public\/shares\/)([^/?#]+)/gi, '$1:token')
    .replace(/(\/api\/shares\/public\/)([^/?#]+)/gi, '$1:token')
    .replace(/([?&](?:token|signature|access_token|key|api_key)=)[^&#]*/gi, '$1[redacted]');
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as unknown as { id?: string }).id ?? randomUUID(),
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method ?? 'REQUEST'} ${redactUrl(req.url)} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, error) => {
    return `${req.method ?? 'REQUEST'} ${redactUrl(req.url)} ${res.statusCode} - ${error.message}`;
  },
  serializers: {
    req(req) {
      return {
        id: (req as unknown as { id?: string }).id,
        method: req.method,
        url: redactUrl(req.url),
        remoteAddress: req.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
    err(error) {
      return {
        type: error.name,
        message: error.message,
        ...(isDevelopment ? { stack: error.stack } : {}),
      };
    },
  },
});
