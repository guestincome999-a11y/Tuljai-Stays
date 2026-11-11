import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

import { GmailEmailProvider } from './gmail-email.provider';

export interface SendEmailParams {
  html: string;
  subject: string;
  text: string;
  to: string;
  messageId?: string;
  attachments?: Array<{ filename?: string; content: Buffer; contentType: string; cid?: string }>;
}

export function isEmailRecipient(value: string): boolean {
  return value.length <= 254 && /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/u.test(value);
}

/** Booking logic depends on this submission contract, not SMTP/Gmail internals. */
export interface TransactionalEmailProvider {
  submit(params: SendEmailParams): Promise<{ messageId: string }>;
}

/**
 * Gmail HTTPS/SMTP adapters shared by password resets and durable booking-email jobs.
 * submit() exposes failures/provider acceptance; send() preserves the
 * password-reset flow's non-disclosing, best-effort behavior.
 *
 * If no provider is configured, send() logs a warning and resolves without
 * sending — callers must not let email delivery failures leak account
 * existence or block the request/response they're part of.
 */
@Injectable()
export class EmailService implements TransactionalEmailProvider {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;
  private readonly gmail: GmailEmailProvider | null;

  public constructor(private readonly configService: ConfigService) {
    const provider = process.env.EMAIL_PROVIDER ?? 'smtp';
    if (!['gmail', 'smtp'].includes(provider)) throw new Error('Unsupported EMAIL_PROVIDER');
    const host = provider === 'smtp' ? this.configService.get<string>('api.smtp.host') : undefined;
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS
      ? process.env.EMAIL_FROM_ADDRESS
      : this.configService.getOrThrow<string>('api.smtp.fromAddress');
    this.gmail =
      provider === 'gmail'
        ? new GmailEmailProvider(
            {
              clientId: process.env.GMAIL_CLIENT_ID ?? '',
              clientSecret: process.env.GMAIL_CLIENT_SECRET ?? '',
              refreshToken: process.env.GMAIL_REFRESH_TOKEN ?? '',
            },
            { name: process.env.EMAIL_FROM_NAME ?? 'Tuljai Stays', address: this.fromAddress },
          )
        : null;

    this.transporter = host
      ? createTransport({
          auth: {
            pass: this.configService.get<string>('api.smtp.pass'),
            user: this.configService.get<string>('api.smtp.user'),
          },
          host,
          port: this.configService.getOrThrow<number>('api.smtp.port'),
          secure: this.configService.getOrThrow<boolean>('api.smtp.secure'),
          requireTLS: true,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 30_000,
          disableFileAccess: true,
          disableUrlAccess: true,
        })
      : null;
  }

  /** Unlike password-reset send(), durable jobs must observe failures and provider acceptance. */
  public async submit(params: SendEmailParams): Promise<{ messageId: string }> {
    if (!isEmailRecipient(params.to))
      throw Object.assign(new Error('Invalid recipient'), { code: 'INVALID_RECIPIENT' });
    if (this.gmail) return this.gmail.submit(params);
    if (!this.transporter)
      throw Object.assign(new Error('SMTP is not configured'), { code: 'ECONNECTION' });
    const result = await this.transporter.sendMail({
      ...params,
      from: process.env.EMAIL_FROM_ADDRESS
        ? { name: process.env.EMAIL_FROM_NAME ?? 'Tuljai Stays', address: this.fromAddress }
        : this.fromAddress,
    });
    if (!result.accepted?.length || result.rejected?.length)
      throw Object.assign(new Error('Recipient rejected'), { code: 'INVALID_RECIPIENT' });
    return { messageId: String(result.messageId) };
  }

  public async send(params: SendEmailParams): Promise<void> {
    if (!this.transporter && !this.gmail) {
      this.logger.warn(
        `SMTP is not configured (SMTP_HOST unset) - skipped sending "${params.subject}" to ${this.maskEmail(params.to)}`,
      );
      return;
    }

    try {
      await this.submit(params);
    } catch {
      this.logger.error(`Failed to send email "${params.subject}" to ${this.maskEmail(params.to)}`);
    }
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';
    return `${localPart[0]}***@${domain}`;
  }
}
