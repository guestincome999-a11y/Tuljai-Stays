import { createHmac, timingSafeEqual } from 'node:crypto';

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

interface RazorpayPaymentResponse {
  id: string;
  order_id: string;
  amount: number;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  captured: boolean;
  currency: string;
}

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  public readonly name = 'RAZORPAY' as const;

  private get keyId(): string {
    const value = process.env.RAZORPAY_KEY_ID?.trim();
    if (!value) throw new ServiceUnavailableException('Razorpay key is not configured');
    return value;
  }

  private get keySecret(): string {
    const value = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!value) throw new ServiceUnavailableException('Razorpay secret is not configured');
    return value;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const body = await response.text();
    let parsed: unknown = null;
    try {
      parsed = body ? JSON.parse(body) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const message =
        typeof parsed === 'object' && parsed && 'error' in parsed
          ? String(
              (parsed as { error?: { description?: string } }).error?.description ??
                'Razorpay request failed',
            )
          : 'Razorpay request failed';
      throw new BadRequestException(message);
    }

    return parsed as T;
  }

  public async createPayment(input: CreatePaymentInput): Promise<PaymentOrder> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException(
        'Payment amount must be a positive integer in currency subunits',
      );
    }

    const order = await this.request<RazorpayOrderResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt.slice(0, 40),
        partial_payment: false,
        notes: { bookingId: input.bookingId },
      }),
    });

    return {
      provider: this.name,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: 'CREATED',
    };
  }

  public async verifyPayment(input: PaymentVerificationInput): Promise<PaymentVerificationResult> {
    if (!input.signature) {
      throw new BadRequestException('Razorpay payment signature is required');
    }

    const expected = createHmac('sha256', this.keySecret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(input.signature, 'hex');

    const verified =
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer);

    return await Promise.resolve({
      verified,
      providerPaymentId: input.paymentId,
    });
  }

  public async getPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    return this.request<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
    });
  }

  public async refundPayment(paymentId: string, amount?: number): Promise<{ refundId: string }> {
    const refund = await this.request<{ id: string }>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: 'POST',
        body: JSON.stringify(amount ? { amount } : {}),
      },
    );
    return { refundId: refund.id };
  }
}
