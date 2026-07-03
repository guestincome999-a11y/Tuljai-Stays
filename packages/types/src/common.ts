export type ISODateTime = string;
export type UUID = string;

export type UserRole = 'PILGRIM' | 'OWNER' | 'ADMIN' | 'SUPER_ADMIN';

export interface TimestampedEntity {
  id: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SoftDeletableEntity extends TimestampedEntity {
  deletedAt: ISODateTime | null;
}
