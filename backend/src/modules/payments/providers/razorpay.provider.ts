import { createHmac } from 'node:crypto';

import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

import type {
  CreatePaymentInput,
  PaymentOrder,
  PaymentProvider,
  PaymentVerificationInput,
  PaymentVerificationResult,
} from '../payment-provider';

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

interface RazorpayRefundResponse {
  id: string;
}

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  public readonly name = 'RAZORPAY' as const;
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  public async createPayment(input: CreatePaymentInput): Promise<PaymentOrder> {
    const credentials = this.credentials();
    const response = await this.request<RazorpayOrderResponse>('/orders', credentials, {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: { bookingId: input.bookingId },
      }),
    });

    if (!response.id || response.status !== 'created') {
      throw new ServiceUnavailableException('Razorpay did not create the payment order');
    }

    return {
      provider: this.name,
      orderId: response.id,
      amount: response.amount,
      currency: response.currency,
      status: 'CREATED',
    };
  }

  public async verifyPayment(input: PaymentVerificationInput): Promise<PaymentVerificationResult> {
    const credentials = this.credentials();
    const signature = input.signature?.trim();

    if (!signature) {
      throw new BadRequestException('Razorpay payment signature is required');
    }

    const expected = createHmac('sha256', credentials.secret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');

    if (!this.safeEqualHex(expected, signature)) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    return { verified: true, providerPaymentId: input.paymentId };
  }

  public async refundPayment(paymentId: string, amount?: number): Promise<{ refundId: string }> {
    if (!paymentId?.trim()) {
      throw new BadRequestException('Razorpay payment ID is required');
    }
    if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) {
      throw new BadRequestException('Refund amount must be a positive integer in paise');
    }

    const response = await this.request<RazorpayRefundResponse>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      this.credentials(),
      { method: 'POST', body: JSON.stringify(amount === undefined ? {} : { amount }) },
    );

    if (!response.id) {
      throw new ServiceUnavailableException('Razorpay did not create the refund');
    }

    return { refundId: response.id };
  }

  private credentials(): { keyId: string; secret: string } {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !secret) {
      throw new ServiceUnavailableException(
        'Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    return { keyId, secret };
  }

  private async request<T>(
    path: string,
    credentials: { keyId: string; secret: string },
    init: RequestInit,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.secret}`).toString('base64')}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new ServiceUnavailableException('Unable to reach Razorpay');
    }

    const body = (await response.json().catch(() => null)) as
      | (T & { error?: { description?: string } })
      | null;
    if (!response.ok) {
      throw new BadRequestException(body?.error?.description ?? 'Razorpay request failed');
    }
    if (!body) {
      throw new ServiceUnavailableException('Razorpay returned an empty response');
    }
    return body;
  }

  private safeEqualHex(expected: string, actual: string): boolean {
    return (
      expected.length === actual.length &&
      /^[0-9a-f]+$/iu.test(actual) &&
      Buffer.from(expected, 'hex').equals(Buffer.from(actual, 'hex'))
    );
  }
}
