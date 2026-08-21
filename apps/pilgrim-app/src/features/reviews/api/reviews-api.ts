import type { PaginatedResponse, Review, ReviewReport, ReviewReportReason } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface CreateReviewInput {
  bookingId: string;
  cleanlinessRating?: number;
  comment?: string;
  locationRating?: number;
  rating: number;
  serviceRating?: number;
  title?: string;
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
    params: { limit, page },
  });
}

export async function reportReview(
  reviewId: string,
  reason: ReviewReportReason,
  description?: string,
): Promise<ReviewReport> {
  return apiClient.post<ReviewReport>(`/reviews/${reviewId}/report`, { description, reason });
}
