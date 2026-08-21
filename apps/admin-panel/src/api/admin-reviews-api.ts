import type { PaginatedResponse, Review, ReviewStatus } from '@tuljai/types';

import { apiClient } from './client';

export async function listAdminReviews(status?: ReviewStatus): Promise<PaginatedResponse<Review>> {
  return apiClient.get<PaginatedResponse<Review>>('/admin/reviews', {
    params: { limit: 100, page: 1, ...(status ? { status } : {}) },
  });
}

export async function moderateAdminReview(id: string, status: ReviewStatus): Promise<Review> {
  return apiClient.request<Review>(`/admin/reviews/${id}/status`, {
    body: { status },
    method: 'PATCH',
  });
}
