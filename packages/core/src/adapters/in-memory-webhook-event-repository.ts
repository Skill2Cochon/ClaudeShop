import type { WebhookEventRepository } from '../ports/webhook-event-repository.js';

export class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private readonly processed = new Set<string>();

  async alreadyProcessed(provider: string, eventId: string): Promise<boolean> {
    return this.processed.has(this.key(provider, eventId));
  }

  async recordProcessed(entry: {
    tenantId: string;
    provider: string;
    eventId: string;
    eventType: string;
    orderId?: string;
  }): Promise<void> {
    const k = this.key(entry.provider, entry.eventId);
    if (this.processed.has(k)) {
      throw new Error(`Webhook event already processed: ${k}`);
    }
    this.processed.add(k);
  }

  private key(provider: string, eventId: string): string {
    return `${provider}\x1f${eventId}`;
  }

  public reset(): void {
    this.processed.clear();
  }

  public size(): number {
    return this.processed.size;
  }
}
