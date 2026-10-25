import { apiClient } from '../../../api/client';

export interface PromoValidationResult {
  code: string;
  discount: number;
  discountType: 'FLAT' | 'PERCENTAGE';
  subtotal: number;
  totalAfterDiscount: number;
}

export async function validatePromoCode(input: {
  code: string;
  lodgeId: string;
  subtotal: number;
}): Promise<PromoValidationResult> {
  return apiClient.post<PromoValidationResult>('/promotions/validate', {
    code: input.code.trim().toUpperCase(),
    lodgeId: input.lodgeId,
    subtotal: input.subtotal,
  });
}
