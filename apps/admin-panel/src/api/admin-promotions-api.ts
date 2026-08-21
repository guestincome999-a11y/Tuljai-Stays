import { apiClient } from './client';

export type PromoDiscountType = 'FLAT' | 'PERCENTAGE';
export interface PromoCode {
  id: string;
  code: string;
  discount_type: PromoDiscountType;
  discount_value: string | number;
  starts_at: string;
  ends_at: string;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  lodge_id: string | null;
  active: boolean;
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  return apiClient.get<PromoCode[]>('/admin/promotions');
}

export async function createPromoCode(payload: {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  perUserLimit?: number;
  lodgeId?: string;
}) {
  return apiClient.post<{ code: string }>('/admin/promotions', payload);
}

export async function deactivatePromoCode(id: string) {
  return apiClient.patch<{ active: false }>(`/admin/promotions/${id}/deactivate`);
}
