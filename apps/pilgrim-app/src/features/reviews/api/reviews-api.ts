import type { PaginatedResponse, Review } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  title?: string;
  comment?: string;
  cleanlinessRating?: number;
  locationRating?: number;
  serviceRating?: number;
  valueRating?: number;
}

export async function createReview(input: CreateReviewInput): Promise<Review> {
  return apiClient.post<Review>('/reviews', input);
}

export async function getMyBookingReview(bookingId: string): Promise<Review | null> {
  return apiClient.get<Review | null>(`/reviews/booking/${bookingId}`);
}

export async function listLodgeReviews(
  lodgeId: string,
  page = 1,
  limit = 10,
): Promise<PaginatedResponse<Review>> {
  return apiClient.get<PaginatedResponse<Review>>(`/lodges/${lodgeId}/reviews`, {
    params: { page, limit },
  });
}

export async function reportReview(
  reviewId: string,
  reason: 'FAKE' | 'ABUSIVE' | 'MISLEADING' | 'SPAM' | 'OTHER',
  description?: string,
): Promise<void> {
  await apiClient.post(`/reviews/${reviewId}/report`, { reason, description });
}
