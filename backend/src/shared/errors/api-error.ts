import type { ErrorResponseDto } from '../schemas/error.schema.js';

export type ApiErrorDetails = ErrorResponseDto['details'];

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ApiErrorDetails;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: ApiErrorDetails = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
