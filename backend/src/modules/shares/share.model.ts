import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface Share {
  owner: Types.ObjectId;
  file: Types.ObjectId;
  tokenHash: string;
  passwordHash?: string;
  expiresAt?: Date;
  maxDownloads?: number;
  downloadCount: number;
  lastAccessedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ShareDocument = HydratedDocument<Share>;

const shareSchema = new Schema<Share>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    file: { type: Schema.Types.ObjectId, ref: 'File', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, select: false },
    expiresAt: { type: Date },
    maxDownloads: { type: Number, min: 1 },
    downloadCount: { type: Number, default: 0, min: 0 },
    lastAccessedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

shareSchema.index({ owner: 1, createdAt: -1 });
shareSchema.index({ file: 1, revokedAt: 1 });

export const ShareModel = model<Share>('Share', shareSchema);
export default ShareModel;
