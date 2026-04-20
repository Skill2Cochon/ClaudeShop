import { ZodError } from 'zod';
import { DomainError } from './domain-error';
import { ApiErrorCode, type ApiError } from './envelope';

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}

/**
 * Maps any thrown value to a safe ApiError envelope.
 * Never leaks stack traces or internal messages for 5xx errors.
 */
export function toApiError(err: unknown, requestId?: string): ApiError {
  if (isDomainError(err)) {
    return {
      error: {
        code: err.code,
        message: err.message,
        status: err.status,
        requestId,
        details: err.details,
        docs: err.docs,
      },
    };
  }

  if (err instanceof ZodError) {
    return {
      error: {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        status: 400,
        requestId,
        details: err.issues,
      },
    };
  }

  // Unknown — do not leak details.
  return {
    error: {
      code: ApiErrorCode.INTERNAL,
      message: 'Internal server error',
      status: 500,
      requestId,
    },
  };
}
