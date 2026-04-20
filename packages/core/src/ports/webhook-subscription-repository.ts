import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookSubscription,
} from '@claudeshop/contracts/webhook';

export interface WebhookSubscriptionRepository {
  findById(tenantId: string, id: string): Promise<WebhookSubscription | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number },
  ): Promise<{ items: WebhookSubscription[]; total: number }>;
  /**
   * All ACTIVE subscriptions for the tenant whose `events` array contains
   * the given event name. Used by the dispatcher fan-out.
   */
  findActiveForEvent(
    tenantId: string,
    eventType: string,
  ): Promise<WebhookSubscription[]>;
  create(
    tenantId: string,
    input: CreateWebhookSubscriptionInput & { secret: string },
  ): Promise<WebhookSubscription>;
  update(
    tenantId: string,
    id: string,
    input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscription>;
  delete(tenantId: string, id: string): Promise<void>;
}
