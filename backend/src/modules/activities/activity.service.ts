import type { Types } from 'mongoose';
import { logger } from '../../config/logger';
import {
  ActivityModel,
  type ActivityDocument,
  type ActivityType,
} from './activity.model';

export interface RecordActivityInput {
  owner: Types.ObjectId | string;
  type: ActivityType;
  file?: Types.ObjectId | string;
  folder?: Types.ObjectId | string;
  share?: Types.ObjectId | string;
  metadata?: Record<string, unknown>;
}

/**
 * Activity is supporting data: a failure to record it must not break the
 * user-facing operation that already succeeded.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    await ActivityModel.create({
      owner: input.owner,
      type: input.type,
      ...(input.file ? { file: input.file } : {}),
      ...(input.folder ? { folder: input.folder } : {}),
      ...(input.share ? { share: input.share } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  } catch (error) {
    logger.error({ err: error, type: input.type }, 'Failed to record activity');
  }
}

export interface ActivityDto {
  id: string;
  type: ActivityType;
  fileId: string | null;
  folderId: string | null;
  shareId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function toActivityDto(activity: ActivityDocument): ActivityDto {
  return {
    id: activity.id,
    type: activity.type,
    fileId: activity.file ? activity.file.toString() : null,
    folderId: activity.folder ? activity.folder.toString() : null,
    shareId: activity.share ? activity.share.toString() : null,
    metadata: activity.metadata ?? null,
    createdAt: activity.createdAt.toISOString(),
  };
}

export interface ActivityListResult {
  activities: ActivityDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export async function listActivities(
  ownerId: string,
  input: { page: number; limit: number; type?: ActivityType },
): Promise<ActivityListResult> {
  const filter = {
    owner: ownerId,
    ...(input.type ? { type: input.type } : {}),
  };
  const skip = (input.page - 1) * input.limit;
  const [activities, total] = await Promise.all([
    ActivityModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.limit),
    ActivityModel.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / input.limit);

  return {
    activities: activities.map(toActivityDto),
    page: input.page,
    limit: input.limit,
    total,
    totalPages,
    hasNextPage: input.page < totalPages,
  };
}
