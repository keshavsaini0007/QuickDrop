import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { CloudinaryResourceType, MediaType } from '../../utils/fileTypes';

export const UPLOAD_SESSION_STATUSES = [
  'pending',
  'confirming',
  'completed',
  'failed',
  'expired',
] as const;
export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUSES)[number];

export interface UploadSession {
  owner: Types.ObjectId;
  folder: Types.ObjectId | null;
  parentKey: string;
  fileName: string;
  nameKey: string;
  extension: string;
  mimeType: string;
  mediaType: MediaType;
  sizeBytes: number;
  reservedBytes: number;
  cloudinaryPublicId: string;
  cloudinaryResourceType: CloudinaryResourceType;
  deliveryType: 'authenticated' | 'upload';
  status: UploadSessionStatus;
  file?: Types.ObjectId;
  expiresAt: Date;
  completedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UploadSessionDocument = HydratedDocument<UploadSession>;

const uploadSessionSchema = new Schema<UploadSession>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    folder: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    parentKey: { type: String, required: true, default: 'root' },
    fileName: { type: String, required: true },
    nameKey: { type: String, required: true },
    extension: { type: String, required: true },
    mimeType: { type: String, required: true },
    mediaType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    reservedBytes: { type: Number, required: true, min: 0 },
    cloudinaryPublicId: { type: String, required: true, unique: true },
    cloudinaryResourceType: { type: String, required: true },
    deliveryType: { type: String, enum: ['authenticated', 'upload'], required: true },
    status: { type: String, enum: UPLOAD_SESSION_STATUSES, default: 'pending', index: true },
    file: { type: Schema.Types.ObjectId, ref: 'File' },
    expiresAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    failureReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

uploadSessionSchema.index({ owner: 1, status: 1, expiresAt: 1 });

export const UploadSessionModel = model<UploadSession>('UploadSession', uploadSessionSchema);
export default UploadSessionModel;
