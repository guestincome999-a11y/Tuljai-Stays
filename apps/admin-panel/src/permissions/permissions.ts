import type { UserRole } from '@tuljai/types';

export type AdminRole =
  | UserRole
  | 'OPERATIONS_MANAGER'
  | 'SUPPORT_EXECUTIVE'
  | 'PHOTO_REVIEWER'
  | 'FINANCE_ADMIN'
  | 'ANALYST';

export type AdminPermission =
  | 'dashboard.view'
  | 'operations.view'
  | 'lodges.view'
  | 'lodges.manage'
  | 'owners.view'
  | 'owners.manage'
  | 'bookings.view'
  | 'bookings.manage'
  | 'bookings.override'
  | 'rooms.view'
  | 'rooms.manage'
  | 'photos.review'
  | 'reviews.manage'
  | 'announcements.manage'
  | 'settings.manage'
  | 'feature_flags.manage'
  | 'reports.view'
  | 'reports.export'
  | 'analytics.view'
  | 'audit_logs.view'
  | 'security.manage'
  | 'support.view'
  | 'support.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'system_health.view';

export const allAdminPermissions: AdminPermission[] = [
  'dashboard.view',
  'operations.view',
  'lodges.view',
  'lodges.manage',
  'owners.view',
  'owners.manage',
  'bookings.view',
  'bookings.manage',
  'bookings.override',
  'rooms.view',
  'rooms.manage',
  'photos.review',
  'reviews.manage',
  'announcements.manage',
  'settings.manage',
  'feature_flags.manage',
  'reports.view',
  'reports.export',
  'analytics.view',
  'audit_logs.view',
  'security.manage',
  'support.view',
  'support.manage',
  'finance.view',
  'finance.manage',
  'system_health.view',
];
