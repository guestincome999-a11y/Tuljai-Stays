import type { QrDisplayPayload } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function getBookingQrMetadata(bookingId: string): Promise<QrDisplayPayload> {
  return apiClient.get<QrDisplayPayload>(`/api/bookings/${bookingId}/qr`);
}
