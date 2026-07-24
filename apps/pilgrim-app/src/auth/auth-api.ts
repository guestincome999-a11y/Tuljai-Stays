import type {
  LogoutRequest,
  RefreshTokenResponse,
  RequestOtpResponse,
  UpdateAuthProfileRequest,
  VerifyOtpResponse,
} from '@tuljai/types';

import { apiClient } from '../api/client';
import { getDeviceName, getDevicePlatform, getOrCreateDeviceId } from '../device/device-identity';

export async function requestLoginOtp(phoneNumber: string): Promise<RequestOtpResponse> {
  if (useMockExperience()) {
    return {
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      otpForTesting: '123456',
    };
  }

  return apiClient.post<RequestOtpResponse>('/auth/request-otp', {
    appType: 'PILGRIM_APP',
    phoneNumber,
    purpose: 'LOGIN',
  });
}

export async function verifyLoginOtp(phoneNumber: string, otp: string): Promise<VerifyOtpResponse> {
  const deviceId = await getOrCreateDeviceId();

  if (useMockExperience()) {
    if (otp !== '123456') {
      throw new Error('Invalid demo OTP');
    }

    const now = new Date().toISOString();
    return {
      session: {
        appType: 'PILGRIM_APP',
        createdAt: now,
        deviceId,
        deviceName: getDeviceName(),
        id: 'demo-pilgrim-session',
        isActive: true,
        lastSeenAt: now,
        platform: getDevicePlatform(),
        userId: 'demo-pilgrim-user',
      },
      tokens: {
        accessToken: 'demo-pilgrim-access-token',
        expiresInSeconds: 86_400,
        refreshToken: 'demo-pilgrim-refresh-token',
      },
      user: {
        displayName: 'Anjali Kulkarni',
        id: 'demo-pilgrim-user',
        isActive: true,
        lastLoginAt: now,
        phoneNumber,
        roles: ['PILGRIM'],
      },
    };
  }

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
  if (useMockExperience() && refreshToken === 'demo-pilgrim-refresh-token') {
    return { accessToken: 'demo-pilgrim-access-token', expiresInSeconds: 86_400 };
  }

  const deviceId = await getOrCreateDeviceId();

  return apiClient.post<RefreshTokenResponse>('/auth/refresh-token', {
    deviceId,
    refreshToken,
  });
}

export async function logoutFromApi(refreshToken: string): Promise<void> {
  if (useMockExperience() && refreshToken === 'demo-pilgrim-refresh-token') {
    return;
  }

  const deviceId = await getOrCreateDeviceId();
  const payload: LogoutRequest = {
    deactivateDeviceToken: false,
    deviceId,
    refreshToken,
  };

  await apiClient.post('/auth/logout', payload);
}

export async function updateAuthProfile(
  input: UpdateAuthProfileRequest,
): Promise<VerifyOtpResponse['user']> {
  if (useMockExperience()) {
    const now = new Date().toISOString();
    return {
      displayName: input.displayName.trim(),
      id: 'demo-pilgrim-user',
      isActive: true,
      lastLoginAt: now,
      phoneNumber: '+919876543210',
      roles: ['PILGRIM'],
    };
  }

  return apiClient.request<VerifyOtpResponse['user']>('/auth/me', {
    body: input,
    method: 'PATCH',
  });
}

export function useMockExperience(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
}
