import {
  create,
  isAxiosError,
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiEnvelope, PaginationMeta } from '@/types/api';
import { API_BASE_URL } from './config';
import { getAccessToken, refreshAccessToken } from './session';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _quickdropRetry?: boolean;
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 0, code = 'NETWORK_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiErrorBody {
  success?: false;
  message?: string;
  code?: string;
  errors?: unknown;
  requestId?: string;
}

export function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;
  if (isAxiosError<ApiErrorBody>(error)) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const message =
      body?.message ||
      (status === 0
        ? 'QuickDrop could not reach the server. Check your connection and try again.'
        : 'The request could not be completed.');
    return new ApiClientError(message, status, body?.code ?? 'REQUEST_FAILED', body?.errors);
  }
  if (error instanceof Error) {
    return new ApiClientError(error.message, 0, 'UNEXPECTED_ERROR');
  }
  return new ApiClientError('An unexpected error occurred.', 0, 'UNEXPECTED_ERROR');
}

export function errorMessage(error: unknown): string {
  return toApiClientError(error).message;
}

export const api = create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';
    const skipRefresh =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password') ||
      url.includes('/public/shares/');

    if (status === 401 && config && !config._quickdropRetry && !skipRefresh) {
      config._quickdropRetry = true;
      try {
        const token = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      } catch {
        return Promise.reject(toApiClientError(error));
      }
    }

    return Promise.reject(toApiClientError(error));
  },
);

export interface PaginatedResult<T> {
  data: T;
  meta: PaginationMeta;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<ApiEnvelope<T>>(url, config);
  return response.data.data;
}

export async function apiGetPaginated<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<PaginatedResult<T>> {
  const response = await api.get<ApiEnvelope<T>>(url, config);
  const meta = response.data.meta;
  if (!meta) {
    return {
      data: response.data.data,
      meta: {
        page: 1,
        limit: Array.isArray(response.data.data) ? response.data.data.length : 1,
        total: Array.isArray(response.data.data) ? response.data.data.length : 1,
        totalPages: 1,
        hasNextPage: false,
      },
    };
  }
  return { data: response.data.data, meta };
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.post<ApiEnvelope<T>>(url, body, config);
  return response.data.data;
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.patch<ApiEnvelope<T>>(url, body, config);
  return response.data.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.delete<ApiEnvelope<T>>(url, config);
  return response.data.data;
}
