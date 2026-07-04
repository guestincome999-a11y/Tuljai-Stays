import type {
  LogoutRequest,
  RefreshTokenResponse,
  RequestOtpResponse,
  VerifyOtpResponse,
} from '@tuljai/types';

import { apiClient } from '../api/client';
import { getDeviceName, getDevicePlatform, getOrCreateDeviceId } from '../device/device-identity';

export async function requestLoginOtp(phoneNumber: string): Promise<RequestOtpResponse> {
  return apiClient.post<RequestOtpResponse>('/auth/request-otp', {
    appType: 'PILGRIM_APP',
    phoneNumber,
    purpose: 'LOGIN',
  });
}

export async function verifyLoginOtp(phoneNumber: string, otp: string): Promise<VerifyOtpResponse> {
  const deviceId = await getOrCreateDeviceId();

  return apiClient.post<VerifyOtpResponse>('/auth/verify-otp', {
    appType: 'PILGRIM_APP',
    deviceId,
    deviceName: getDeviceName(),
    otp,
    phoneNumber,
    platform: getDevicePlatform(),
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshTokenResponse | null> {
  const deviceId = await getOrCreateDeviceId();

  return apiClient.post<RefreshTokenResponse>('/auth/refresh-token', {
    deviceId,
    refreshToken,
  });
}

export async function logoutFromApi(refreshToken: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const payload: LogoutRequest = {
    deactivateDeviceToken: false,
    deviceId,
    refreshToken,
  };

  await apiClient.post('/auth/logout', payload);
}
