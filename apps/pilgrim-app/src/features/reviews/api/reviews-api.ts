import type { PaginatedResponse, Review } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  comment?: string;
}

export async function submitReview(input: CreateReviewInput): Promise<Review> {
  return apiClient.post<Review>('/reviews', {
    bookingId: input.bookingId,
    rating: input.rating,
    comment: input.comment?.trim() || undefined,
  });
}

export async function listLodgeReviews(lodgeId: string): Promise<PaginatedResponse<Review>> {
  return apiClient.get<PaginatedResponse<Review>>(`/lodges/${lodgeId}/reviews`, {
    params: { limit: 50, page: 1 },
  });
}
