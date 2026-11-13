import { z } from 'zod';
import { ACTIVITY_TYPES } from './activity.model';

export const activityListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    type: z.enum(ACTIVITY_TYPES).optional(),
  })
  .strict();

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
