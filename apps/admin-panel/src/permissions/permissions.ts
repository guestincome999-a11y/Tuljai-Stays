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

const adminPermissions: AdminPermission[] = [
  'dashboard.view',
  'operations.view',
  'lodges.view',
  'lodges.manage',
  'owners.view',
  'owners.manage',
  'bookings.view',
  'bookings.manage',
  'rooms.view',
  'rooms.manage',
  'photos.review',
  'announcements.manage',
  'reports.view',
  'analytics.view',
  'audit_logs.view',
  'support.view',
  'support.manage',
  'system_health.view',
];

const rolePermissionMap: Record<AdminRole, AdminPermission[]> = {
  ADMIN: adminPermissions,
  ANALYST: ['dashboard.view', 'reports.view', 'analytics.view', 'system_health.view'],
  FINANCE_ADMIN: [
    'dashboard.view',
    'reports.view',
    'reports.export',
    'finance.view',
    'finance.manage',
  ],
  OPERATIONS_MANAGER: [
    'dashboard.view',
    'operations.view',
    'lodges.view',
    'lodges.manage',
    'owners.view',
    'owners.manage',
    'bookings.view',
    'bookings.manage',
    'rooms.view',
    'rooms.manage',
    'system_health.view',
  ],
  OWNER: [],
  PHOTO_REVIEWER: ['dashboard.view', 'lodges.view', 'photos.review'],
  PILGRIM: [],
  SUPER_ADMIN: allAdminPermissions,
  SUPPORT_EXECUTIVE: [
    'dashboard.view',
    'bookings.view',
    'support.view',
    'support.manage',
    'operations.view',
  ],
};

export function getPermissionsForRoles(roles: readonly string[]): AdminPermission[] {
  const permissions = new Set<AdminPermission>();

  for (const role of roles) {
    const rolePermissions = rolePermissionMap[role as AdminRole] ?? [];
    rolePermissions.forEach((permission) => permissions.add(permission));
  }

  return [...permissions].sort();
}

export function hasAdminAccess(roles: readonly string[]): boolean {
  return getPermissionsForRoles(roles).includes('dashboard.view');
}

export function hasPermission(
  permissions: readonly AdminPermission[],
  permission: AdminPermission,
): boolean {
  return permissions.includes(permission);
}
