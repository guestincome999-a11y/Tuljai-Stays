import type { AppType, DevicePlatform, ISODateTime, OtpPurpose, UserRole, UUID } from './common';

export interface AuthenticatedUser {
  id: UUID;
  isActive: boolean;
  phoneNumber: string | null;
  roles: UserRole[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface JwtPayload {
  phoneNumber: string | null;
  roles: UserRole[];
  sub: UUID;
}

export interface AuthUserProfile extends AuthenticatedUser {
  displayName: string | null;
  lastLoginAt: ISODateTime | null;
}

export interface UpdateAuthProfileRequest {
  displayName: string;
}

export interface RequestOtpRequest {
  appType: AppType;
  phoneNumber: string;
  purpose: OtpPurpose;
}

export interface RequestOtpResponse {
  expiresAt: ISODateTime;
  otpForTesting?: string;
}

export interface VerifyOtpRequest {
  appType: AppType;
  deviceId: string;
  deviceName?: string;
  fcmToken?: string;
  otp: string;
  phoneNumber: string;
  platform: DevicePlatform;
}

export interface VerifyOtpResponse {
  onboardingRequired?: boolean;
  session: UserSession;
  tokens: AuthTokens;
  user: AuthUserProfile;
}

export interface GoogleLoginRequest {
  appType: 'PILGRIM_APP';
  deviceId: string;
  deviceName?: string;
  fcmToken?: string;
  platform: DevicePlatform;
  supabaseAccessToken: string;
}

export interface RefreshTokenRequest {
  deviceId: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}

export interface LogoutRequest {
  deactivateDeviceToken?: boolean;
  deviceId: string;
  refreshToken: string;
}

export interface RegisterDeviceTokenRequest {
  appType: AppType;
  deviceId: string;
  fcmToken: string;
  platform: DevicePlatform;
}

export interface UserSession {
  appType: AppType;
  createdAt: ISODateTime;
  deviceId: string;
  deviceName: string | null;
  id: UUID;
  isActive: boolean;
  lastSeenAt: ISODateTime;
  platform: DevicePlatform;
  userId: UUID;
}

export interface DeviceToken {
  appType: AppType;
  createdAt: ISODateTime;
  deviceId: string;
  fcmToken: string;
  id: UUID;
  isActive: boolean;
  platform: DevicePlatform;
  userId: UUID;
}
