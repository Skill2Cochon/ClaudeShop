import type {
  AppendAuditLogInput,
  AuditLogRepository,
} from '@claudeshop/core';
import type { FastifyRequest } from 'fastify';

/**
 * Append a row to the audit log. Wraps the repository call in a try/catch so
 * an audit-layer hiccup never blocks the underlying mutation — the audit
 * trail is best-effort observable, not a gate.
 *
 * Prefer the request-aware variant `recordFromRequest` when a FastifyRequest
 * is available — it pulls ip/userAgent/requestId automatically.
 */
export async function recordAudit(
  repo: AuditLogRepository,
  tenantId: string,
  input: AppendAuditLogInput,
  logger?: { warn: (obj: unknown, msg?: string) => void },
): Promise<void> {
  try {
    await repo.append(tenantId, input);
  } catch (err) {
    logger?.warn(
      { err, tenantId, action: input.action, resourceId: input.resourceId },
      'Failed to append audit log entry',
    );
  }
}

/** Derive standard actor context from a FastifyRequest, then append. */
export async function recordFromRequest(
  repo: AuditLogRepository,
  request: FastifyRequest,
  tenantId: string,
  partial: Omit<AppendAuditLogInput, 'ip' | 'userAgent' | 'requestId'>,
): Promise<void> {
  const headers = request.headers as Record<string, string | string[] | undefined>;
  const userAgent =
    typeof headers['user-agent'] === 'string' ? (headers['user-agent'] as string) : null;

  await recordAudit(
    repo,
    tenantId,
    {
      ...partial,
      ip: request.ip ?? null,
      userAgent,
      requestId: request.id,
    },
    request.log,
  );
}
