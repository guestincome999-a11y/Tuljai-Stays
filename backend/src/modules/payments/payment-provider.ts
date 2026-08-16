export interface CreatePaymentInput {
  amount: number;
  currency: string;
  bookingId: string;
  receipt: string;
}

export interface PaymentOrder {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'CREATED';
}

export interface PaymentVerificationInput {
  orderId: string;
  paymentId: string;
  signature?: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  providerPaymentId: string;
}

export interface PaymentProvider {
  readonly name: 'RAZORPAY' | 'OTHER';
  createPayment(input: CreatePaymentInput): Promise<PaymentOrder>;
  verifyPayment(input: PaymentVerificationInput): Promise<PaymentVerificationResult>;
  refundPayment(paymentId: string, amount?: number): Promise<{ refundId: string }>;
}
