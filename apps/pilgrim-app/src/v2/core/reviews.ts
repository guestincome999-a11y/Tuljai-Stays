import type { Review } from '@tuljai/types';

import { api } from './api';

export function fetchBookingReview(bookingId: string): Promise<Review | null> {
  return api.get<Review | null>(`/reviews/booking/${bookingId}`);
}

export function submitReview(input: {
  bookingId: string;
  comment?: string;
  rating: number;
}): Promise<Review> {
  return api.post<Review>('/reviews', {
    bookingId: input.bookingId,
    comment: input.comment?.trim() || undefined,
    rating: input.rating,
  });
}
