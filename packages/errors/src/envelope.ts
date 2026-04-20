/**
 * Consistent API response envelope used across REST and GraphQL.
 *
 * Success:  { data, meta? }
 * Error:    { error: { code, message, status, requestId, details?, docs? } }
 */

export const ApiErrorCode = {
  // 400
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  // 401 / 403
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TENANT_SCOPE_VIOLATION: 'TENANT_SCOPE_VIOLATION',
  // 404
  NOT_FOUND: 'NOT_FOUND',
  // 409
  CONFLICT: 'CONFLICT',
  // 422
  UNPROCESSABLE: 'UNPROCESSABLE',
  // 429
  RATE_LIMITED: 'RATE_LIMITED',
  // 500+
  INTERNAL: 'INTERNAL',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  // Domain
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  INVENTORY_UNAVAILABLE: 'INVENTORY_UNAVAILABLE',
  MODULE_ERROR: 'MODULE_ERROR',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorShape {
  code: ApiErrorCode | string;
  message: string;
  status: number;
  requestId?: string;
  details?: unknown;
  docs?: string;
}

export interface ApiError {
  error: ApiErrorShape;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
    cursor?: string | null;
  };
}
