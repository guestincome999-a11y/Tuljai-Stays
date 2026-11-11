import MailComposer from 'nodemailer/lib/mail-composer';

import type { SendEmailParams, TransactionalEmailProvider } from './email.service';

/** Gmail HTTPS delivery works on Render's free tier, which blocks SMTP ports. */
export class GmailEmailProvider implements TransactionalEmailProvider {
  private token: { value: string; expiresAt: number } | null = null;
  private refreshing: Promise<string> | null = null;

  public constructor(
    private readonly credentials: { clientId: string; clientSecret: string; refreshToken: string },
    private readonly sender: { name: string; address: string },
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    this.refreshing ??= (async () => {
      try {
        if (
          !this.credentials.clientId ||
          !this.credentials.clientSecret ||
          !this.credentials.refreshToken
        )
          throw new Error('Missing Gmail OAuth configuration');
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: this.credentials.clientId,
            client_secret: this.credentials.clientSecret,
            refresh_token: this.credentials.refreshToken,
            grant_type: 'refresh_token',
          }),
        });
        if (!response.ok) throw new Error('Gmail OAuth refresh rejected');
        const result = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
        if (typeof result.access_token !== 'string' || !result.access_token)
          throw new Error('Missing access token');
        const expires =
          typeof result.expires_in === 'number' && Number.isFinite(result.expires_in)
            ? result.expires_in
            : 300;
        this.token = {
          value: result.access_token,
          expiresAt: Date.now() + Math.max(0, expires - 60) * 1000,
        };
        return result.access_token;
      } catch {
        // No message submission has happened. Never expose Google's credential-bearing body.
        throw Object.assign(new Error('Gmail authorization unavailable'), { code: 'EAUTH' });
      }
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  public async submit(params: SendEmailParams): Promise<{ messageId: string }> {
    let mime: Buffer;
    try {
      mime = await new MailComposer({
        ...params,
        from: this.sender,
        disableFileAccess: true,
        disableUrlAccess: true,
      })
        .compile()
        .build();
    } catch {
      throw Object.assign(new Error('Email preparation failed'), {
        code: 'EMAIL_PREPARATION_FAILED',
      });
    }
    const accessToken = await this.accessToken();
    let response: Response;
    try {
      response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: mime.toString('base64url') }),
      });
    } catch {
      throw Object.assign(new Error('Gmail submission outcome is unknown'), {
        code: 'SUBMISSION_UNKNOWN',
      });
    }
    if (!response.ok) {
      if (response.status === 401) this.token = null;
      // A server error might follow acceptance. Do not automatically send again.
      if (response.status >= 500)
        throw Object.assign(new Error('Gmail submission outcome is unknown'), {
          code: 'SUBMISSION_UNKNOWN',
        });
      let rateLimited = response.status === 429;
      if (response.status === 403) {
        try {
          const body = (await response.json()) as {
            error?: { errors?: Array<{ reason?: string }> };
          };
          rateLimited =
            body.error?.errors?.some((error) =>
              ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded'].includes(
                error.reason ?? '',
              ),
            ) ?? false;
        } catch {
          /* An explicit rejection is not a successful submission. */
        }
      }
      throw Object.assign(new Error('Gmail rejected the submission'), {
        code: rateLimited || response.status === 401 ? 'GMAIL_RETRYABLE' : 'GMAIL_REJECTED',
        responseCode: response.status,
      });
    }
    let result: { id?: unknown };
    try {
      result = (await response.json()) as { id?: unknown };
    } catch {
      throw Object.assign(new Error('Gmail acceptance reference unavailable'), {
        code: 'SUBMISSION_UNKNOWN',
      });
    }
    if (typeof result.id !== 'string' || !result.id)
      throw Object.assign(new Error('Gmail acceptance reference unavailable'), {
        code: 'SUBMISSION_UNKNOWN',
      });
    return { messageId: result.id };
  }
}
