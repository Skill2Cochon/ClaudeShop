import type { EmailCampaign } from '@claudeshop/contracts/crm';
import { NotFoundError, ValidationError } from '@claudeshop/errors';
import type { CustomerRepository } from '../ports/customer-repository.js';
import type { CustomerSegmentRepository } from '../ports/customer-segment-repository.js';
import type { EmailCampaignRepository } from '../ports/email-campaign-repository.js';
import type { EmailProvider } from '../ports/email-provider.js';
import type { Clock } from '../ports/clock.js';

export interface SendEmailCampaignDeps {
  tenantId: string;
  campaignRepo: EmailCampaignRepository;
  segmentRepo: CustomerSegmentRepository;
  customerRepo: CustomerRepository;
  email: EmailProvider;
  clock: Clock;
  /** Sender address used as the From header. */
  fromAddress: string;
  /** Page size when paging through segment members. */
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 200;

/**
 * Send an email campaign to its target segment.
 *
 * Phase 11 contract:
 * - Campaign must be DRAFT or SCHEDULED.
 * - segmentId is mandatory at send time (broadcast-to-everyone lands in 11.1).
 * - We page through `findSegmentMembers` so a 100k segment doesn't OOM.
 * - StubEmailProvider records intent without actual delivery; the use-case
 *   counts outcomes either way.
 * - Status transitions: DRAFT/SCHEDULED → SENDING → SENT (on success) or
 *   FAILED (on provider config error). Per-recipient failures bump
 *   failedCount but do not flip status to FAILED.
 */
export async function sendEmailCampaign(
  campaignId: string,
  deps: SendEmailCampaignDeps,
): Promise<EmailCampaign> {
  const campaign = await deps.campaignRepo.findById(deps.tenantId, campaignId);
  if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);
  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    throw new ValidationError(
      `Campaign ${campaign.name} is ${campaign.status} — only DRAFT or SCHEDULED can be sent`,
    );
  }
  if (!campaign.segmentId) {
    throw new ValidationError(
      `Campaign ${campaign.name} has no target segment — assign one before sending (broadcast lands in 11.1)`,
    );
  }
  const segment = await deps.segmentRepo.findById(
    deps.tenantId,
    campaign.segmentId,
  );
  if (!segment) {
    throw new NotFoundError(`Segment ${campaign.segmentId} not found`);
  }

  // Mark SENDING up-front so concurrent retries can't double-send.
  await deps.campaignRepo.finaliseSend(deps.tenantId, campaignId, {
    status: 'SENDING',
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
  });

  const html = renderHtml(campaign.bodyMd);
  let sentCount = 0;
  let failedCount = 0;
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  let page = 1;

  try {
    while (true) {
      const { items, total } = await deps.customerRepo.findSegmentMembers(
        deps.tenantId,
        segment.rules,
        { page, limit: batchSize },
      );
      if (items.length === 0) break;

      const result = await deps.email.send({
        from: deps.fromAddress,
        recipients: items.map((m) => ({ email: m.email })),
        subject: campaign.subject,
        html,
        tags: { campaignId, tenantId: deps.tenantId },
      });
      sentCount += result.sentCount;
      failedCount += result.failedCount;

      if (page * batchSize >= total) break;
      page++;
    }
  } catch (err) {
    await deps.campaignRepo.finaliseSend(deps.tenantId, campaignId, {
      status: 'FAILED',
      sentCount,
      failedCount,
    });
    throw err;
  }

  return deps.campaignRepo.finaliseSend(deps.tenantId, campaignId, {
    status: 'SENT',
    sentAt: deps.clock.now(),
    sentCount,
    failedCount,
  });
}

/**
 * Tiny Markdown → HTML renderer. Supports headings, paragraphs, bold, italic,
 * links, and inline code — enough for transactional + campaign emails. The
 * full `marked` lib is reserved for the storefront where the surface is
 * larger; here we keep the dep weight on @claudeshop/core at zero.
 */
function renderHtml(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const out: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphBuffer.length === 0) return;
    out.push(`<p>${inlineFormat(paragraphBuffer.join(' '))}</p>`);
    paragraphBuffer = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inlineFormat(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    if (line.trim().length === 0) {
      flushParagraph();
      continue;
    }
    paragraphBuffer.push(line.trim());
  }
  flushParagraph();
  return out.join('\n');
}

function inlineFormat(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
