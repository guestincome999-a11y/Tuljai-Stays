import { apiClient } from '../../../api/client';

export interface CreatePaymentOrderRequest {
  amount: number;
  bookingId: string;
  currency?: string;
}

export interface CreatePaymentOrderResponse {
  provider: 'RAZORPAY';
  orderId: string;
  amount: number;
  currency: string;
  status: 'CREATED';
  paymentId: string;
}

export interface VerifyPaymentRequest {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  providerPaymentId: string;
  paymentId: string;
  alreadyVerified: boolean;
}

export async function createPaymentOrder(
  input: CreatePaymentOrderRequest,
): Promise<CreatePaymentOrderResponse> {
  return apiClient.post<CreatePaymentOrderResponse>('/payments/create-order', input);
}

export async function verifyPayment(input: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
  return apiClient.post<VerifyPaymentResponse>('/payments/verify', input);
}
