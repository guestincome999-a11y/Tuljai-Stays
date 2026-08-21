import { apiClient } from './client';

export interface TotpSetupResponse {
  account: string;
  otpauthUri: string;
  secret: string;
}

export async function getAdminTwoFactorStatus(): Promise<{ enabled: boolean }> {
  return apiClient.get<{ enabled: boolean }>('/admin/security/2fa/status');
}

export async function setupAdminTwoFactor(): Promise<TotpSetupResponse> {
  return apiClient.post<TotpSetupResponse>('/admin/security/2fa/setup');
}

export async function verifyAdminTwoFactor(code: string): Promise<{ enabled: boolean }> {
  return apiClient.post<{ enabled: boolean }>('/admin/security/2fa/verify', { code });
}

export async function disableAdminTwoFactor(code: string): Promise<{ enabled: boolean }> {
  return apiClient.post<{ enabled: boolean }>('/admin/security/2fa/disable', { code });
}
