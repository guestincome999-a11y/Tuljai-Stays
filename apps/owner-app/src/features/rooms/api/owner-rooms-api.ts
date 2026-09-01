import type {
  LodgePhoto,
  ManualBookingBlock,
  PhotoCategory,
  Room,
  RoomStatus,
  RoomType,
} from '@tuljai/types';

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

export interface PickedPhoto {
  fileName: string;
  mimeType: string;
  uri: string;
}

export interface ManualBookingInput {
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestPhone: string;
  notes?: string;
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

export async function listManualBookings(lodgeId: string): Promise<ManualBookingBlock[]> {
  return apiClient.get<ManualBookingBlock[]>(`/owner/lodges/${lodgeId}/manual-bookings`);
}

export async function createManualBooking(
  roomId: string,
  input: ManualBookingInput,
): Promise<ManualBookingBlock> {
  return apiClient.post<ManualBookingBlock>(`/owner/rooms/${roomId}/manual-bookings`, input);
}

export async function deleteManualBooking(bookingId: string): Promise<{ deleted: boolean }> {
  return apiClient.request<{ deleted: boolean }>(`/owner/manual-bookings/${bookingId}`, {
    method: 'DELETE',
  });
}

export async function listOwnerPhotos(lodgeId: string): Promise<LodgePhoto[]> {
  return apiClient.get<LodgePhoto[]>(`/owner/lodges/${lodgeId}/photos`);
}

export async function uploadLodgePhoto(
  lodgeId: string,
  photo: PickedPhoto,
): Promise<{ fileUrl: string }> {
  const formData = new FormData();
  formData.append('file', {
    name: photo.fileName,
    type: photo.mimeType,
    uri: photo.uri,
    // React Native's FormData accepts this file-descriptor shape; it does not match the DOM
    // Blob/File type that TypeScript's lib.dom.d.ts expects for FormData.append.
  } as unknown as Blob);

  return apiClient.request<{ fileUrl: string }>(`/owner/lodges/${lodgeId}/photos/upload`, {
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    method: 'POST',
  });
}

export async function createPhotoMetadata(
  lodgeId: string,
  input: PhotoMetadataInput,
): Promise<LodgePhoto> {
  return apiClient.post<LodgePhoto>(`/owner/lodges/${lodgeId}/photos`, input);
}
