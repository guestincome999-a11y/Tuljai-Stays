import type {
  PaginatedResponse,
  Review,
  ReviewReport,
  ReviewReportReason,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface CreateReviewRequest {
  bookingId: string;
  rating: number;
  title?: string;
  comment?: string;
  cleanlinessRating?: number;
  locationRating?: number;
  serviceRating?: number;
  valueRating?: number;
}

export interface ListLodgeReviewsParams {
  page?: number;
  limit?: number;
}

export async function createReview(input: CreateReviewRequest): Promise<Review> {
  return apiClient.post<Review>('/reviews', input);
}

export async function getMyBookingReview(bookingId: string): Promise<Review | null> {
  return apiClient.get<Review | null>(`/reviews/booking/${bookingId}`);
}

export async function listLodgeReviews(
  lodgeId: string,
  params: ListLodgeReviewsParams = {},
): Promise<PaginatedResponse<Review>> {
  return apiClient.get<PaginatedResponse<Review>>(`/lodges/${lodgeId}/reviews`, { params });
}

export async function reportReview(
  reviewId: string,
  reason: ReviewReportReason,
  description?: string,
): Promise<ReviewReport> {
  return apiClient.post<ReviewReport>(`/reviews/${reviewId}/report`, {
    reason,
    description,
  });
}
