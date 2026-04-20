import type {
  EmailMessage,
  EmailProvider,
  EmailSendOutcome,
  EmailSendResult,
} from '../ports/email-provider';

/**
 * Records send attempts in memory and returns delivery=true for everything.
 * Used in tests + Phase 11 dev runs (Phase 11.1 swaps in Resend / SES).
 *
 * Test helper exposed via `lastSent` / `allSent` so the suite can assert
 * which recipients a campaign would have hit.
 */
export class StubEmailProvider implements EmailProvider {
  readonly name = 'stub-email';
  readonly allSent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.allSent.push(message);
    const outcomes: EmailSendOutcome[] = message.recipients.map((r) => ({
      recipient: r.email,
      delivered: true,
      providerMessageId: `stub_${this.allSent.length}_${r.email}`,
    }));
    return {
      outcomes,
      sentCount: outcomes.length,
      failedCount: 0,
    };
  }

  get lastSent(): EmailMessage | undefined {
    return this.allSent[this.allSent.length - 1];
  }
}
