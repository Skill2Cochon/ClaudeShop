import { NotFoundError } from '@claudeshop/errors';
import type { CustomerRepository } from '../ports/customer-repository.js';
import type { CustomerSegmentRepository } from '../ports/customer-segment-repository.js';
import type { Clock } from '../ports/clock.js';

export interface ComputeSegmentMembersDeps {
  tenantId: string;
  segmentRepo: CustomerSegmentRepository;
  customerRepo: CustomerRepository;
  clock: Clock;
}

export interface ComputeSegmentMembersResult {
  segmentId: string;
  customerCount: number;
  refreshedAt: string;
}

/**
 * Recompute the customer count for a segment by re-evaluating its rules
 * against the customer table. Persists the new count + refreshedAt so the
 * /segments list shows fresh numbers.
 *
 * Cheap to call — meant to run on every save and on a daily cron.
 */
export async function computeSegmentMembers(
  segmentId: string,
  deps: ComputeSegmentMembersDeps,
): Promise<ComputeSegmentMembersResult> {
  const segment = await deps.segmentRepo.findById(deps.tenantId, segmentId);
  if (!segment) throw new NotFoundError(`Segment ${segmentId} not found`);

  const { total } = await deps.customerRepo.findSegmentMembers(
    deps.tenantId,
    segment.rules,
    { page: 1, limit: 1 },
  );
  const refreshedAt = deps.clock.now();
  await deps.segmentRepo.setCount(deps.tenantId, segmentId, total, refreshedAt);

  return {
    segmentId,
    customerCount: total,
    refreshedAt: refreshedAt.toISOString(),
  };
}
