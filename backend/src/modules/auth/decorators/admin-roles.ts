import { SetMetadata } from '@nestjs/common';

export const STAFF_ROLES = [
  'FINANCE_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPPORT_EXECUTIVE',
  'PHOTO_REVIEWER',
  'ANALYST',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type AccessRole = 'PILGRIM' | 'OWNER' | 'ADMIN' | 'SUPER_ADMIN' | StaffRole;

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AccessRole[]) => SetMetadata(ROLES_KEY, roles);
