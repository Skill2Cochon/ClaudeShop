import type {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '@claudeshop/contracts/webhook';

export interface CreateWebhookDeliveryInput {
  subscriptionId: string;
  eventType: string;
  eventId: string;
  payload: unknown;
}

export interface RecordAttemptInput {
  status: WebhookDeliveryStatus;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  attemptedAt: Date;
  deliveredAt?: Date;
}

export interface WebhookDeliveryRepository {
  findById(tenantId: string, id: string): Promise<WebhookDelivery | null>;
  list(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      status?: WebhookDeliveryStatus;
      eventType?: string;
      subscriptionId?: string;
    },
  ): Promise<{ items: WebhookDelivery[]; total: number }>;

  /**
   * Idempotent insert keyed on (subscriptionId, eventId). Returns the
   * existing row when a duplicate event arrives (e.g. retry storm) so the
   * dispatcher can short-circuit without double-POSTing.
   */
  upsert(
    tenantId: string,
    input: CreateWebhookDeliveryInput,
  ): Promise<{ delivery: WebhookDelivery; isNew: boolean }>;

  recordAttempt(
    tenantId: string,
    id: string,
    attempt: RecordAttemptInput,
  ): Promise<WebhookDelivery>;
}
