/**
 * @claudeshop/core
 *
 * Pure TypeScript domain layer — no Prisma, no Fastify, no Next.js.
 * Consumes @claudeshop/contracts (Zod) + @claudeshop/errors (typed errors)
 * and exposes use-cases as dependency-inverted functions.
 *
 * Ports (interfaces) live alongside use-cases; adapters (Prisma, Stripe, etc.)
 * live in apps/api. Framework-free reference adapters (in-memory stores,
 * fakes) ship under `adapters/`.
 */

export * from './ports/index';
export * from './usecases/index';
export * from './adapters/index';
export * from './copilot/index';
export * from './utils/index';
export * from './email-templates/index';
