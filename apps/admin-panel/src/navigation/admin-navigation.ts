import type { AdminPermission } from '../permissions/permissions';

export interface AdminNavigationItem {
  href: string;
  label: string;
  permission: AdminPermission;
  section: 'Core' | 'Operations' | 'Governance';
  status?: 'ready' | 'placeholder';
}

export const adminNavigationItems: AdminNavigationItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', permission: 'dashboard.view', section: 'Core', status: 'ready' },
  { href: '/admin/users', label: 'User Tracking', permission: 'users.view', section: 'Operations', status: 'ready' },
  { href: '/admin/operations/intervention', label: 'Live Operations', permission: 'operations.view', section: 'Operations', status: 'ready' },
  { href: '/admin/bookings', label: 'Bookings', permission: 'bookings.view', section: 'Operations', status: 'ready' },
  { href: '/admin/lodges', label: 'Lodges', permission: 'lodges.view', section: 'Operations', status: 'ready' },
  { href: '/admin/lodges/new', label: 'Add Lodge', permission: 'lodges.manage', section: 'Operations', status: 'ready' },
  { href: '/admin/lodges/import', label: 'Import Lodges (Excel)', permission: 'lodges.manage', section: 'Operations', status: 'ready' },
  { href: '/admin/owners', label: 'Owners', permission: 'owners.view', section: 'Operations', status: 'ready' },
  { href: '/admin/rooms', label: 'Rooms', permission: 'rooms.view', section: 'Operations', status: 'ready' },
  { href: '/admin/photos', label: 'Photo Review', permission: 'photos.review', section: 'Operations', status: 'ready' },
  { href: '/admin/finance', label: 'Finance', permission: 'finance.view', section: 'Operations', status: 'ready' },
  { href: '/admin/verification', label: 'Verification', permission: 'lodges.view', section: 'Governance', status: 'ready' },
  { href: '/admin/announcements', label: 'Announcements', permission: 'announcements.manage', section: 'Operations', status: 'ready' },
  { href: '/admin/festival-control', label: 'Festival Control', permission: 'settings.manage', section: 'Operations', status: 'ready' },
  { href: '/admin/emergency-control', label: 'Emergency Control', permission: 'security.manage', section: 'Operations', status: 'ready' },
  { href: '/admin/reports', label: 'Reports', permission: 'reports.view', section: 'Core', status: 'placeholder' },
  { href: '/admin/executive', label: 'Executive BI', permission: 'analytics.view', section: 'Core', status: 'ready' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'analytics.view', section: 'Core', status: 'ready' },
  { href: '/admin/revenue', label: 'Revenue', permission: 'finance.view', section: 'Core', status: 'ready' },
  { href: '/admin/commission', label: 'Lodge Commission', permission: 'finance.view', section: 'Core', status: 'ready' },
  { href: '/admin/performance', label: 'Performance', permission: 'reports.view', section: 'Core', status: 'ready' },
  { href: '/admin/exports', label: 'Exports', permission: 'reports.export', section: 'Core', status: 'ready' },
  { href: '/admin/support', label: 'Support', permission: 'support.view', section: 'Operations', status: 'placeholder' },
  { href: '/admin/system-health', label: 'System Health', permission: 'system_health.view', section: 'Governance', status: 'ready' },
  { href: '/admin/api-health', label: 'API Health', permission: 'system_health.view', section: 'Governance', status: 'ready' },
  { href: '/admin/notifications-monitor', label: 'Notifications Monitor', permission: 'system_health.view', section: 'Governance', status: 'ready' },
  { href: '/admin/qr-monitor', label: 'QR Monitor', permission: 'system_health.view', section: 'Governance', status: 'ready' },
  { href: '/admin/security', label: 'Security', permission: 'security.manage', section: 'Governance', status: 'ready' },
  { href: '/admin/sessions', label: 'Sessions', permission: 'security.manage', section: 'Governance', status: 'ready' },
  { href: '/admin/backups', label: 'Backups', permission: 'system_health.view', section: 'Governance', status: 'ready' },
  { href: '/admin/audit', label: 'Audit Logs', permission: 'audit_logs.view', section: 'Governance', status: 'ready' },
  { href: '/admin/settings', label: 'Settings', permission: 'settings.manage', section: 'Governance', status: 'ready' },
  { href: '/admin/feature-flags', label: 'Feature Flags', permission: 'feature_flags.manage', section: 'Governance', status: 'ready' },
];
