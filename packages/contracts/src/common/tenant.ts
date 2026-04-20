import { z } from 'zod';
import { CuidSchema, SlugSchema } from './primitives';

export const TenantPlanSchema = z.enum(['free', 'pro', 'business', 'enterprise']);

export const TenantSchema = z.object({
  id: CuidSchema,
  slug: SlugSchema,
  plan: TenantPlanSchema,
  createdAt: z.string().datetime(),
  settings: z.record(z.unknown()).default({}),
});

export type TenantPlan = z.infer<typeof TenantPlanSchema>;
export type Tenant = z.infer<typeof TenantSchema>;
