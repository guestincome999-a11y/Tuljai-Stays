import type { QrDisplayPayload } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function getBookingQrMetadata(bookingId: string): Promise<QrDisplayPayload> {
  return apiClient.get<QrDisplayPayload>(`/bookings/${bookingId}/qr`);
}
