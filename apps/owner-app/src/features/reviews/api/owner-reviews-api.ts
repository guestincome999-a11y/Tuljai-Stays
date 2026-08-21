import type { PaginatedResponse, Review } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function listOwnerReviews(): Promise<PaginatedResponse<Review>> {
  return apiClient.get<PaginatedResponse<Review>>('/owner/reviews', {
    params: { limit: 100, page: 1 },
  });
}

export async function respondToReview(reviewId: string, response: string): Promise<Review> {
  return apiClient.patch<Review>(`/owner/reviews/${reviewId}/response`, {
    response: response.trim(),
  });
}
