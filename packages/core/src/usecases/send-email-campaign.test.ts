import { describe, expect, it, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type {
  CreateEmailCampaignInput,
  CreateSegmentInput,
  CustomerSegment,
  EmailCampaign,
  EmailCampaignStatus,
  SegmentRule,
  UpdateEmailCampaignInput,
  UpdateSegmentInput,
} from '@claudeshop/contracts/crm';
import type {
  CustomerRepository,
  SegmentMember,
} from '../ports/customer-repository';
import type { CustomerSegmentRepository } from '../ports/customer-segment-repository';
import type { EmailCampaignRepository } from '../ports/email-campaign-repository';
import type { Clock } from '../ports/clock';
import { StubEmailProvider } from '../adapters/stub-email-provider';
import { sendEmailCampaign } from './send-email-campaign';

class InMemorySegmentRepo implements CustomerSegmentRepository {
  private readonly rows = new Map<string, CustomerSegment>();
  private counter = 0;

  seed(rows: Array<Partial<CustomerSegment> & { tenantId: string; name: string }>): void {
    for (const r of rows) {
      this.counter++;
      const now = new Date().toISOString();
      const id = r.id ?? `seg${String(this.counter).padStart(22, '0')}`;
      const segment: CustomerSegment = {
        id,
        tenantId: r.tenantId,
        name: r.name,
        description: r.description ?? null,
        rules: r.rules ?? {},
        customerCount: r.customerCount ?? 0,
        refreshedAt: r.refreshedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.rows.set(id, segment);
    }
  }

  async findById(tenantId: string, id: string): Promise<CustomerSegment | null> {
    const r = this.rows.get(id);
    return r && r.tenantId === tenantId ? r : null;
  }
  async list(): Promise<{ items: CustomerSegment[]; total: number }> {
    return { items: [], total: 0 };
  }
  async create(_tenantId: string, _input: CreateSegmentInput): Promise<CustomerSegment> {
    throw new Error('not used');
  }
  async update(
    _tenantId: string,
    _id: string,
    _input: UpdateSegmentInput,
  ): Promise<CustomerSegment> {
    throw new Error('not used');
  }
  async delete(): Promise<void> {
    /* noop */
  }
  async setCount(
    _tenantId: string,
    id: string,
    count: number,
    refreshedAt: Date,
  ): Promise<CustomerSegment> {
    const r = this.rows.get(id)!;
    r.customerCount = count;
    r.refreshedAt = refreshedAt.toISOString();
    return r;
  }
}

class InMemoryCampaignRepo implements EmailCampaignRepository {
  private readonly rows = new Map<string, EmailCampaign>();
  public finaliseCalls: Array<{
    id: string;
    status: EmailCampaignStatus;
    sentCount: number;
    failedCount: number;
  }> = [];

  seed(c: EmailCampaign): void {
    this.rows.set(c.id, c);
  }

  async findById(tenantId: string, id: string): Promise<EmailCampaign | null> {
    const r = this.rows.get(id);
    return r && r.tenantId === tenantId ? r : null;
  }
  async list(): Promise<{ items: EmailCampaign[]; total: number }> {
    return { items: [], total: 0 };
  }
  async create(_tenantId: string, _input: CreateEmailCampaignInput): Promise<EmailCampaign> {
    throw new Error('not used');
  }
  async update(
    _tenantId: string,
    _id: string,
    _input: UpdateEmailCampaignInput,
  ): Promise<EmailCampaign> {
    throw new Error('not used');
  }
  async delete(): Promise<void> {
    /* noop */
  }
  async finaliseSend(
    _tenantId: string,
    id: string,
    patch: {
      status: EmailCampaignStatus;
      sentAt?: Date;
      sentCount: number;
      failedCount: number;
    },
  ): Promise<EmailCampaign> {
    const r = this.rows.get(id)!;
    r.status = patch.status;
    r.sentCount = patch.sentCount;
    r.failedCount = patch.failedCount;
    if (patch.sentAt) r.sentAt = patch.sentAt.toISOString();
    this.finaliseCalls.push({
      id,
      status: patch.status,
      sentCount: patch.sentCount,
      failedCount: patch.failedCount,
    });
    return r;
  }
}

class CannedCustomerRepo implements CustomerRepository {
  constructor(private readonly members: SegmentMember[]) {}
  async findById(): Promise<null> {
    return null;
  }
  async findByEmail(): Promise<null> {
    return null;
  }
  async create(): Promise<never> {
    throw new Error('not used');
  }
  async findSegmentMembers(
    _tenantId: string,
    _rules: SegmentRule,
    opts?: { page?: number; limit?: number },
  ): Promise<{ items: SegmentMember[]; total: number }> {
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 200;
    const start = (page - 1) * limit;
    return {
      items: this.members.slice(start, start + limit),
      total: this.members.length,
    };
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

function makeCampaign(overrides: Partial<EmailCampaign> = {}): EmailCampaign {
  const now = new Date('2026-04-19T08:00:00.000Z').toISOString();
  return {
    id: 'cmp10000000000000000000001',
    tenantId: 'tnt01h0000000000000000000',
    name: 'Spring sale',
    subject: 'Hello {{name}}',
    bodyMd: '# Hi\n\nCheck out our **new arrivals** today.',
    segmentId: 'seg00000000000000000000001',
    status: 'DRAFT',
    scheduledAt: null,
    sentAt: null,
    sentCount: 0,
    failedCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('sendEmailCampaign use-case', () => {
  const tenantId = 'tnt01h0000000000000000000';
  let segmentRepo: InMemorySegmentRepo;
  let campaignRepo: InMemoryCampaignRepo;
  let email: StubEmailProvider;
  const clock = new FixedClock(new Date('2026-04-19T10:00:00.000Z'));

  beforeEach(() => {
    segmentRepo = new InMemorySegmentRepo();
    segmentRepo.seed([
      { id: 'seg00000000000000000000001', tenantId, name: 'B2B', rules: {} },
    ]);
    campaignRepo = new InMemoryCampaignRepo();
    email = new StubEmailProvider();
  });

  it('sends to every member of the segment and marks SENT', async () => {
    campaignRepo.seed(makeCampaign());
    const customerRepo = new CannedCustomerRepo([
      { customerId: 'c1', email: 'a@shop.local' },
      { customerId: 'c2', email: 'b@shop.local' },
      { customerId: 'c3', email: 'c@shop.local' },
    ]);

    const result = await sendEmailCampaign('cmp10000000000000000000001', {
      tenantId,
      campaignRepo,
      segmentRepo,
      customerRepo,
      email,
      clock,
      fromAddress: 'no-reply@shop.local',
    });

    expect(result.status).toBe('SENT');
    expect(result.sentCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.sentAt).toBe('2026-04-19T10:00:00.000Z');
    expect(email.allSent).toHaveLength(1);
    expect(email.lastSent?.recipients.map((r) => r.email)).toEqual([
      'a@shop.local',
      'b@shop.local',
      'c@shop.local',
    ]);
    expect(email.lastSent?.html).toContain('<h1>Hi</h1>');
    expect(email.lastSent?.html).toContain('<strong>new arrivals</strong>');
  });

  it('pages through large segments via batchSize', async () => {
    campaignRepo.seed(makeCampaign({ id: 'cmp22222222222222222222222' }));
    const members = Array.from({ length: 5 }, (_, i) => ({
      customerId: `c${i}`,
      email: `r${i}@shop.local`,
    }));
    const customerRepo = new CannedCustomerRepo(members);

    await sendEmailCampaign('cmp22222222222222222222222', {
      tenantId,
      campaignRepo,
      segmentRepo,
      customerRepo,
      email,
      clock,
      fromAddress: 'no-reply@shop.local',
      batchSize: 2,
    });

    // 5 members, batch 2 → 3 calls (2 + 2 + 1).
    expect(email.allSent).toHaveLength(3);
    expect(campaignRepo.finaliseCalls.at(-1)?.sentCount).toBe(5);
  });

  it('rejects sending an already-SENT campaign', async () => {
    campaignRepo.seed(makeCampaign({ status: 'SENT' }));
    await expect(
      sendEmailCampaign('cmp10000000000000000000001', {
        tenantId,
        campaignRepo,
        segmentRepo,
        customerRepo: new CannedCustomerRepo([]),
        email,
        clock,
        fromAddress: 'no-reply@shop.local',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when no segment is assigned', async () => {
    campaignRepo.seed(makeCampaign({ segmentId: null }));
    await expect(
      sendEmailCampaign('cmp10000000000000000000001', {
        tenantId,
        campaignRepo,
        segmentRepo,
        customerRepo: new CannedCustomerRepo([]),
        email,
        clock,
        fromAddress: 'no-reply@shop.local',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError for an unknown campaign', async () => {
    await expect(
      sendEmailCampaign('cmpGHOSTGHOSTGHOSTGHOSTGH', {
        tenantId,
        campaignRepo,
        segmentRepo,
        customerRepo: new CannedCustomerRepo([]),
        email,
        clock,
        fromAddress: 'no-reply@shop.local',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('marks the campaign FAILED when the provider throws (config error)', async () => {
    campaignRepo.seed(makeCampaign({ id: 'cmp33333333333333333333333' }));
    class ExplodingEmail extends StubEmailProvider {
      override async send(): Promise<never> {
        throw new Error('Missing RESEND_API_KEY');
      }
    }
    const exploder = new ExplodingEmail();
    const customerRepo = new CannedCustomerRepo([
      { customerId: 'c1', email: 'a@shop.local' },
    ]);

    await expect(
      sendEmailCampaign('cmp33333333333333333333333', {
        tenantId,
        campaignRepo,
        segmentRepo,
        customerRepo,
        email: exploder,
        clock,
        fromAddress: 'no-reply@shop.local',
      }),
    ).rejects.toThrow('Missing RESEND_API_KEY');

    const stored = await campaignRepo.findById(tenantId, 'cmp33333333333333333333333');
    expect(stored?.status).toBe('FAILED');
  });

  it('flips status to SENDING up-front so a retry cannot double-send', async () => {
    campaignRepo.seed(makeCampaign({ id: 'cmp44444444444444444444444' }));
    const customerRepo = new CannedCustomerRepo([
      { customerId: 'c1', email: 'a@shop.local' },
    ]);
    await sendEmailCampaign('cmp44444444444444444444444', {
      tenantId,
      campaignRepo,
      segmentRepo,
      customerRepo,
      email,
      clock,
      fromAddress: 'no-reply@shop.local',
    });
    expect(
      campaignRepo.finaliseCalls.find((c) => c.status === 'SENDING'),
    ).toBeDefined();
  });
});
