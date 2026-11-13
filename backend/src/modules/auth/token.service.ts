import { randomUUID } from 'node:crypto';
import jwt, {
  type JwtPayload,
  type SignOptions,
  TokenExpiredError,
  JsonWebTokenError,
} from 'jsonwebtoken';
import { env } from '../../config/environment';
import type { UserRole } from '../../types/domain';
import { generateOpaqueToken, hmacHash } from '../../utils/crypto';
import {
  RefreshTokenModel,
  type RefreshTokenDocument,
} from './refreshToken.model';

export interface TokenUser {
  id: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
}

export interface AuthTokenMeta {
  ip?: string;
  userAgent?: string;
}

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  tokenVersion: number;
  type: 'access';
}

export interface ShareAccessTokenPayload extends JwtPayload {
  sub: string;
  shareId: string;
  fileId: string;
  scope: 'share:download';
  type: 'share-access';
}

export interface IssuedRefreshToken {
  record: RefreshTokenDocument;
  rawToken: string;
  expiresAt: Date;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export function hashRefreshToken(rawToken: string): string {
  return hmacHash(rawToken, env.REFRESH_TOKEN_PEPPER);
}

export function hashResetToken(rawToken: string): string {
  return hmacHash(rawToken, env.SHARE_TOKEN_PEPPER);
}

export function hashShareToken(rawToken: string): string {
  return hmacHash(rawToken, env.SHARE_TOKEN_PEPPER);
}

export function issueAccessToken(user: TokenUser): string {
  return jwt.sign(
    {
      role: user.role,
      tokenVersion: user.tokenVersion,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      jwtid: randomUUID(),
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  if (
    typeof decoded === 'string' ||
    !decoded.sub ||
    decoded.type !== 'access' ||
    (decoded.role !== 'user' && decoded.role !== 'admin') ||
    typeof decoded.tokenVersion !== 'number'
  ) {
    throw new JsonWebTokenError('Invalid access token payload.');
  }

  return decoded as AccessTokenPayload;
}

export function getAccessTokenExpiry(token: string): Date {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded !== 'string' && typeof decoded.exp === 'number') {
    return new Date(decoded.exp * 1000);
  }
  return new Date(Date.now() + 15 * 60 * 1000);
}

export async function createRefreshTokenRecord(
  userId: string,
  familyId: string,
  meta: AuthTokenMeta = {},
): Promise<IssuedRefreshToken> {
  const rawToken = generateOpaqueToken(48);
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  );

  const record = await RefreshTokenModel.create({
    user: userId,
    tokenHash,
    familyId,
    expiresAt,
    ...(meta.ip ? { createdByIp: meta.ip } : {}),
    ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, 512) } : {}),
  });

  return { record, rawToken, expiresAt };
}

export async function issueTokenPair(
  user: TokenUser,
  familyId: string = randomUUID(),
  meta: AuthTokenMeta = {},
): Promise<IssuedTokenPair> {
  const accessToken = issueAccessToken(user);
  const refresh = await createRefreshTokenRecord(user.id, familyId, meta);

  return {
    accessToken,
    refreshToken: refresh.rawToken,
    accessTokenExpiresAt: getAccessTokenExpiry(accessToken),
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

export function signShareAccessToken(input: {
  ownerId: string;
  shareId: string;
  fileId: string;
}): { token: string; expiresAt: Date } {
  const token = jwt.sign(
    {
      shareId: input.shareId,
      fileId: input.fileId,
      scope: 'share:download',
      type: 'share-access',
    },
    env.JWT_SHARE_SECRET,
    {
      subject: input.ownerId,
      expiresIn: `${env.SHARE_ACCESS_EXPIRES_MINUTES}m` as SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
      audience: 'quickdrop-share',
      jwtid: randomUUID(),
    },
  );

  return {
    token,
    expiresAt: new Date(Date.now() + env.SHARE_ACCESS_EXPIRES_MINUTES * 60 * 1000),
  };
}

export function verifyShareAccessToken(token: string): ShareAccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SHARE_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: 'quickdrop-share',
  });

  if (
    typeof decoded === 'string' ||
    !decoded.sub ||
    decoded.type !== 'share-access' ||
    decoded.scope !== 'share:download' ||
    typeof decoded.shareId !== 'string' ||
    typeof decoded.fileId !== 'string'
  ) {
    throw new JsonWebTokenError('Invalid share access token.');
  }

  return decoded as ShareAccessTokenPayload;
}

export function isTokenExpiredError(error: unknown): error is TokenExpiredError {
  return error instanceof TokenExpiredError;
}
