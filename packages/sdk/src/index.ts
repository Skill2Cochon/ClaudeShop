/**
 * @claudeshop/sdk
 *
 * TypeScript client for the ClaudeShop API (REST + GraphQL).
 *
 * Phase 1 : manual handwritten skeleton with a minimal health probe.
 * Phase 2+: replaced by `openapi-typescript` + `openapi-fetch` generated code
 *           (from apps/api/openapi.json) for REST, and `graphql-codegen` for
 *           GraphQL operations.
 */

export { createClient, type ClaudeShopClient, type ClientOptions } from './client.js';
