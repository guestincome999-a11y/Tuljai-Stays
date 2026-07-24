import type { Amenity, LodgeDetails } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function listAvailableAmenities(): Promise<Amenity[]> {
  return apiClient.get<Amenity[]>('/amenities');
}

export async function getOwnerLodgeDetails(lodgeId: string): Promise<LodgeDetails> {
  return apiClient.get<LodgeDetails>(`/lodges/${lodgeId}`);
}

export async function updateOwnerLodgeAmenities(
  lodgeId: string,
  amenityIds: string[],
): Promise<{ success: true }> {
  return apiClient.post<{ success: true }>(`/owner/lodges/${lodgeId}/amenities`, {
    amenityIds,
  });
}
