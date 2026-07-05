import type { AdminPermission } from '../permissions/permissions';

export interface AdminNavigationItem {
  href: string;
  label: string;
  permission: AdminPermission;
  section: 'Core' | 'Operations' | 'Governance';
  status?: 'ready' | 'placeholder';
}

export const adminNavigationItems: AdminNavigationItem[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    permission: 'dashboard.view',
    section: 'Core',
    status: 'ready',
  },
  {
    href: '/admin/operations/intervention',
    label: 'Live Operations',
    permission: 'operations.view',
    section: 'Operations',
    status: 'ready',
  },
  {
    href: '/admin/bookings',
    label: 'Bookings',
    permission: 'bookings.view',
    section: 'Operations',
    status: 'ready',
  },
  {
    href: '/admin/lodges',
    label: 'Lodges',
    permission: 'lodges.view',
    section: 'Operations',
    status: 'placeholder',
  },
  {
    href: '/admin/owners',
    label: 'Owners',
    permission: 'owners.view',
    section: 'Operations',
    status: 'placeholder',
  },
  {
    href: '/admin/rooms',
    label: 'Rooms',
    permission: 'rooms.view',
    section: 'Operations',
    status: 'placeholder',
  },
  {
    href: '/admin/photo-review',
    label: 'Photo Review',
    permission: 'photos.review',
    section: 'Operations',
    status: 'placeholder',
  },
  {
    href: '/admin/announcements',
    label: 'Announcements',
    permission: 'announcements.manage',
    section: 'Operations',
    status: 'placeholder',
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    permission: 'reports.view',
    section: 'Core',
    status: 'placeholder',
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    permission: 'analytics.view',
    section: 'Core',
    status: 'placeholder',
  },
  {
    href: '/admin/support',
    label: 'Support',
    permission: 'support.view',
    section: 'Operations',
    status: 'placeholder',
  },
  {
    href: '/admin/system-health',
    label: 'System Health',
    permission: 'system_health.view',
    section: 'Governance',
    status: 'placeholder',
  },
  {
    href: '/admin/security',
    label: 'Security',
    permission: 'security.manage',
    section: 'Governance',
    status: 'placeholder',
  },
  {
    href: '/admin/audit',
    label: 'Audit Logs',
    permission: 'audit_logs.view',
    section: 'Governance',
    status: 'ready',
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    permission: 'settings.manage',
    section: 'Governance',
    status: 'placeholder',
  },
  {
    href: '/admin/feature-flags',
    label: 'Feature Flags',
    permission: 'feature_flags.manage',
    section: 'Governance',
    status: 'placeholder',
  },
];
