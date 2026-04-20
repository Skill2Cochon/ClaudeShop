import { z } from 'zod';

/**
 * Environment schema — validated at boot. Boot fails fast on missing/invalid.
 * Never use process.env directly in the app — always go through the parsed object.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // API
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Meilisearch
  MEILISEARCH_URL: z.string().url().default('http://localhost:7700'),
  MEILISEARCH_MASTER_KEY: z.string().min(8),

  // Auth
  AUTH_SECRET: z.string().min(32),
  // Default tenant used when no x-tenant-id header is present (Phase 5 dev
  // convenience; Phase 5.1 removes this in favour of subdomain/session).
  DEFAULT_TENANT_ID: z.string().optional(),

  // Stripe (optional in dev)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Claude API (optional in Phase 1)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

  // Voyage AI embeddings (optional — stub fallback when absent)
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_MODEL: z.string().default('voyage-3-large'),
  VOYAGE_DIMENSIONS: z.coerce.number().int().positive().default(1024),

  // Email (Phase 11) — falls back to stub provider when absent
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@claudeshop.local'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${formatted}\n\nCopy .env.example to .env and fill in required values.`,
    );
  }
  return result.data;
}
