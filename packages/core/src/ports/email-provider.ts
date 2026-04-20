/**
 * Email provider port — abstracts the SMTP/HTTP backend (Resend, SES,
 * Postmark, etc.). Phase 11 ships a stub that records intent without
 * delivery; Phase 11.1 introduces the Resend adapter.
 *
 * Implementations SHOULD:
 *   - support batch send (one call per campaign, not one per recipient),
 *   - return per-recipient pass/fail so the campaign records counts,
 *   - never throw on per-recipient failure — only on configuration errors
 *     (missing API key, invalid template).
 */

export interface EmailRecipient {
  email: string;
  /** Optional display name. */
  name?: string;
}

export interface EmailMessage {
  /** From address — typically the merchant's verified sender. */
  from: string;
  recipients: EmailRecipient[];
  subject: string;
  /** Pre-rendered HTML. The use-case turns Markdown → HTML. */
  html: string;
  /** Plain-text fallback (auto-generated from Markdown when omitted). */
  text?: string;
  /** Tags for provider-side analytics (Resend `tags`, SES `Tags`). */
  tags?: Record<string, string>;
}

export interface EmailSendOutcome {
  recipient: string;
  delivered: boolean;
  /** Provider-side message id when available. */
  providerMessageId?: string;
  /** Reason for failure (when `delivered: false`). */
  error?: string;
}

export interface EmailSendResult {
  outcomes: EmailSendOutcome[];
  /** Sum of delivered=true. */
  sentCount: number;
  /** Sum of delivered=false. */
  failedCount: number;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
