import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import { listActivities } from './activity.service';
import type { ActivityListQuery } from './activity.validation';

export const listActivity = asyncHandler(async (req, res) => {
  if (!req.user) throw new Error('Authenticated user missing from request context');
  const query = (req.validated?.query ?? {}) as ActivityListQuery;
  const result = await listActivities(req.user.id, query);
  apiResponse.paginated(res, result.activities, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    hasNextPage: result.hasNextPage,
  }, 'Activity loaded.');
});
