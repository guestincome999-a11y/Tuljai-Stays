import type { ISODateTime, UUID } from './common';

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_OWNER_APPROVAL'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'QR_GENERATED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NO_SHOW';

export type PaymentStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'ADVANCE_PAID'
  | 'FULLY_PAID'
  | 'PAY_AT_LODGE'
  | 'REFUNDED'
  | 'FAILED';

export type GuestIdType = 'AADHAAR' | 'PAN' | 'VOTER_ID' | 'PASSPORT' | 'DRIVING_LICENSE' | 'OTHER';

export type BookingLockStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'RELEASED';

export interface BookingGuest {
  age: number | null;
  fullName: string;
  gender: string | null;
  id: UUID;
  idNumber: string | null;
  idType: GuestIdType | null;
  isPrimaryGuest: boolean;
  phone: string | null;
}

export interface Booking {
  acceptedByUserId: UUID | null;
  advanceAmount: string | null;
  alternatePhone: string | null;
  balanceAmount: string | null;
  bookingCode: string;
  cancellationReason: string | null;
  checkInDate: string;
  checkOutDate: string;
  checkedInAt: ISODateTime | null;
  checkedOutAt: ISODateTime | null;
  cityId: UUID;
  commissionAmount: string | null;
  createdAt: ISODateTime;
  expectedCheckInTime: string | null;
  expectedCheckOutTime: string | null;
  guestAddress: string | null;
  guestEmail: string | null;
  guestName: string;
  guestPhone: string | null;
  guests: BookingGuest[];
  id: UUID;
  lodgeId: UUID;
  numberOfAdults: number;
  numberOfChildren: number;
  ownerResponseDeadline: ISODateTime | null;
  paymentStatus: PaymentStatus;
  pilgrimUserId: UUID;
  rejectedByUserId: UUID | null;
  rejectedReason: string | null;
  roomId: UUID | null;
  roomTypeId: UUID;
  specialRequest: string | null;
  status: BookingStatus;
  totalAmount: string | null;
  totalGuests: number;
  updatedAt: ISODateTime;
}

export interface BookingLock {
  checkInDate: string;
  checkOutDate: string;
  expiresAt: ISODateTime;
  id: UUID;
  lockCode: string;
  lodgeId: UUID;
  roomId: UUID | null;
  roomTypeId: UUID;
  status: BookingLockStatus;
}

export interface BookingHistory {
  action: string;
  actorUserId: UUID | null;
  bookingId: UUID;
  createdAt: ISODateTime;
  fromStatus: BookingStatus | null;
  id: UUID;
  metadata: unknown;
  notes: string | null;
  toStatus: BookingStatus;
}

export interface AvailabilityResponse {
  available: boolean;
  availableRoomCount: number;
  lodgeId: UUID;
  priceSummary: {
    basePrice: string;
    currency: 'INR';
    festivalPrice: string | null;
  } | null;
  roomTypeId: UUID;
}

export interface OwnerBookingSummary extends Booking {
  lodgeName: string;
  roomNumber: string | null;
  roomTypeName: string;
}

export interface AdminBookingSummary extends OwnerBookingSummary {
  cityName: string;
}
