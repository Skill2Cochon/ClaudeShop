export { ApiErrorCode, type ApiErrorShape, type ApiError, type ApiSuccess } from './envelope';
export { DomainError } from './domain-error';
export {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  PaymentError,
  InventoryError,
  ModuleError,
  IdempotencyConflictError,
  TenantScopeError,
} from './errors';
export { toApiError, isDomainError } from './to-api-error';
