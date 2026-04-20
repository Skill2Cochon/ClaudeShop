import type { TopicName, EVENT_TOPICS } from '@claudeshop/contracts/events';
import type { z } from 'zod';

export type TopicPayload<T extends TopicName> = z.infer<(typeof EVENT_TOPICS)[T]['schema']>;

export type EmitOpts = {
  /** Force async delivery even if topic defaults to sync. */
  deferred?: boolean;
  /** Correlate with a parent trace or transaction. */
  correlationId?: string;
};

export type SubOpts = {
  /** Priority for sync handlers (higher runs first). Default 0. */
  priority?: number;
  /** Unique id for the subscription — used by hot-reload to replace handlers. */
  id?: string;
};

export type Handler<T extends TopicName> = (payload: TopicPayload<T>) => void | Promise<void>;

export type Unsubscribe = () => void;
