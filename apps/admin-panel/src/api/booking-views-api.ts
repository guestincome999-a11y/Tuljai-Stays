import type {
  AdminBookingConflict,
  AdminBookingDateRange,
  AdminBookingViewKey,
  AdminBookingViewPage,
} from '@tuljai/types';

import { apiClient } from './client';

export async function listBookingView(input: {
  from?: string;
  page: number;
  range?: AdminBookingDateRange;
  search?: string;
  to?: string;
  view: AdminBookingViewKey;
}): Promise<AdminBookingViewPage> {
  return apiClient.get<AdminBookingViewPage>('/admin/booking-views', {
    params: {
      from: input.from || undefined,
      page: input.page,
      range: input.range,
      search: input.search || undefined,
      to: input.to || undefined,
      view: input.view,
    },
  });
}

export async function listBookingConflicts(): Promise<AdminBookingConflict[]> {
  return apiClient.get<AdminBookingConflict[]>('/admin/booking-views/conflicts');
}
