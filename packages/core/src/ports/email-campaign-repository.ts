import type {
  CreateEmailCampaignInput,
  EmailCampaign,
  EmailCampaignStatus,
  UpdateEmailCampaignInput,
} from '@claudeshop/contracts/crm';

export interface EmailCampaignRepository {
  findById(tenantId: string, id: string): Promise<EmailCampaign | null>;
  list(
    tenantId: string,
    opts: { page: number; limit: number; status?: EmailCampaignStatus },
  ): Promise<{ items: EmailCampaign[]; total: number }>;
  create(tenantId: string, input: CreateEmailCampaignInput): Promise<EmailCampaign>;
  update(
    tenantId: string,
    id: string,
    input: UpdateEmailCampaignInput,
  ): Promise<EmailCampaign>;
  delete(tenantId: string, id: string): Promise<void>;

  /**
   * Persist a status transition + delivery counters from sendEmailCampaign.
   * Caller passes the new status alongside aggregated send/failed counts.
   */
  finaliseSend(
    tenantId: string,
    id: string,
    patch: {
      status: EmailCampaignStatus;
      sentAt?: Date;
      sentCount: number;
      failedCount: number;
    },
  ): Promise<EmailCampaign>;
}
