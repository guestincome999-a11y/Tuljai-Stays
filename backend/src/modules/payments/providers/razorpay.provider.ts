import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

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
  receipt: string;
}

/** An explicit 4xx rejection, unlike an unknown network/5xx outcome. */
export class RazorpayOrderRejectedException extends BadRequestException {}

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
  private readonly logger = new Logger(RazorpayProvider.name);
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
    const started = performance.now();
    try {
      const response = await fetch(`https://api.razorpay.com/v1${path}`, {
        ...init,
        signal: AbortSignal.timeout(15_000),
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
        if ([400, 401, 403, 404, 422, 429].includes(response.status)) {
          throw new RazorpayOrderRejectedException(message);
        }
        throw new ServiceUnavailableException(
          'Razorpay request outcome is uncertain; check payment status',
        );
      }

      return parsed as T;
    } finally {
      // Operation and elapsed time only; never log gateway bodies or credentials.
      this.logger.log({
        operation: init.method === 'POST' ? 'gateway_write' : 'gateway_read',
        durationMs: Math.round(performance.now() - started),
      });
    }
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
    if (!input.signature || !/^[a-f0-9]{64}$/i.test(input.signature)) {
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

  public async getOrdersByReceipt(receipt: string): Promise<RazorpayOrderResponse[]> {
    const result = await this.request<{ items: RazorpayOrderResponse[] }>(
      `/orders?receipt=${encodeURIComponent(receipt)}&count=2`,
      { method: 'GET' },
    );
    return result.items;
  }

  public async getOrderPayments(orderId: string): Promise<RazorpayPaymentResponse[]> {
    const result = await this.request<{ items: RazorpayPaymentResponse[] }>(
      `/orders/${encodeURIComponent(orderId)}/payments`,
      { method: 'GET' },
    );
    return result.items;
  }

  public verifyWebhook(body: Buffer, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!secret) throw new ServiceUnavailableException('Razorpay webhook secret is not configured');
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = createHmac('sha256', secret).update(body).digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
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
