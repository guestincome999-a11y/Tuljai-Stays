import type {
  Amenity,
  BulkLodgeImportResult,
  BulkLodgeImportRow,
  City,
  Lodge,
  LodgeDetails,
  LodgePhoto,
  LodgeStatus,
  PaginatedResponse,
  PhotoApprovalStatus,
  Room,
  RoomStatus,
  RoomType,
  VerificationStatus,
} from '@tuljai/types';

import { apiClient } from './client';

export interface LodgeGovernanceQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CreateLodgeInput {
  address?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    country: string;
    district: string;
    landmark?: string;
    pincode: string;
    state: string;
  };
  checkInTime?: string;
  checkOutTime?: string;
  cityId: string;
  description?: string;
  distanceFromTempleMeters?: number;
  email?: string;
  latitude?: number;
  longitude?: number;
  name: string;
  primaryPhone: string;
  propertyType: Lodge['propertyType'];
  rules?: string;
  secondaryPhone?: string;
  slug: string;
  whatsappNumber?: string;
}

export interface LodgeStatusInput {
  status: LodgeStatus;
}

export interface LodgeVerificationInput {
  notes?: string;
  verificationStatus: VerificationStatus;
}

export interface RoomStatusInput {
  status: RoomStatus;
}

export interface CreateRoomTypeInput {
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
  description?: string;
  festivalPrice?: number;
  name: string;
  slug: string;
  totalRooms: number;
}

export interface CreateRoomInput {
  floor?: string;
  roomNumber: string;
}

export interface PhotoRejectionInput {
  rejectionReason: string;
}

export interface AssignLodgeOwnerInput {
  isPrimary?: boolean;
  ownerEmail?: string;
  ownerName: string;
  ownerPhone: string;
  roleTitle?: string;
  userId: string;
}

export interface AssignAmenitiesInput {
  amenityIds: string[];
}

export type LodgeCommissionType = 'PERCENTAGE' | 'FIXED_PER_BOOKING';

export interface LodgeCommissionConfig {
  lodgeId: string;
  commissionEnabled: boolean;
  commissionType: LodgeCommissionType;
  commissionRatePercent: number;
  commissionFixedAmount: number;
  effectiveFrom: string;
}

export interface UpdateLodgeCommissionInput {
  commissionEnabled: boolean;
  commissionType: LodgeCommissionType;
  commissionRatePercent?: number;
  commissionFixedAmount?: number;
  effectiveFrom?: string;
}

export type PendingPhoto = LodgePhoto & {
  lodgeName?: string;
};

export async function listGovernanceLodges(
  query: LodgeGovernanceQuery = {},
): Promise<PaginatedResponse<Lodge>> {
  return apiClient.get<PaginatedResponse<Lodge>>('/admin/lodges', {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      search: query.search || undefined,
    },
  });
}

export async function listLodgeCities(): Promise<City[]> {
  return apiClient.get<City[]>('/cities');
}

export async function createGovernanceLodge(input: CreateLodgeInput): Promise<LodgeDetails> {
  return apiClient.post<LodgeDetails>('/admin/lodges', input);
}

export async function bulkImportGovernanceLodges(
  rows: BulkLodgeImportRow[],
): Promise<BulkLodgeImportResult> {
  return apiClient.request<BulkLodgeImportResult>('/admin/lodges/bulk-import', {
    body: { rows },
    method: 'POST',
    timeout: 120_000,
  });
}

export async function getGovernanceLodge(lodgeId: string): Promise<LodgeDetails> {
  return apiClient.get<LodgeDetails>(`/admin/lodges/${lodgeId}`);
}

export async function updateGovernanceLodgeStatus(
  lodgeId: string,
  input: LodgeStatusInput,
): Promise<LodgeDetails> {
  return apiClient.request<LodgeDetails>(`/admin/lodges/${lodgeId}/status`, {
    body: input,
    method: 'PATCH',
  });
}

export async function verifyGovernanceLodge(
  lodgeId: string,
  input: LodgeVerificationInput,
): Promise<LodgeDetails> {
  return apiClient.request<LodgeDetails>(`/admin/lodges/${lodgeId}/verify`, {
    body: input,
    method: 'PATCH',
  });
}

export async function getLodgeCommission(lodgeId: string): Promise<LodgeCommissionConfig> {
  return apiClient.get<LodgeCommissionConfig>(`/admin/lodges/${lodgeId}/commission`);
}

export async function updateLodgeCommission(
  lodgeId: string,
  input: UpdateLodgeCommissionInput,
): Promise<LodgeCommissionConfig> {
  return apiClient.request<LodgeCommissionConfig>(`/admin/lodges/${lodgeId}/commission`, {
    body: input,
    method: 'PATCH',
  });
}

export async function assignGovernanceLodgeOwner(
  lodgeId: string,
  input: AssignLodgeOwnerInput,
): Promise<{ success: true }> {
  return apiClient.post<{ success: true }>(`/admin/lodges/${lodgeId}/owners`, input);
}

export async function listGovernanceRoomTypes(lodgeId: string): Promise<RoomType[]> {
  return apiClient.get<RoomType[]>(`/lodges/${lodgeId}/room-types`);
}

export async function createGovernanceRoomType(
  lodgeId: string,
  input: CreateRoomTypeInput,
): Promise<RoomType> {
  return apiClient.post<RoomType>(`/owner/lodges/${lodgeId}/room-types`, input);
}

export async function listGovernanceRooms(lodgeId: string): Promise<Room[]> {
  return apiClient.get<Room[]>(`/owner/lodges/${lodgeId}/rooms`);
}

export async function createGovernanceRoom(
  roomTypeId: string,
  input: CreateRoomInput,
): Promise<Room> {
  return apiClient.post<Room>(`/owner/room-types/${roomTypeId}/rooms`, input);
}

export async function updateGovernanceRoomStatus(
  roomId: string,
  input: RoomStatusInput,
): Promise<Room> {
  return apiClient.request<Room>(`/owner/rooms/${roomId}/status`, { body: input, method: 'PATCH' });
}

export async function listPendingGovernancePhotos(): Promise<PendingPhoto[]> {
  return apiClient.get<PendingPhoto[]>('/admin/photos/pending');
}

export async function listGovernanceLodgePhotos(lodgeId: string): Promise<LodgePhoto[]> {
  return apiClient.get<LodgePhoto[]>(`/owner/lodges/${lodgeId}/photos`);
}

export async function updateGovernancePhotoApproval(
  photoId: string,
  status: PhotoApprovalStatus,
  input?: PhotoRejectionInput,
): Promise<LodgePhoto> {
  if (status === 'APPROVED')
    return apiClient.request<LodgePhoto>(`/admin/photos/${photoId}/approve`, { method: 'PATCH' });
  return apiClient.request<LodgePhoto>(`/admin/photos/${photoId}/reject`, {
    body: input,
    method: 'PATCH',
  });
}

export async function listGovernanceAmenities(): Promise<Amenity[]> {
  return apiClient.get<Amenity[]>('/amenities');
}

export async function assignGovernanceAmenities(
  lodgeId: string,
  input: AssignAmenitiesInput,
): Promise<{ success: true }> {
  return apiClient.post<{ success: true }>(`/admin/lodges/${lodgeId}/amenities`, input);
}
