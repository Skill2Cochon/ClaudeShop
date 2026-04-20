import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  buildDefaultCopilotRegistry,
  runCopilot,
  type AIProvider,
  type AnalyticsRepository,
  type ChatProvider,
  type EmbeddingProvider,
  type ModuleInstallationRepository,
  type OrderRepository,
  type ProductRepository,
  type SearchRepository,
} from '@claudeshop/core';

export interface AdminCopilotRoutesDeps {
  chatProvider: ChatProvider;
  productRepo: ProductRepository;
  orderRepo: OrderRepository;
  moduleRepo: ModuleInstallationRepository;
  searchRepo: SearchRepository;
  embedder: EmbeddingProvider;
  ai: AIProvider;
  analytics: AnalyticsRepository;
  resolveTenantId: (request: { headers: Record<string, unknown> }) => string;
}

/**
 * Admin Copilot — Claude-native merchant sidebar.
 *
 * POST /v1/admin/copilot/chat
 *   body: { message, history?, contextHint? }
 *   response: { data: { text, toolInvocations, model, usage, truncated, tools } }
 *
 * Phase 4.3 MVP: read-only tools only. Phase 4.3b adds mutating tools with
 * confirm-before-execute (the route will return a pending action preview the
 * UI can surface for the merchant to approve).
 */
export async function registerAdminCopilotRoutes(
  app: FastifyInstance,
  deps: AdminCopilotRoutesDeps,
): Promise<void> {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  const HistoryTurnSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  });

  const BodySchema = z.object({
    message: z.string().trim().min(1),
    history: z.array(HistoryTurnSchema).max(50).optional(),
    contextHint: z.string().max(400).optional(),
    allowMutations: z.boolean().optional(),
  });

  const ToolInvocationSchema = z.object({
    name: z.string(),
    input: z.unknown(),
    output: z.string(),
    error: z.boolean(),
  });

  const ToolInfoSchema = z.object({
    name: z.string(),
    description: z.string(),
    risk: z.enum(['read', 'mutating']),
  });

  const ResponseSchema = z.object({
    data: z.object({
      text: z.string(),
      toolInvocations: z.array(ToolInvocationSchema),
      model: z.string(),
      usage: z.object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        cachedInputTokens: z.number().optional(),
      }),
      truncated: z.boolean(),
      tools: z.array(ToolInfoSchema),
      writeUnlocked: z.boolean(),
    }),
  });

  zApp.post(
    '/v1/admin/copilot/chat',
    {
      schema: {
        body: BodySchema,
        response: { 200: ResponseSchema },
      },
    },
    async (request) => {
      const tenantId = deps.resolveTenantId({
        headers: request.headers as Record<string, unknown>,
      });

      const fullRegistry = buildDefaultCopilotRegistry({
        tenantId,
        productRepo: deps.productRepo,
        orderRepo: deps.orderRepo,
        moduleRepo: deps.moduleRepo,
        searchRepo: deps.searchRepo,
        embedder: deps.embedder,
        ai: deps.ai,
        analytics: deps.analytics,
      });

      const allowMutations = request.body.allowMutations ?? false;
      const activeRegistry = allowMutations ? fullRegistry : fullRegistry.readOnly();

      const result = await runCopilot(
        {
          message: request.body.message,
          allowMutations,
          ...(request.body.history !== undefined ? { history: request.body.history } : {}),
          ...(request.body.contextHint !== undefined
            ? { contextHint: request.body.contextHint }
            : {}),
        },
        {
          tenantId,
          chatProvider: deps.chatProvider,
          tools: fullRegistry,
        },
      );

      return {
        data: {
          text: result.text,
          toolInvocations: result.toolInvocations,
          model: result.model,
          usage: result.usage,
          truncated: result.truncated,
          // Surface only the tools actually available for this session so the
          // UI doesn't pretend mutating tools are reachable when writes are
          // locked.
          tools: activeRegistry.listMetadata(),
          writeUnlocked: allowMutations,
        },
      };
    },
  );
}
