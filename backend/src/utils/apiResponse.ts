import type { Response } from 'express';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  [key: string]: unknown;
}

export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: ApiMeta;
}

const send = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T,
  meta?: ApiMeta,
): Response => {
  const body: ApiSuccessBody<T> = {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };

  return res.status(statusCode).json(body);
};

export const apiResponse = {
  ok<T>(res: Response, data: T, message = 'OK', statusCode = 200, meta?: ApiMeta): Response {
    return send(res, statusCode, message, data, meta);
  },

  created<T>(res: Response, data: T, message = 'Created successfully.'): Response {
    return send(res, 201, message, data);
  },

  noContent(res: Response): Response {
    return res.status(204).send();
  },

  paginated<T>(
    res: Response,
    data: T,
    meta: Required<Pick<ApiMeta, 'page' | 'limit' | 'total' | 'totalPages' | 'hasNextPage'>> &
      ApiMeta,
    message = 'OK',
  ): Response {
    return send(res, 200, message, data, meta);
  },
};

export const apiSuccess = apiResponse;
