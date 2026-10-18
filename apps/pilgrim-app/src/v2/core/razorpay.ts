import RazorpayCheckout from 'react-native-razorpay';

import type { PrepaidOrder } from './booking';

export interface RazorpayPayment {
  orderId: string;
  paymentId: string;
  signature: string;
}

/** Thrown when the guest closes the payment sheet. The room hold is still valid for a retry. */
export class PaymentDismissedError extends Error {
  public constructor() {
    super('Payment was cancelled');
    this.name = 'PaymentDismissedError';
  }
}

export interface RazorpayOptions {
  description: string;
  email?: string;
  name: string;
  /** National 10-digit number. */
  phone: string;
  themeColor: string;
}

/**
 * Opens the native Razorpay sheet for an order that already exists. Because the order was created
 * in the background when the guest picked dates, this involves no network request before the sheet
 * appears.
 */
export async function openRazorpay(
  order: PrepaidOrder,
  options: RazorpayOptions,
): Promise<RazorpayPayment> {
  try {
    const result = await RazorpayCheckout.open({
      amount: order.amount,
      currency: order.currency,
      description: options.description,
      key: order.keyId,
      name: 'Tuljai Stays',
      notes: { lockCode: order.lockCode },
      order_id: order.orderId,
      prefill: { contact: options.phone, email: options.email, name: options.name },
      theme: { color: options.themeColor },
    });
    return {
      orderId: result.razorpay_order_id,
      paymentId: result.razorpay_payment_id,
      signature: result.razorpay_signature,
    };
  } catch (error) {
    // Razorpay rejects with { code, description } for both dismissal and failure.
    const code = (error as { code?: number } | null)?.code;
    if (code === 0 || code === 2) throw new PaymentDismissedError();
    throw error;
  }
}
