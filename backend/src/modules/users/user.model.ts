import { Schema, model, type HydratedDocument } from 'mongoose';
import { env } from '../../config/environment';
import type { UserRole } from '../../types/domain';

export interface User {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarPublicId?: string;
  tokenVersion: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatarPublicId: { type: String },
    tokenVersion: { type: Number, default: 0, min: 0 },
    storageUsedBytes: { type: Number, default: 0, min: 0 },
    storageLimitBytes: { type: Number, default: env.STORAGE_LIMIT_BYTES, min: 0 },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const UserModel = model<User>('User', userSchema);
export default UserModel;
