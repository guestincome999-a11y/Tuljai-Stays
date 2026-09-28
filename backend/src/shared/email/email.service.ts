import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface SendEmailParams {
  html: string;
  subject: string;
  text: string;
  to: string;
}

/**
 * Thin SMTP wrapper used for transactional emails (currently: owner-app
 * password reset links). There is no other email-sending infrastructure in
 * this codebase, so this intentionally stays minimal rather than adding a
 * dependency on a specific provider (SES/SendGrid/etc).
 *
 * If SMTP_HOST is not configured, send() logs a warning and resolves without
 * sending — callers must not let email delivery failures leak account
 * existence or block the request/response they're part of.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  public constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('api.smtp.host');
    this.fromAddress = this.configService.getOrThrow<string>('api.smtp.fromAddress');

    this.transporter = host
      ? createTransport({
          auth: {
            pass: this.configService.get<string>('api.smtp.pass'),
            user: this.configService.get<string>('api.smtp.user'),
          },
          host,
          port: this.configService.getOrThrow<number>('api.smtp.port'),
          secure: this.configService.getOrThrow<boolean>('api.smtp.secure'),
        })
      : null;
  }

  public async send(params: SendEmailParams): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured (SMTP_HOST unset) - skipped sending "${params.subject}" to ${this.maskEmail(params.to)}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        html: params.html,
        subject: params.subject,
        text: params.text,
        to: params.to,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email "${params.subject}" to ${this.maskEmail(params.to)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain || localPart.length === 0) return '***';
    return `${localPart[0]}***@${domain}`;
  }
}
