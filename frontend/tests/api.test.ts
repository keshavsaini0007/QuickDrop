import { describe, expect, it } from '@jest/globals';
import { AxiosError, type AxiosResponse } from 'axios';
import { ApiClientError, errorMessage, toApiClientError } from '@/lib/api';

function response(status: number, data: unknown): AxiosResponse {
  return {
    status,
    statusText: '',
    headers: {},
    config: {} as AxiosResponse['config'],
    data,
  };
}

describe('API error normalisation', () => {
  it('preserves the server message, status, code and details', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      response(404, {
        success: false,
        message: 'File not found.',
        code: 'FILE_NOT_FOUND',
        errors: [{ field: 'fileId', message: 'abc' }],
      }),
    );

    const normalized = toApiClientError(error);
    expect(normalized).toBeInstanceOf(ApiClientError);
    expect(normalized.status).toBe(404);
    expect(normalized.code).toBe('FILE_NOT_FOUND');
    expect(normalized.message).toBe('File not found.');
    expect(normalized.details).toEqual([{ field: 'fileId', message: 'abc' }]);
  });

  it('uses a connection-specific message when there is no response', () => {
    const normalized = toApiClientError(
      new AxiosError('Network Error', 'ERR_NETWORK'),
    );
    expect(normalized.status).toBe(0);
    expect(normalized.code).toBe('REQUEST_FAILED');
    expect(normalized.message).toContain('could not reach the server');
  });

  it('normalises non-Axios errors without leaking internals', () => {
    expect(errorMessage(new Error('Plain failure'))).toBe('Plain failure');
    expect(errorMessage('unexpected')).toBe('An unexpected error occurred.');
    const existing = new ApiClientError('Already normalised', 409, 'CONFLICT');
    expect(toApiClientError(existing)).toBe(existing);
  });
});
