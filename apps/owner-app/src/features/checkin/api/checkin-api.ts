import type {
  Booking,
  CheckInResponse,
  CheckoutResponse,
  GuestIdType,
  GuestRegister,
  GuestRegisterStatus,
  PaginatedResponse,
  QrScanLogEntry,
  QrScanResult,
} from '@tuljai/types';
import { ApplicationError } from '@tuljai/utils';

import { apiClient } from '../../../api/client';

export interface ScanQrRequest {
  deviceId: string;
  qrPayload: string;
}

export interface RegisterQuery {
  bookingCode?: string;
  date?: string;
  guestName?: string;
  limit?: number;
  lodgeId?: string;
  page?: number;
  phone?: string;
  roomNumber?: string;
  status?: GuestRegisterStatus;
}

export interface QrScanHistoryQuery {
  fromDate?: string;
  limit?: number;
  lodgeId?: string;
  page?: number;
  result?: QrScanResult;
  toDate?: string;
}

export async function scanQrCode(input: ScanQrRequest): Promise<CheckInResponse> {
  // Keep the deployed scan DTO contract. The signed token identifies the
  // operation; the durable queue key is local and must not become an extra body field.
  return apiClient.post<CheckInResponse>('/qr/scan', {
    deviceId: input.deviceId,
    qrPayload: input.qrPayload,
  });
}

export async function collectPayAtLodge(
  bookingId: string,
  expectedAmount: string,
): Promise<Booking> {
  try {
    return await apiClient.post<Booking>(`/owner/bookings/${bookingId}/collect-payment`, {
      expectedAmount,
    });
  } catch (error) {
    if (
      error instanceof ApplicationError &&
      error.details.statusCode === 404 &&
      /^Cannot POST\b/iu.test(error.message)
    ) {
      throw new ApplicationError(
        'Payment collection is not available on the server yet. Payment has not been recorded. Please contact Tuljai Stays support.',
        'CASH_COLLECTION_UNAVAILABLE',
        error.details,
      );
    }
    throw error;
  }
}

export async function getGuestRegister(registerId: string): Promise<GuestRegister> {
  const register = await apiClient.get<GuestRegister>(`/owner/register/${registerId}`);

  return {
    ...register,
    guests: Array.isArray(register.guests) ? register.guests : [],
    idDocuments: Array.isArray(register.idDocuments) ? register.idDocuments : [],
  };
}

export async function downloadGuestIdProof(bookingId: string): Promise<ArrayBuffer> {
  return apiClient.request<ArrayBuffer>(`/owner/bookings/${bookingId}/guest-id-proof`, {
    method: 'GET',
    responseType: 'arraybuffer',
  });
}

export async function listGuestRegisters(
  query: RegisterQuery,
): Promise<PaginatedResponse<GuestRegister>> {
  return apiClient.get<PaginatedResponse<GuestRegister>>('/owner/register', { params: query });
}

export async function markRegisterIdVerified(
  registerId: string,
  input: {
    documentHolderName?: string;
    governmentIdNumber?: string;
    governmentIdType?: GuestIdType;
  },
): Promise<GuestRegister> {
  return apiClient.request<GuestRegister>(`/owner/register/${registerId}/id-verified`, {
    body: input,
    method: 'PATCH',
  });
}

export async function updateRegisterNotes(
  registerId: string,
  ownerNotes: string,
): Promise<GuestRegister> {
  return apiClient.request<GuestRegister>(`/owner/register/${registerId}/notes`, {
    body: { ownerNotes },
    method: 'PATCH',
  });
}

export async function checkoutRegister(registerId: string): Promise<CheckoutResponse> {
  return apiClient.post<CheckoutResponse>(`/owner/register/${registerId}/checkout`);
}

export async function listQrScanHistory(
  query: QrScanHistoryQuery,
): Promise<PaginatedResponse<QrScanLogEntry>> {
  return apiClient.get<PaginatedResponse<QrScanLogEntry>>('/owner/qr-scans', { params: query });
}
