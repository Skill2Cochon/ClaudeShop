import type { ApiErrorCode } from './envelope.js';

/**
 * Base class for all domain errors. Carries a machine-readable code,
 * HTTP status mapping, and optional details for the API envelope.
 *
 * Subclasses should set `code` and `status` in their constructors.
 */
export abstract class DomainError extends Error {
  public abstract readonly code: ApiErrorCode | string;
  public abstract readonly status: number;
  public readonly details?: unknown;
  public readonly docs?: string;

  constructor(message: string, options?: { details?: unknown; docs?: string; cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.details = options?.details;
    this.docs = options?.docs;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
