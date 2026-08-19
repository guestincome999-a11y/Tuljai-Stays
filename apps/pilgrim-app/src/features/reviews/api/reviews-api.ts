import type { Review } from '@tuljai/types';

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
