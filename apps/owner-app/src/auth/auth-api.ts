import type {
  LogoutRequest,
  OwnerForgotPasswordResponse,
  OwnerLoginResponse,
  OwnerResetPasswordResponse,
  RefreshTokenResponse,
} from '@tuljai/types';

import { apiClient } from '../api/client';
import { getDeviceName, getDevicePlatform, getOrCreateDeviceId } from '../device/device-identity';

export async function ownerLogin(email: string, password: string): Promise<OwnerLoginResponse> {
  const deviceId = await getOrCreateDeviceId();

  return apiClient.post<OwnerLoginResponse>('/auth/owner/login', {
    deviceId,
    deviceName: getDeviceName(),
    email,
    password,
    platform: getDevicePlatform(),
  });
}

export async function ownerForgotPassword(email: string): Promise<OwnerForgotPasswordResponse> {
  return apiClient.post<OwnerForgotPasswordResponse>('/auth/owner/forgot-password', { email });
}

export async function ownerResetPassword(
  token: string,
  newPassword: string,
): Promise<OwnerResetPasswordResponse> {
  return apiClient.post<OwnerResetPasswordResponse>('/auth/owner/reset-password', {
    newPassword,
    token,
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
