import {
  CreatePurchaseOrderInputSchema,
  type CreatePurchaseOrderInput,
  type PurchaseOrder,
} from '@claudeshop/contracts/erp';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { PurchaseOrderRepository } from '../ports/purchase-order-repository.js';
import type { SupplierRepository } from '../ports/supplier-repository.js';
import type { Clock } from '../ports/clock.js';

export interface CreatePurchaseOrderDeps {
  tenantId: string;
  supplierRepo: SupplierRepository;
  repo: PurchaseOrderRepository;
  clock: Clock;
  /** Prefix for auto-generated PO numbers. Defaults to "PO". */
  numberPrefix?: string;
}

/**
 * Draft a new purchase order. Validates the supplier, checks currency
 * agreement, computes subtotal + total from lines (+ optional shipping/tax),
 * and persists via the repo. Status starts DRAFT; use markSent + receive
 * to move through the lifecycle.
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  deps: CreatePurchaseOrderDeps,
): Promise<PurchaseOrder> {
  const parsed = CreatePurchaseOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid purchase order input', {
      details: parsed.error.issues,
    });
  }

  const supplier = await deps.supplierRepo.findById(deps.tenantId, parsed.data.supplierId);
  if (!supplier) {
    throw new NotFoundError(`Supplier ${parsed.data.supplierId} not found`);
  }
  if (!supplier.isActive) {
    throw new ValidationError(`Supplier "${supplier.name}" is inactive`);
  }
  if (supplier.currency !== parsed.data.currency) {
    throw new ValidationError(
      `Purchase order currency (${parsed.data.currency}) must match supplier currency (${supplier.currency})`,
    );
  }

  // Compute line subtotals + PO subtotal/total in minor units.
  const linesWithTotals = parsed.data.lines.map((l) => {
    const unitCents = toCents(l.unitCost);
    const subtotalCents = unitCents * BigInt(l.qtyOrdered);
    return { ...l, subtotal: fromCents(subtotalCents), subtotalCents };
  });
  const subtotalCents = linesWithTotals.reduce(
    (acc, l) => acc + l.subtotalCents,
    0n,
  );
  const shippingCents = parsed.data.shipping ? toCents(parsed.data.shipping) : 0n;
  const taxCents = parsed.data.tax ? toCents(parsed.data.tax) : 0n;
  const totalCents = subtotalCents + shippingCents + taxCents;

  const prefix = deps.numberPrefix ?? 'PO';
  const number = `${prefix}-${deps.clock.now().getTime().toString(36).toUpperCase()}`;

  return deps.repo.create(deps.tenantId, {
    ...parsed.data,
    number,
    subtotal: fromCents(subtotalCents),
    total: fromCents(totalCents),
  });
}

function toCents(money: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(money.trim());
  if (!match) throw new Error(`Invalid money value: "${money}"`);
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]!);
  const fractional = BigInt((match[3] ?? '').padEnd(2, '0'));
  return sign * (whole * 100n + fractional);
}

function fromCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const fractional = abs % 100n;
  return `${sign}${whole.toString()}.${fractional.toString().padStart(2, '0')}`;
}
