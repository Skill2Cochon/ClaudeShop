/**
 * Records processed webhook events so duplicate deliveries from the PSP
 * can be detected and short-circuited. Unique per (provider, eventId).
 */
export interface WebhookEventRepository {
  /** Returns true if this (provider, eventId) has already been processed. */
  alreadyProcessed(provider: string, eventId: string): Promise<boolean>;

  /**
   * Record a processed event. Throws if the (provider, eventId) pair already
   * exists — callers should treat this as "already processed" and skip work.
   */
  recordProcessed(entry: {
    tenantId: string;
    provider: string;
    eventId: string;
    eventType: string;
    orderId?: string;
  }): Promise<void>;
}
