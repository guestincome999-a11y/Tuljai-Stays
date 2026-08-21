'use client';

export type AdminIconName =
  | 'dashboard'
  | 'operations'
  | 'bookings'
  | 'lodges'
  | 'owners'
  | 'rooms'
  | 'reviews'
  | 'finance'
  | 'reports'
  | 'analytics'
  | 'support'
  | 'security'
  | 'system'
  | 'settings'
  | 'audit'
  | 'staff'
  | 'marketing'
  | 'verification'
  | 'notifications'
  | 'qr'
  | 'backups';

const PATHS: Record<AdminIconName, string> = {
  dashboard: 'M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-12h6V4h-6v4Z',
  operations: 'M12 3a9 9 0 1 0 9 9h-9V3Zm2 0v7h7a9 9 0 0 0-7-7Z',
  bookings: 'M7 3v3m10-3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 8 2 2 5-5',
  lodges: 'M4 21V6l8-3 8 3v15M4 10h16M8 21v-6h8v6M8 10v2m4-2v2m4-2v2',
  owners: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m9-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm5-5h4m-2-2v4',
  rooms: 'M3 20v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 16h18M7 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4M6 20v1m12-1v1',
  reviews: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z',
  finance: 'M12 2v20M17 6.5c0-1.7-2.2-3-5-3S7 4.8 7 6.5s2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3',
  reports: 'M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h8',
  analytics: 'M4 19V9m5 10V5m5 14v-7m5 7V3',
  support: 'M4 5h16v11H8l-4 4V5Zm4 5h8m-8 3h5',
  security: 'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Zm-3 9 2 2 4-4',
  system: 'M4 5h16M4 12h16M4 19h16M8 5v3m8 4v3m-5 4v3',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m9-8h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6',
  audit: 'M7 3h10v18H7V3Zm3 4h4m-4 4h4m-4 4h4',
  staff: 'M4 20v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  marketing: 'M3 11v2l12 4V7L3 11Zm12 0h3a3 3 0 0 1 0 6h-3m-9-5 1 6',
  verification: 'M12 3 4 6v5c0 5 3.4 8 8 10 4.6-2 8-5 8-10V6l-8-3Zm-3 9 2 2 4-4',
  notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 4h2m2 2h2m-4-6h4v4',
  backups: 'M4 7h16v13H4V7Zm3-4h10l2 4H5l2-4Zm2 9h6',
};

export function AdminIcon({ name, size = 18 }: { name: AdminIconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="admin-nav-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d={PATHS[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
