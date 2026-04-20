import { EventEmitter } from 'eventemitter3';
import { EVENT_TOPICS, type TopicName } from '@claudeshop/contracts/events';
import { EventBus } from './bus.js';
import type { EmitOpts, Handler, SubOpts, TopicPayload, Unsubscribe } from './types.js';

/**
 * In-process EventBus implementation. Useful for dev, tests, and sync topics.
 * Production uses OutboxEventBus that persists async events via BullMQ.
 */
export class InMemoryEventBus extends EventBus {
  private readonly emitter = new EventEmitter();

  override async emit<T extends TopicName>(
    topic: T,
    payload: TopicPayload<T>,
    _opts?: EmitOpts,
  ): Promise<void> {
    const topicSpec = EVENT_TOPICS[topic];
    if (!topicSpec) {
      throw new Error(`Unknown topic: ${topic}`);
    }
    const parsed = topicSpec.schema.parse(payload);
    // EventEmitter3 calls handlers synchronously; await Promise.resolve for consistency.
    this.emitter.emit(topic, parsed);
    await Promise.resolve();
  }

  override on<T extends TopicName>(
    topic: T,
    handler: Handler<T>,
    _opts?: SubOpts,
  ): Unsubscribe {
    this.emitter.on(topic, handler as (payload: unknown) => void);
    return () => this.emitter.off(topic, handler as (payload: unknown) => void);
  }

  override once<T extends TopicName>(topic: T, handler: Handler<T>): Unsubscribe {
    this.emitter.once(topic, handler as (payload: unknown) => void);
    return () => this.emitter.off(topic, handler as (payload: unknown) => void);
  }

  /** Test helper — remove all listeners. */
  public reset(): void {
    this.emitter.removeAllListeners();
  }
}
