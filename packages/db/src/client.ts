import { PrismaClient } from '../generated/client/index';

export type { PrismaClient };

/**
 * Build a PrismaClient with the RLS-aware $extends middleware.
 * Every query must run inside a transaction that `SET LOCAL app.tenant_id`
 * at the start — use `withTenant()` to do that safely.
 */
export function createPrismaClient(options?: { datasourceUrl?: string }): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: options?.datasourceUrl ?? process.env.DATABASE_URL,
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
    errorFormat: 'minimal',
  });
  return client;
}

// Accepts either a Cuid (c...) or a UUID — the two id formats ClaudeShop uses
// for Tenant rows. Keeping the regex tight means `$executeRawUnsafe` below
// can never concatenate attacker-controlled characters into the SQL string.
const TENANT_ID_PATTERN = /^(?:c[a-z0-9]{24,}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/**
 * Run a callback inside a transaction with `app.tenant_id` set so that
 * Postgres RLS policies resolve against the correct tenant.
 *
 * Security notes:
 * - `tenantId` is strictly validated against {@link TENANT_ID_PATTERN} before
 *   it ever reaches `$executeRawUnsafe`. This is the cheapest defence against
 *   anyone smuggling quote/semicolon characters into the SET LOCAL statement.
 * - The statement is then parameter-less (no user input interpolated) because
 *   the regex guarantees alphanumerics / dashes only.
 *
 * @throws if tenantId is missing or doesn't match the Cuid/UUID shape.
 */
export async function withTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!tenantId || typeof tenantId !== 'string' || !TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error('withTenant: tenantId is required and must be a valid Cuid or UUID');
  }
  return prisma.$transaction(async (tx) => {
    // Safe: tenantId has been regex-validated to alphanumerics/dashes only.
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return fn(tx as PrismaClient);
  });
}
