import { describe, expect, it, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@claudeshop/contracts/erp';
import type {
  PurchaseOrderRepository,
  ReceivePurchaseOrderLinePatch,
} from '../ports/purchase-order-repository';
import type { InventoryRepository, StockReservation } from '../ports/inventory-repository';
import type { Clock } from '../ports/clock';
import { receivePurchaseOrder } from './receive-purchase-order';

class InMemoryPORepository implements PurchaseOrderRepository {
  private readonly pos = new Map<string, PurchaseOrder>();

  seed(po: PurchaseOrder): void {
    this.pos.set(po.id, po);
  }

  async findById(tenantId: string, id: string): Promise<PurchaseOrder | null> {
    const p = this.pos.get(id);
    return p && p.tenantId === tenantId ? p : null;
  }

  async list(): Promise<{ items: PurchaseOrder[]; total: number }> {
    throw new Error('not used in tests');
  }

  async create(): Promise<PurchaseOrder> {
    throw new Error('not used in tests');
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: PurchaseOrderStatus,
    opts?: { placedAt?: Date; receivedAt?: Date },
  ): Promise<PurchaseOrder> {
    const po = this.pos.get(id);
    if (!po || po.tenantId !== tenantId) throw new NotFoundError(`PO ${id}`);
    const next: PurchaseOrder = {
      ...po,
      status,
      ...(opts?.placedAt ? { placedAt: opts.placedAt.toISOString() } : {}),
      ...(opts?.receivedAt ? { receivedAt: opts.receivedAt.toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.pos.set(id, next);
    return next;
  }

  async applyReceivedQuantities(
    tenantId: string,
    id: string,
    patches: ReceivePurchaseOrderLinePatch[],
  ): Promise<PurchaseOrder> {
    const po = this.pos.get(id);
    if (!po || po.tenantId !== tenantId) throw new NotFoundError(`PO ${id}`);
    const byId = new Map(patches.map((p) => [p.lineId, p.qty]));
    const next: PurchaseOrder = {
      ...po,
      lines: po.lines.map((l) => {
        const add = byId.get(l.id);
        return add ? { ...l, qtyReceived: l.qtyReceived + add } : l;
      }),
      updatedAt: new Date().toISOString(),
    };
    this.pos.set(id, next);
    return next;
  }
}

class RecordingInventoryRepository implements InventoryRepository {
  onHandIncrements: StockReservation[][] = [];

  async reserveStock(): Promise<void> {
    throw new Error('not used');
  }
  async releaseStock(): Promise<void> {
    throw new Error('not used');
  }
  async commitReservation(): Promise<void> {
    throw new Error('not used');
  }
  async incrementOnHand(_tenantId: string, increments: StockReservation[]): Promise<void> {
    this.onHandIncrements.push(increments.map((i) => ({ ...i })));
  }
}

class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
  nowIso(): string {
    return this.fixed.toISOString();
  }
}

function makePO(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  const now = new Date('2026-04-19T00:00:00.000Z').toISOString();
  const baseLines: PurchaseOrder['lines'] = [
    {
      id: 'cml10000000000000000000001',
      purchaseOrderId: 'po1',
      variantId: 'vA',
      sku: 'TEE-S-BLK',
      qtyOrdered: 10,
      qtyReceived: 0,
      unitCost: '5.00',
      subtotal: '50.00',
    },
    {
      id: 'cml20000000000000000000002',
      purchaseOrderId: 'po1',
      variantId: 'vB',
      sku: 'TEE-M-BLK',
      qtyOrdered: 5,
      qtyReceived: 0,
      unitCost: '5.00',
      subtotal: '25.00',
    },
  ];
  return {
    id: 'po1',
    tenantId: 'tnt01h0000000000000000000',
    supplierId: 'sup1',
    number: 'PO-TEST',
    status: 'SENT',
    currency: 'EUR',
    subtotal: '75.00',
    shipping: '0.00',
    tax: '0.00',
    total: '75.00',
    expectedAt: null,
    placedAt: now,
    receivedAt: null,
    notes: null,
    lines: baseLines,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('receivePurchaseOrder use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let repo: InMemoryPORepository;
  let inventoryRepo: RecordingInventoryRepository;
  const clock = new FixedClock(new Date('2026-04-20T10:00:00.000Z'));

  beforeEach(() => {
    repo = new InMemoryPORepository();
    inventoryRepo = new RecordingInventoryRepository();
  });

  it('increments InventoryItem.onHand per variant and marks PO RECEIVED when fully received', async () => {
    repo.seed(makePO());
    const result = await receivePurchaseOrder(
      'po1',
      {
        lines: [
          { lineId: 'cml10000000000000000000001', qty: 10 },
          { lineId: 'cml20000000000000000000002', qty: 5 },
        ],
      },
      { tenantId, repo, inventoryRepo, clock },
    );

    expect(result.status).toBe('RECEIVED');
    expect(result.receivedAt).toBe('2026-04-20T10:00:00.000Z');
    expect(inventoryRepo.onHandIncrements).toHaveLength(1);
    expect(inventoryRepo.onHandIncrements[0]).toEqual(
      expect.arrayContaining([
        { variantId: 'vA', qty: 10 },
        { variantId: 'vB', qty: 5 },
      ]),
    );
  });

  it('marks PO PARTIAL when some quantity remains outstanding', async () => {
    repo.seed(makePO());
    const result = await receivePurchaseOrder(
      'po1',
      { lines: [{ lineId: 'cml10000000000000000000001', qty: 4 }] },
      { tenantId, repo, inventoryRepo, clock },
    );
    expect(result.status).toBe('PARTIAL');
    expect(result.receivedAt).toBeNull();
    const line1 = result.lines.find((l) => l.id === 'cml10000000000000000000001');
    expect(line1?.qtyReceived).toBe(4);
  });

  it('supports incremental receiving on an already-PARTIAL PO', async () => {
    repo.seed(makePO({ status: 'PARTIAL', lines: [
      {
        id: 'cml10000000000000000000001',
        purchaseOrderId: 'po1',
        variantId: 'vA',
        sku: 'TEE-S-BLK',
        qtyOrdered: 10,
        qtyReceived: 4,
        unitCost: '5.00',
        subtotal: '50.00',
      },
    ] }));
    const result = await receivePurchaseOrder(
      'po1',
      { lines: [{ lineId: 'cml10000000000000000000001', qty: 6 }] },
      { tenantId, repo, inventoryRepo, clock },
    );
    expect(result.status).toBe('RECEIVED');
    const line = result.lines[0]!;
    expect(line.qtyReceived).toBe(10);
    expect(inventoryRepo.onHandIncrements[0]).toEqual([
      { variantId: 'vA', qty: 6 },
    ]);
  });

  it('merges duplicate patches targeting the same variant', async () => {
    repo.seed(makePO({
      lines: [
        {
          id: 'cml10000000000000000000001',
          purchaseOrderId: 'po1',
          variantId: 'vSame',
          sku: 'X',
          qtyOrdered: 5,
          qtyReceived: 0,
          unitCost: '1.00',
          subtotal: '5.00',
        },
        {
          id: 'cml20000000000000000000002',
          purchaseOrderId: 'po1',
          variantId: 'vSame',
          sku: 'Y',
          qtyOrdered: 5,
          qtyReceived: 0,
          unitCost: '1.00',
          subtotal: '5.00',
        },
      ],
    }));
    await receivePurchaseOrder(
      'po1',
      {
        lines: [
          { lineId: 'cml10000000000000000000001', qty: 3 },
          { lineId: 'cml20000000000000000000002', qty: 2 },
        ],
      },
      { tenantId, repo, inventoryRepo, clock },
    );
    expect(inventoryRepo.onHandIncrements[0]).toEqual([
      { variantId: 'vSame', qty: 5 },
    ]);
  });

  it('rejects over-receiving (qty + qtyReceived > qtyOrdered)', async () => {
    repo.seed(makePO());
    await expect(
      receivePurchaseOrder(
        'po1',
        { lines: [{ lineId: 'cml10000000000000000000001', qty: 11 }] },
        { tenantId, repo, inventoryRepo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    // Inventory MUST NOT have been touched on rejection.
    expect(inventoryRepo.onHandIncrements).toHaveLength(0);
  });

  it('rejects patches that reference lines on other purchase orders', async () => {
    repo.seed(makePO());
    await expect(
      receivePurchaseOrder(
        'po1',
        { lines: [{ lineId: 'cmlGHOST00000000000000000003', qty: 1 }] },
        { tenantId, repo, inventoryRepo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects receiving a DRAFT or RECEIVED or CANCELLED PO', async () => {
    for (const status of ['DRAFT', 'RECEIVED', 'CANCELLED'] as const) {
      repo.seed(makePO({ id: `po-${status}`, status }));
      await expect(
        receivePurchaseOrder(
          `po-${status}`,
          { lines: [{ lineId: 'cml10000000000000000000001', qty: 1 }] },
          { tenantId, repo, inventoryRepo, clock },
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it('throws NotFoundError for unknown purchase orders', async () => {
    await expect(
      receivePurchaseOrder(
        'poGHOST',
        { lines: [{ lineId: 'cml10000000000000000000001', qty: 1 }] },
        { tenantId, repo, inventoryRepo, clock },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects zero-length receive lists via Zod', async () => {
    repo.seed(makePO());
    await expect(
      receivePurchaseOrder(
        'po1',
        { lines: [] },
        { tenantId, repo, inventoryRepo, clock },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
