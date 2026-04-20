import { randomUUID } from 'node:crypto';

/**
 * Generate a request id — prefers the client-provided one for correlation,
 * otherwise mints a fresh UUID v4.
 */
export function createRequestId(existing?: string | null): string {
  if (existing && existing.length >= 8 && existing.length <= 128) {
    return existing;
  }
  return randomUUID();
}
