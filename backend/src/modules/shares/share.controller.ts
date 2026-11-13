import type { Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import { ApiError } from '../../utils/apiError';
import * as shareService from './share.service';
import type {
  CreateShareInput,
  ShareListQuery,
  UnlockShareInput,
} from './share.validation';

function body<T>(req: Request): T {
  return (req.validated?.body ?? {}) as T;
}

function query<T>(req: Request): T {
  return (req.validated?.query ?? {}) as T;
}

function params<T>(req: Request): T {
  return (req.validated?.params ?? {}) as T;
}

function userId(req: Request): string {
  if (!req.user) throw new Error('Authenticated user missing from request context');
  return req.user.id;
}

export const createShare = asyncHandler(async (req, res) => {
  const result = await shareService.createShare(userId(req), body<CreateShareInput>(req));
  req.log.info({ userId: userId(req), shareId: result.share.id }, 'Share link created');
  apiResponse.created(res, result, 'Share link created. The URL is shown only once.');
});

export const listShares = asyncHandler(async (req, res) => {
  const result = await shareService.listShares(userId(req), query<ShareListQuery>(req));
  apiResponse.paginated(res, result.shares, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    hasNextPage: result.hasNextPage,
  }, 'Share links loaded.');
});

export const revokeShare = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const share = await shareService.revokeShare(userId(req), id);
  apiResponse.ok(res, share, 'Share link revoked.');
});

export const regenerateShare = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const result = await shareService.regenerateShare(userId(req), id);
  apiResponse.ok(res, result, 'Share link regenerated. The new URL is shown only once.');
});

export const getPublicShare = asyncHandler(async (req, res) => {
  const { token } = params<{ token: string }>(req);
  const result = await shareService.getPublicShareInfo(token);
  apiResponse.ok(res, result, 'Share link loaded.');
});

export const unlockPublicShare = asyncHandler(async (req, res) => {
  const { token } = params<{ token: string }>(req);
  const result = await shareService.unlockShare(token, body<UnlockShareInput>(req));
  req.log.info({ shareId: result.share.id }, 'Public share unlocked');
  apiResponse.ok(res, result, 'Share unlocked.');
});

export const downloadPublicShare = asyncHandler(async (req, res) => {
  const { token } = params<{ token: string }>(req);
  const accessToken = req.get('x-share-access-token') ?? req.query.accessToken;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new ApiError(401, 'A share access token is required.', 'SHARE_ACCESS_REQUIRED');
  }
  const result = await shareService.downloadSharedFile(token, accessToken);
  req.log.info({ shareId: result.share.id }, 'Public share download link issued');
  apiResponse.ok(res, result, 'Share download link issued.');
});
