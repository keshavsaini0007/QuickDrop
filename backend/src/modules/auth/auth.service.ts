import bcrypt from 'bcryptjs';
import { env } from '../../config/environment';
import { logger } from '../../config/logger';
import { recordActivity } from '../activities/activity.service';
import { UserModel, type UserDocument } from '../users/user.model';
import { toUserDto, type UserDto } from '../users/user.dto';
import { ApiError } from '../../utils/apiError';
import { generateOpaqueToken } from '../../utils/crypto';
import { sendPasswordResetEmail } from '../../utils/email';
import {
  createRefreshTokenRecord,
  getAccessTokenExpiry,
  hashRefreshToken,
  hashResetToken,
  issueAccessToken,
  issueTokenPair,
  type AuthTokenMeta,
  type IssuedTokenPair,
  type TokenUser,
} from './token.service';
import { RefreshTokenModel } from './refreshToken.model';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from './auth.validation';

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('quickdrop-invalid-password', env.BCRYPT_SALT_ROUNDS);

export interface AuthResult {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface ForgotPasswordResult {
  resetToken?: string;
}

function toTokenUser(user: UserDocument): TokenUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

async function issueAuthResult(
  user: UserDocument,
  meta: AuthTokenMeta,
  familyId?: string,
): Promise<AuthResult> {
  const tokens: IssuedTokenPair = await issueTokenPair(toTokenUser(user), familyId, meta);
  return {
    user: toUserDto(user),
    ...tokens,
  };
}

export async function register(
  input: RegisterInput,
  meta: AuthTokenMeta,
): Promise<AuthResult> {
  const existing = await UserModel.exists({ email: input.email });
  if (existing) {
    throw ApiError.conflict(
      'An account with this email already exists.',
      'EMAIL_ALREADY_EXISTS',
    );
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
  });

  logger.info({ userId: user.id }, 'User registered');
  return issueAuthResult(user, meta);
}

export async function login(input: LoginInput, meta: AuthTokenMeta): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(input.password, passwordHash);

  if (!user || !passwordMatches) {
    logger.warn({ email: input.email.replace(/(^.).*(@.*$)/, '$1***$2') }, 'Login failed');
    throw ApiError.unauthorized('Email or password is incorrect.');
  }

  await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  user.lastLoginAt = new Date();

  logger.info({ userId: user.id }, 'User logged in');
  return issueAuthResult(user, meta);
}

export async function refresh(rawToken: string, meta: AuthTokenMeta): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await RefreshTokenModel.findOne({ tokenHash });

  if (!existing) {
    throw ApiError.unauthorized('Invalid refresh token.');
  }

  if (existing.revokedAt) {
    if (existing.replacedByTokenHash) {
      await RefreshTokenModel.updateMany(
        { user: existing.user, familyId: existing.familyId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      );
      logger.error(
        { userId: String(existing.user), familyId: existing.familyId },
        'Refresh token reuse detected; token family revoked',
      );
      throw new ApiError(
        401,
        'Refresh token reuse detected. Please sign in again.',
        'REFRESH_TOKEN_REUSED',
      );
    }

    throw ApiError.unauthorized('This refresh token has been revoked.');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthorized('This refresh token has expired.');
  }

  const user = await UserModel.findById(existing.user);
  if (!user) {
    throw ApiError.unauthorized('The account for this session no longer exists.');
  }

  const claimed = await RefreshTokenModel.findOneAndUpdate(
    { _id: existing._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!claimed) {
    await RefreshTokenModel.updateMany(
      { user: existing.user, familyId: existing.familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    logger.error(
      { userId: String(existing.user), familyId: existing.familyId },
      'Concurrent refresh token reuse detected; token family revoked',
    );
    throw new ApiError(
      401,
      'Refresh token reuse detected. Please sign in again.',
      'REFRESH_TOKEN_REUSED',
    );
  }

  const next = await createRefreshTokenRecord(user.id, existing.familyId, meta);
  claimed.replacedByTokenHash = next.record.tokenHash;
  await claimed.save();

  const accessToken = issueAccessToken(toTokenUser(user));
  logger.info({ userId: user.id }, 'Access token refreshed');

  return {
    user: toUserDto(user),
    accessToken,
    refreshToken: next.rawToken,
    accessTokenExpiresAt: getAccessTokenExpiry(accessToken),
    refreshTokenExpiresAt: next.expiresAt,
  };
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshTokenModel.updateOne(
    { tokenHash, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function logoutAll(userId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.unauthorized('The account no longer exists.');

  user.tokenVersion += 1;
  await user.save();
  await RefreshTokenModel.updateMany(
    { user: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  logger.info({ userId }, 'All sessions revoked');
}

export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<ForgotPasswordResult> {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) {
    // Always return a generic result to avoid account enumeration.
    return {};
  }

  const rawToken = generateOpaqueToken(32);
  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await user.save();

  await sendPasswordResetEmail({ to: user.email, name: user.name, token: rawToken });
  logger.info({ userId: user.id }, 'Password reset requested');

  return env.DEV_EXPOSE_RESET_TOKEN ? { resetToken: rawToken } : {};
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashResetToken(input.token);
  const user = await UserModel.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash');

  if (!user) {
    throw new ApiError(
      400,
      'The reset token is invalid or has expired.',
      'INVALID_RESET_TOKEN',
    );
  }

  user.passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  user.tokenVersion += 1;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  await RefreshTokenModel.updateMany(
    { user: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  logger.info({ userId: user.id }, 'Password reset completed');
}

export async function getMe(userId: string): Promise<UserDto> {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.unauthorized('The account no longer exists.');
  return toUserDto(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserDto> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('The account no longer exists.');

  if (input.email && input.email !== user.email) {
    if (!input.currentPassword) {
      throw ApiError.badRequest('Current password is required to change email.');
    }
    const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!matches) {
      throw ApiError.badRequest('Current password is incorrect.');
    }
    const existing = await UserModel.exists({ email: input.email, _id: { $ne: user._id } });
    if (existing) {
      throw ApiError.conflict(
        'An account with this email already exists.',
        'EMAIL_ALREADY_EXISTS',
      );
    }
    user.email = input.email;
  }

  if (input.name) user.name = input.name;
  await user.save();

  await recordActivity({
    owner: user.id,
    type: 'profile_updated',
    metadata: { fields: [input.name ? 'name' : null, input.email ? 'email' : null].filter(Boolean) },
  });

  logger.info({ userId: user.id }, 'Profile updated');
  return toUserDto(user);
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  meta: AuthTokenMeta,
): Promise<AuthResult> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('The account no longer exists.');

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw ApiError.badRequest('Current password is incorrect.');
  }

  user.passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_SALT_ROUNDS);
  user.tokenVersion += 1;
  await user.save();

  await RefreshTokenModel.updateMany(
    { user: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  await recordActivity({
    owner: user.id,
    type: 'password_changed',
    metadata: {},
  });

  logger.info({ userId: user.id }, 'Password changed; other sessions revoked');
  return issueAuthResult(user, meta);
}
