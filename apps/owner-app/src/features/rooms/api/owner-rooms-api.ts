import type { LodgePhoto, PhotoCategory, Room, RoomStatus, RoomType } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface RoomTypeInput {
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
  description?: string;
  festivalPrice?: number;
  name: string;
  slug: string;
  totalRooms: number;
}

export interface RoomInput {
  floor?: string;
  roomNumber: string;
}

export interface PhotoMetadataInput {
  category: PhotoCategory;
  fileUrl: string;
  isCover?: boolean;
  roomId?: string;
  roomTypeId?: string;
  sortOrder?: number;
  thumbnailUrl?: string;
}

export async function listRoomTypes(lodgeId: string): Promise<RoomType[]> {
  return apiClient.get<RoomType[]>(`/lodges/${lodgeId}/room-types`);
}

export async function createRoomType(lodgeId: string, input: RoomTypeInput): Promise<RoomType> {
  return apiClient.post<RoomType>(`/owner/lodges/${lodgeId}/room-types`, input);
}

export async function updateRoomType(
  roomTypeId: string,
  input: Partial<RoomTypeInput> & { isActive?: boolean },
): Promise<RoomType> {
  return apiClient.request<RoomType>(`/owner/room-types/${roomTypeId}`, {
    body: input,
    method: 'PATCH',
  });
}

export async function listRooms(lodgeId: string): Promise<Room[]> {
  return apiClient.get<Room[]>(`/owner/lodges/${lodgeId}/rooms`);
}

export async function createRoom(roomTypeId: string, input: RoomInput): Promise<Room> {
  return apiClient.post<Room>(`/owner/room-types/${roomTypeId}/rooms`, input);
}

export async function updateRoom(roomId: string, input: Partial<RoomInput>): Promise<Room> {
  return apiClient.request<Room>(`/owner/rooms/${roomId}`, {
    body: input,
    method: 'PATCH',
  });
}

export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<Room> {
  return apiClient.request<Room>(`/owner/rooms/${roomId}/status`, {
    body: { status },
    method: 'PATCH',
  });
}

export async function listOwnerPhotos(lodgeId: string): Promise<LodgePhoto[]> {
  return apiClient.get<LodgePhoto[]>(`/owner/lodges/${lodgeId}/photos`);
}

export async function createPhotoMetadata(
  lodgeId: string,
  input: PhotoMetadataInput,
): Promise<LodgePhoto> {
  return apiClient.post<LodgePhoto>(`/owner/lodges/${lodgeId}/photos`, input);
}
