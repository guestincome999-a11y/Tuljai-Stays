import type { PaginatedResponse, Review, ReviewStatus } from '@tuljai/types';

import { apiClient } from './client';

export async function listAdminReviews(status?: ReviewStatus): Promise<PaginatedResponse<Review>> {
  return apiClient.get<PaginatedResponse<Review>>('/admin/reviews', {
    params: { limit: 100, page: 1, status },
  });
}

export async function moderateReview(reviewId: string, status: ReviewStatus): Promise<Review> {
  return apiClient.patch<Review>(`/admin/reviews/${reviewId}/status`, { status });
}
