import type { UserRole, UUID } from './common';

export interface AuthenticatedUser {
  id: UUID;
  phoneNumber: string;
  roles: UserRole[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface JwtPayload {
  sub: UUID;
  phoneNumber: string;
  roles: UserRole[];
}
