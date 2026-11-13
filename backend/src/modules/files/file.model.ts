import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  CLOUDINARY_RESOURCE_TYPES,
  MEDIA_TYPES,
  type CloudinaryResourceType,
  type MediaType,
} from '../../utils/fileTypes';

export interface FileRecord {
  owner: Types.ObjectId;
  folder: Types.ObjectId | null;
  parentKey: string;
  name: string;
  nameKey: string;
  extension: string;
  mimeType: string;
  mediaType: MediaType;
  sizeBytes: number;
  cloudinaryPublicId: string;
  cloudinaryResourceType: CloudinaryResourceType;
  deliveryType: 'authenticated' | 'upload';
  format?: string;
  version?: number;
  etag?: string;
  width?: number;
  height?: number;
  duration?: number;
  isFavorite: boolean;
  downloadCount: number;
  lastAccessedAt?: Date;
  deletedAt?: Date;
  trashBatchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<FileRecord>;

const fileSchema = new Schema<FileRecord>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    folder: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    parentKey: { type: String, required: true, default: 'root', maxlength: 64 },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 255 },
    nameKey: { type: String, required: true, maxlength: 255 },
    extension: { type: String, required: true, maxlength: 16 },
    mimeType: { type: String, required: true, maxlength: 160 },
    mediaType: { type: String, enum: MEDIA_TYPES, required: true, index: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    cloudinaryPublicId: { type: String, required: true, unique: true },
    cloudinaryResourceType: {
      type: String,
      enum: CLOUDINARY_RESOURCE_TYPES,
      required: true,
    },
    deliveryType: { type: String, enum: ['authenticated', 'upload'], required: true },
    format: { type: String, maxlength: 32 },
    version: { type: Number, min: 0 },
    etag: { type: String, maxlength: 128 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    duration: { type: Number, min: 0 },
    isFavorite: { type: Boolean, default: false, index: true },
    downloadCount: { type: Number, default: 0, min: 0 },
    lastAccessedAt: { type: Date },
    deletedAt: { type: Date },
    trashBatchId: { type: String, index: true },
  },
  { timestamps: true },
);

fileSchema.index({ owner: 1, parentKey: 1, nameKey: 1 }, {
  unique: true,
  partialFilterExpression: { deletedAt: null },
});
fileSchema.index({ owner: 1, parentKey: 1, deletedAt: 1, createdAt: -1 });
fileSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
fileSchema.index({ owner: 1, mediaType: 1, deletedAt: 1 });
fileSchema.index({ owner: 1, isFavorite: 1, deletedAt: 1 });
fileSchema.index({ name: 'text' });

export const FileModel = model<FileRecord>('File', fileSchema);
export default FileModel;
