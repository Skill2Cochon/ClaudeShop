import { DomainError } from './domain-error.js';
import { ApiErrorCode } from './envelope.js';

export class NotFoundError extends DomainError {
  public readonly code = ApiErrorCode.NOT_FOUND;
  public readonly status = 404;
}

export class ValidationError extends DomainError {
  public readonly code = ApiErrorCode.VALIDATION_ERROR;
  public readonly status = 400;
}

export class UnauthorizedError extends DomainError {
  public readonly code = ApiErrorCode.UNAUTHORIZED;
  public readonly status = 401;
}

export class ForbiddenError extends DomainError {
  public readonly code = ApiErrorCode.FORBIDDEN;
  public readonly status = 403;
}

export class ConflictError extends DomainError {
  public readonly code = ApiErrorCode.CONFLICT;
  public readonly status = 409;
}

export class RateLimitError extends DomainError {
  public readonly code = ApiErrorCode.RATE_LIMITED;
  public readonly status = 429;
}

export class PaymentError extends DomainError {
  public readonly code = ApiErrorCode.PAYMENT_ERROR;
  public readonly status = 402;
}

export class InventoryError extends DomainError {
  public readonly code = ApiErrorCode.INVENTORY_UNAVAILABLE;
  public readonly status = 409;
}

export class ModuleError extends DomainError {
  public readonly code = ApiErrorCode.MODULE_ERROR;
  public readonly status = 500;
}

export class IdempotencyConflictError extends DomainError {
  public readonly code = ApiErrorCode.IDEMPOTENCY_CONFLICT;
  public readonly status = 409;
}

export class TenantScopeError extends DomainError {
  public readonly code = ApiErrorCode.TENANT_SCOPE_VIOLATION;
  public readonly status = 403;
}
