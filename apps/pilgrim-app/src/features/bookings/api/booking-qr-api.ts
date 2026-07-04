import type { QrTokenMetadata } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function getBookingQrMetadata(bookingId: string): Promise<QrTokenMetadata> {
  return apiClient.get<QrTokenMetadata>(`/api/bookings/${bookingId}/qr`);
}
