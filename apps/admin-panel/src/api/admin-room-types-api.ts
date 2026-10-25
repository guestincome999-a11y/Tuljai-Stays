import type { RoomType } from '@tuljai/types';

import { apiClient } from './client';

// Render free/starter instances can take well over the default 15s to wake up.
// A longer ceiling for these admin writes stops a cold start from being
// reported as a failed save.
const ROOM_ADMIN_TIMEOUT_MS = 45_000;

export interface RoomTypeUpdateInput {
  basePrice?: number;
  capacityAdults?: number;
  capacityChildren?: number;
  /** null clears the description. */
  description?: string | null;
  /** null clears the festival price. */
  festivalPrice?: number | null;
  isActive?: boolean;
  name?: string;
  totalRooms?: number;
}

/**
 * Every room type of the lodge, including inactive ones and ones with no
 * currently-available room. The public endpoint hides those, which left them
 * impossible to edit or re-activate from the admin panel.
 */
export async function listManageableRoomTypes(lodgeId: string): Promise<RoomType[]> {
  return apiClient.request<RoomType[]>(`/owner/lodges/${lodgeId}/room-types`, {
    method: 'GET',
    timeout: ROOM_ADMIN_TIMEOUT_MS,
  });
}

export async function saveRoomType(
  roomTypeId: string,
  input: RoomTypeUpdateInput,
): Promise<RoomType> {
  return apiClient.request<RoomType>(`/owner/room-types/${roomTypeId}`, {
    body: input,
    method: 'PATCH',
    timeout: ROOM_ADMIN_TIMEOUT_MS,
  });
}
