import type { ISODateTime, UUID } from './common';

export type PropertyType = 'LODGE' | 'BHAKT_NIWAS' | 'DHARAMSHALA' | 'HOTEL' | 'HOMESTAY';
export type LodgeStatus = 'DRAFT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type AmenityCategory =
  'ROOM' | 'PROPERTY' | 'SAFETY' | 'FAMILY' | 'PARKING' | 'FOOD' | 'ACCESSIBILITY';
export type RoomStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'OCCUPIED'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'BLOCKED';
export type PriceType = 'NORMAL' | 'WEEKEND' | 'FESTIVAL' | 'MANUAL_OVERRIDE';
export type PhotoCategory =
  'COVER' | 'EXTERIOR' | 'RECEPTION' | 'ROOM' | 'BATHROOM' | 'PARKING' | 'AMENITY' | 'OTHER';
export type PhotoApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface City {
  country: string;
  id: UUID;
  isActive: boolean;
  name: string;
  slug: string;
  state: string;
}

export interface Amenity {
  category: AmenityCategory;
  iconName: string | null;
  id: UUID;
  isActive: boolean;
  name: string;
  slug: string;
}

export interface LodgeAddress {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  country: string;
  district: string;
  landmark: string | null;
  pincode: string;
  state: string;
}

export interface Lodge {
  cityId: UUID;
  description: string | null;
  distanceFromTempleMeters: number | null;
  id: UUID;
  isActive: boolean;
  name: string;
  primaryPhone: string;
  propertyType: PropertyType;
  slug: string;
  status: LodgeStatus;
  verificationStatus: VerificationStatus;
}

export interface LodgeDetails extends Lodge {
  address: LodgeAddress | null;
  amenities: Amenity[];
  checkInTime: string | null;
  checkOutTime: string | null;
  email: string | null;
  latitude: string | null;
  longitude: string | null;
  rules: string | null;
  secondaryPhone: string | null;
  whatsappNumber: string | null;
}

export interface RoomType {
  basePrice: string;
  capacityAdults: number;
  capacityChildren: number;
  description: string | null;
  festivalPrice: string | null;
  id: UUID;
  isActive: boolean;
  lodgeId: UUID;
  name: string;
  slug: string;
  totalRooms: number;
}

export interface Room {
  floor: string | null;
  id: UUID;
  isActive: boolean;
  lodgeId: UUID;
  roomNumber: string;
  roomTypeId: UUID;
  status: RoomStatus;
}

export interface LodgePhoto {
  approvalStatus: PhotoApprovalStatus;
  category: PhotoCategory;
  fileUrl: string;
  id: UUID;
  isCover: boolean;
  lodgeId: UUID;
  roomId: UUID | null;
  roomTypeId: UUID | null;
  sortOrder: number;
  thumbnailUrl: string | null;
}

export interface RoomPricing {
  createdAt: ISODateTime;
  date: string;
  id: UUID;
  price: string;
  priceType: PriceType;
  roomTypeId: UUID;
}
