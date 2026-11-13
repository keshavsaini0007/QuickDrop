import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const ACTIVITY_TYPES = [
  'file_uploaded',
  'file_downloaded',
  'file_renamed',
  'file_moved',
  'file_favorited',
  'file_unfavorited',
  'file_deleted',
  'file_restored',
  'file_permanently_deleted',
  'folder_created',
  'folder_renamed',
  'folder_moved',
  'folder_deleted',
  'folder_restored',
  'share_created',
  'share_revoked',
  'share_regenerated',
  'profile_updated',
  'password_changed',
  'avatar_updated',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Activity {
  owner: Types.ObjectId;
  type: ActivityType;
  file?: Types.ObjectId;
  folder?: Types.ObjectId;
  share?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type ActivityDocument = HydratedDocument<Activity>;

const activitySchema = new Schema<Activity>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    file: { type: Schema.Types.ObjectId, ref: 'File' },
    folder: { type: Schema.Types.ObjectId, ref: 'Folder' },
    share: { type: Schema.Types.ObjectId, ref: 'Share' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ owner: 1, createdAt: -1 });
activitySchema.index({ owner: 1, type: 1, createdAt: -1 });
activitySchema.index({ owner: 1, file: 1, createdAt: -1 });

export const ActivityModel = model<Activity>('Activity', activitySchema);
export default ActivityModel;
