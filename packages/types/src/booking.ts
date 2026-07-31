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

export type QrTokenStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';

export type QrScanResult =
  | 'SUCCESS'
  | 'INVALID'
  | 'EXPIRED'
  | 'USED'
  | 'UNAUTHORIZED'
  | 'BOOKING_NOT_FOUND'
  | 'WRONG_LODGE'
  | 'INVALID_STATUS';

export type GuestRegisterStatus =
  'CHECKED_IN' | 'CHECKED_OUT' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export type RegisterAuditAction =
  | 'REGISTER_CREATED'
  | 'DETAILS_VIEWED'
  | 'ID_MARKED_VERIFIED'
  | 'NOTES_UPDATED'
  | 'CHECKOUT_MARKED'
  | 'EXPORT_REQUESTED';

export interface BookingGuest {
  age: number | null;
  fullName: string;
  gender: string | null;
  id: UUID;
  idNumber: string | null;
  idProofMimeType: string | null;
  idProofOriginalName: string | null;
  idProofSizeBytes: number | null;
  idProofStoragePath: string | null;
  idType: GuestIdType | null;
  isPrimaryGuest: boolean;
  phone: string | null;
}

export interface BookingGuestIdProofUpload {
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  storagePath: string;
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
  checkoutDateFlexible: boolean;
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

export interface QrPayload {
  bookingCode: string;
  bookingId: UUID;
  expiresAt: ISODateTime;
  token: string;
  tokenVersion: number;
}

export interface QrTokenMetadata {
  bookingId: UUID;
  expiresAt: ISODateTime;
  id: UUID;
  status: QrTokenStatus;
  tokenVersion: number;
  usedAt: ISODateTime | null;
}

export interface QrDisplayPayload {
  bookingCode: string;
  bookingId: UUID;
  expiresAt: ISODateTime;
  qrPayload: string;
  status: QrTokenStatus;
  tokenVersion: number;
}

export interface GuestIdDocument {
  documentHolderName: string | null;
  documentNumber: string;
  documentType: GuestIdType;
  id: UUID;
  verifiedAt: ISODateTime | null;
  verifiedByUserId: UUID | null;
}

export interface GuestRegisterGuest {
  age: number | null;
  fullName: string;
  gender: string | null;
  id: UUID;
  idNumber: string | null;
  idProofAvailable: boolean;
  idProofMimeType: string | null;
  idProofOriginalName: string | null;
  idType: GuestIdType | null;
  isPrimaryGuest: boolean;
  phone: string | null;
}

export interface GuestRegister {
  actualCheckoutAt: ISODateTime | null;
  alternatePhone: string | null;
  bookingCode: string;
  bookingId: UUID;
  checkInAt: ISODateTime;
  expectedCheckoutAt: ISODateTime | null;
  governmentIdNumber: string | null;
  governmentIdType: GuestIdType | null;
  guestAddress: string | null;
  guestEmail: string | null;
  guests: GuestRegisterGuest[];
  id: UUID;
  idDocuments: GuestIdDocument[];
  idVerified: boolean;
  lodgeId: UUID;
  numberOfAdults: number;
  numberOfChildren: number;
  ownerNotes: string | null;
  pilgrimUserId: UUID;
  primaryGuestName: string;
  primaryGuestPhone: string;
  qrTokenId: UUID | null;
  registerCode: string;
  roomId: UUID | null;
  roomNumber: string | null;
  roomTypeId: UUID;
  roomTypeName: string | null;
  status: GuestRegisterStatus;
  totalGuests: number;
}

export interface CheckInResponse {
  booking: Booking;
  register: GuestRegister;
  scanResult: QrScanResult;
}

export interface CheckoutResponse {
  booking: Booking;
  register: GuestRegister;
}

export interface QrScanLogEntry {
  bookingCode: string | null;
  bookingId: UUID | null;
  createdAt: ISODateTime;
  failureReason: string | null;
  guestName: string | null;
  id: UUID;
  lodgeId: UUID | null;
  result: QrScanResult;
}
