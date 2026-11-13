import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface RefreshToken {
  user: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
  createdByIp?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

const refreshTokenSchema = new Schema<RefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByTokenHash: { type: String },
    createdByIp: { type: String, maxlength: 128 },
    userAgent: { type: String, maxlength: 512 },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ user: 1, familyId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<RefreshToken>('RefreshToken', refreshTokenSchema);
export default RefreshTokenModel;
