import { palette } from '@tuljai/ui';
import RazorpayCheckout from 'react-native-razorpay';

import { createPaymentOrder, verifyPayment } from './payments-api';

export interface StartRazorpayPaymentInput {
  bookingId: string;
  amount: number;
  name: string;
  email?: string;
  phone: string;
}

export async function startRazorpayPayment(input: StartRazorpayPaymentInput) {
  // 1. Ask backend to create the Razorpay order.
  const order = await createPaymentOrder({
    amount: input.amount,
    bookingId: input.bookingId,
    currency: 'INR',
  });

  // 2. Open native Razorpay Checkout.
  const result = await RazorpayCheckout.open({
    key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '',
    amount: Math.round(order.amount * 100).toString(),
    currency: order.currency,
    name: 'Tuljai Stays',
    description: 'Lodge booking payment',
    order_id: order.orderId,

    prefill: {
      name: input.name,
      email: input.email,
      contact: input.phone,
    },

    theme: {
      color: palette.saffron[600],
    },
  });

  // 3. Send Razorpay's response to backend.
  const verification = await verifyPayment({
    orderId: order.orderId,
    paymentId: result.razorpay_payment_id,
    signature: result.razorpay_signature,
  });

  if (!verification.verified) {
    throw new Error('Payment could not be verified');
  }

  return {
    order,
    result,
    verification,
  };
}
