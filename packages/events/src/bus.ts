import type { TopicName } from '@claudeshop/contracts/events';
import type { EmitOpts, Handler, SubOpts, TopicPayload, Unsubscribe } from './types';

/**
 * EventBus — typed pub/sub abstraction.
 *
 * Implementations:
 *   - InMemoryEventBus (packages/events/src/in-memory-bus.ts) — synchronous EventEmitter3
 *   - OutboxEventBus   (apps/api/src/events/outbox-bus.ts)    — Prisma outbox + BullMQ (async)
 *
 * The API is always awaitable so callers do not couple to delivery mode.
 */
export abstract class EventBus {
  abstract emit<T extends TopicName>(
    topic: T,
    payload: TopicPayload<T>,
    opts?: EmitOpts,
  ): Promise<void>;

  abstract on<T extends TopicName>(
    topic: T,
    handler: Handler<T>,
    opts?: SubOpts,
  ): Unsubscribe;

  abstract once<T extends TopicName>(
    topic: T,
    handler: Handler<T>,
  ): Unsubscribe;
}
