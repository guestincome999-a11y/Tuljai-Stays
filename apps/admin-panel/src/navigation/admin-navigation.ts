import type { AdminIconName } from '../components/AdminIcon';
import type { AdminPermission } from '../permissions/permissions';

export type AdminNavigationSection =
  | 'Dashboard'
  | 'Lodges & Owners'
  | 'Bookings'
  | 'Users'
  | 'Finance'
  | 'Content'
  | 'Notifications'
  | 'Reviews & Moderation'
  | 'Reports'
  | 'Settings'
  | 'Admin Activity';

export interface AdminNavigationItem {
  href: string;
  label: string;
  permission: AdminPermission;
  section: AdminNavigationSection;
  icon: AdminIconName;
  status?: 'ready' | 'placeholder';
  /** Route stays available but has no sidebar entry (reachable via section tabs or direct link). */
  hidden?: boolean;
  /** Pages sharing a tabGroup show a tab bar so related views live under one sidebar entry. */
  tabGroup?: string;
  tabLabel?: string;
}

export const adminNavigationItems: AdminNavigationItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', permission: 'dashboard.view', section: 'Dashboard', icon: 'dashboard', status: 'ready' },

  { href: '/admin/lodges', label: 'All Lodges', permission: 'lodges.view', section: 'Lodges & Owners', icon: 'lodges', status: 'ready' },
  { href: '/admin/owners', label: 'Owners', permission: 'owners.view', section: 'Lodges & Owners', icon: 'owners', status: 'ready' },
  { href: '/admin/rooms', label: 'Rooms', permission: 'rooms.view', section: 'Lodges & Owners', icon: 'rooms', status: 'ready' },
  { href: '/admin/lodges/new', label: 'Add Lodge', permission: 'lodges.manage', section: 'Lodges & Owners', icon: 'lodges', status: 'ready' },
  { href: '/admin/lodges/import', label: 'Import Lodges (Excel)', permission: 'lodges.manage', section: 'Lodges & Owners', icon: 'lodges', status: 'ready' },
  { href: '/admin/verification', label: 'Verification', permission: 'lodges.view', section: 'Lodges & Owners', icon: 'verification', status: 'ready', tabGroup: 'verification', tabLabel: 'Lodge Verification' },
  { href: '/admin/photos', label: 'Photo Review', permission: 'photos.review', section: 'Lodges & Owners', icon: 'reviews', status: 'ready', hidden: true, tabGroup: 'verification', tabLabel: 'Photo Review' },

  { href: '/admin/bookings', label: 'All Bookings', permission: 'bookings.view', section: 'Bookings', icon: 'bookings', status: 'ready' },
  { href: '/admin/operations/intervention', label: 'Manual Intervention', permission: 'operations.view', section: 'Bookings', icon: 'operations', status: 'ready' },

  { href: '/admin/users', label: 'All Pilgrims', permission: 'users.view', section: 'Users', icon: 'owners', status: 'ready' },
  { href: '/admin/support', label: 'User Support', permission: 'support.view', section: 'Users', icon: 'support', status: 'ready' },

  { href: '/admin/finance', label: 'Finance Overview', permission: 'finance.view', section: 'Finance', icon: 'finance', status: 'ready' },
  { href: '/admin/revenue', label: 'Revenue', permission: 'finance.view', section: 'Finance', icon: 'finance', status: 'ready' },
  { href: '/admin/commission', label: 'Fees & Commission', permission: 'finance.view', section: 'Finance', icon: 'finance', status: 'ready' },

  { href: '/admin/announcements', label: 'Announcements', permission: 'announcements.manage', section: 'Content', icon: 'notifications', status: 'ready' },
  { href: '/admin/festival-control', label: 'Festival Control', permission: 'settings.manage', section: 'Content', icon: 'operations', status: 'ready', tabGroup: 'festival', tabLabel: 'Festival Control' },
  { href: '/admin/emergency-control', label: 'Emergency Control', permission: 'security.manage', section: 'Content', icon: 'security', status: 'ready', hidden: true, tabGroup: 'festival', tabLabel: 'Emergency Control' },

  { href: '/admin/notifications-monitor', label: 'Notifications', permission: 'system_health.view', section: 'Notifications', icon: 'notifications', status: 'ready' },

  { href: '/admin/reviews', label: 'Reviews & Moderation', permission: 'reviews.manage', section: 'Reviews & Moderation', icon: 'reviews', status: 'ready', tabGroup: 'reviews', tabLabel: 'Review Moderation' },
  { href: '/admin/feedback', label: 'Pilgrim Feedback', permission: 'lodges.view', section: 'Reviews & Moderation', icon: 'reviews', status: 'ready', hidden: true, tabGroup: 'reviews', tabLabel: 'Feedback' },

  { href: '/admin/reports', label: 'Reports', permission: 'reports.view', section: 'Reports', icon: 'reports', status: 'ready', tabGroup: 'reports', tabLabel: 'Reports' },
  { href: '/admin/executive', label: 'Executive BI', permission: 'analytics.view', section: 'Reports', icon: 'analytics', status: 'ready', hidden: true, tabGroup: 'reports', tabLabel: 'Executive BI' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'analytics.view', section: 'Reports', icon: 'analytics', status: 'ready', hidden: true, tabGroup: 'reports', tabLabel: 'Analytics' },
  { href: '/admin/performance', label: 'Performance', permission: 'reports.view', section: 'Reports', icon: 'analytics', status: 'ready', hidden: true, tabGroup: 'reports', tabLabel: 'Performance' },
  { href: '/admin/exports', label: 'Exports', permission: 'reports.export', section: 'Reports', icon: 'reports', status: 'ready', hidden: true, tabGroup: 'reports', tabLabel: 'Exports' },

  { href: '/admin/settings', label: 'Settings', permission: 'settings.manage', section: 'Settings', icon: 'settings', status: 'ready', tabGroup: 'settings', tabLabel: 'Settings' },
  { href: '/admin/feature-flags', label: 'Feature Flags', permission: 'feature_flags.manage', section: 'Settings', icon: 'settings', status: 'ready', hidden: true, tabGroup: 'settings', tabLabel: 'Feature Flags' },
  { href: '/admin/staff', label: 'Platform Team', permission: 'settings.manage', section: 'Settings', icon: 'staff', status: 'ready', hidden: true, tabGroup: 'settings', tabLabel: 'Platform Team' },

  { href: '/admin/audit', label: 'Admin Activity', permission: 'audit_logs.view', section: 'Admin Activity', icon: 'audit', status: 'ready', tabGroup: 'activity', tabLabel: 'Activity Log' },
  { href: '/admin/security', label: 'Security', permission: 'security.manage', section: 'Admin Activity', icon: 'security', status: 'ready', hidden: true, tabGroup: 'activity', tabLabel: 'Security' },
  { href: '/admin/sessions', label: 'Sessions', permission: 'security.manage', section: 'Admin Activity', icon: 'security', status: 'ready', hidden: true, tabGroup: 'activity', tabLabel: 'Sessions' },

  // Removed from the sidebar by product decision. Routes are kept so nothing is deleted.
  { href: '/admin/promotions', label: 'Promo Codes', permission: 'finance.manage', section: 'Content', icon: 'marketing', status: 'ready', hidden: true },
  { href: '/admin/system-health', label: 'System Health', permission: 'system_health.view', section: 'Settings', icon: 'system', status: 'ready', hidden: true },
  { href: '/admin/api-health', label: 'API Health', permission: 'system_health.view', section: 'Settings', icon: 'system', status: 'ready', hidden: true },
  { href: '/admin/qr-monitor', label: 'QR Monitor', permission: 'system_health.view', section: 'Settings', icon: 'qr', status: 'ready', hidden: true },
  { href: '/admin/backups', label: 'Backups', permission: 'system_health.view', section: 'Settings', icon: 'backups', status: 'ready', hidden: true },
];
