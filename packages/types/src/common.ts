export type ISODateTime = string;
export type UUID = string;

export type UserRole = 'PILGRIM' | 'OWNER' | 'ADMIN' | 'SUPER_ADMIN';
export type AppType = 'PILGRIM_APP' | 'OWNER_APP' | 'ADMIN_PANEL';
export type DevicePlatform = 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN';
export type OtpPurpose = 'LOGIN' | 'REGISTER' | 'VERIFY_PHONE';

export interface TimestampedEntity {
  id: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SoftDeletableEntity extends TimestampedEntity {
  deletedAt: ISODateTime | null;
}
