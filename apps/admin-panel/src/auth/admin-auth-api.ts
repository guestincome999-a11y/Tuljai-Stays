import type {
  AuthUserProfile,
  LogoutRequest,
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@tuljai/types';

import { apiClient } from '../api/client';

export async function requestAdminOtp(phoneNumber: string): Promise<RequestOtpResponse> {
  const body: RequestOtpRequest = {
    appType: 'ADMIN_PANEL',
    phoneNumber,
    purpose: 'LOGIN',
  };

  return apiClient.post<RequestOtpResponse>('/auth/request-otp', body);
}

export async function verifyAdminOtp(input: {
  deviceId: string;
  otp: string;
  phoneNumber: string;
}): Promise<VerifyOtpResponse> {
  const body: VerifyOtpRequest = {
    appType: 'ADMIN_PANEL',
    deviceId: input.deviceId,
    deviceName: 'Admin Browser',
    otp: input.otp,
    phoneNumber: input.phoneNumber,
    platform: 'WEB',
  };

  return apiClient.post<VerifyOtpResponse>('/auth/verify-otp', body);
}

export async function getAdminProfile(): Promise<AuthUserProfile> {
  return apiClient.get<AuthUserProfile>('/auth/me');
}

export async function logoutAdmin(input: LogoutRequest): Promise<{ success: true }> {
  return apiClient.post<{ success: true }>('/auth/logout', input);
}
