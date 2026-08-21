'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type PropsWithChildren } from 'react';

import { getAdminDisplayName, useAdminAuth } from '../auth/AdminAuthProvider';
import { AdminProtectedRoute } from '../auth/AdminProtectedRoute';
import { LiveOnlinePaymentsControl } from '../components/LiveOnlinePaymentsControl';
import { AdminIcon, type AdminIconName } from '../components/AdminIcon';
import { adminNavigationItems } from '../navigation/admin-navigation';
import { hasPermission } from '../permissions/permissions';

const ICONS: Record<string, AdminIconName> = {
  Dashboard: 'dashboard',
  'Live Operations': 'operations',
  Bookings: 'bookings',
  Lodges: 'lodges',
  'Add Lodge': 'lodges',
  'Import Lodges (Excel)': 'lodges',
  Owners: 'owners',
  Staff: 'staff',
  Rooms: 'rooms',
  'Photo Review': 'reviews',
  Finance: 'finance',
  'Promo Codes': 'marketing',
  Feedback: 'reviews',
  'Review Moderation': 'reviews',
  'User Support': 'support',
  Verification: 'verification',
  Announcements: 'notifications',
  'Festival Control': 'operations',
  'Emergency Control': 'security',
  Reports: 'reports',
  'Executive BI': 'analytics',
  Analytics: 'analytics',
  Revenue: 'finance',
  'Lodge Commission': 'finance',
  Performance: 'analytics',
  Exports: 'reports',
  'System Health': 'system',
  'API Health': 'system',
  'Notifications Monitor': 'notifications',
  'QR Monitor': 'qr',
  Security: 'security',
  Sessions: 'security',
  Backups: 'backups',
  'Audit Logs': 'audit',
  Settings: 'settings',
  'Feature Flags': 'settings',
};

export function AdminShell({ children }: PropsWithChildren) {
  const auth = useAdminAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleItems = adminNavigationItems.filter((item) => hasPermission(auth.permissions, item.permission));
  const groupedItems = useMemo(() => groupNavigation(visibleItems), [visibleItems]);
  const displayName = getAdminDisplayName(auth.session.user);
  const currentTitle = getCurrentTitle(pathname);

  return (
    <AdminProtectedRoute>
      <div className="admin-shell">
        <a className="skip-link" href="#admin-main-content">Skip to main content</a>
        {sidebarOpen ? <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button" /> : null}
        <aside className={sidebarOpen ? 'admin-sidebar admin-sidebar-open' : 'admin-sidebar'} aria-label="Admin navigation">
          <div className="brand-block">
            <span className="brand-mark">TS</span>
            <div className="brand-copy">
              <p className="brand-title">Tuljai Stays</p>
              <p className="brand-subtitle">Admin Command Center</p>
            </div>
            <button aria-label="Close navigation" className="sidebar-close" onClick={() => setSidebarOpen(false)} type="button">×</button>
          </div>
          <div className="sidebar-status">
            <span className="status-dot" />
            <span>Operations online</span>
            <span className="status-location">Tuljapur · INR</span>
          </div>
          <nav className="nav-stack">
            {groupedItems.map(([section, items]) => (
              <section key={section} className="nav-section">
                <p className="nav-section-title">{section}</p>
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const icon = ICONS[item.label] ?? 'system';
                  return (
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'nav-link nav-link-active' : 'nav-link'}
                      href={item.href}
                      key={item.label}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="nav-link-leading"><span className="nav-icon-wrap"><AdminIcon name={icon} /></span><span>{item.label}</span></span>
                    </Link>
                  );
                })}
              </section>
            ))}
          </nav>
          <div className="sidebar-footer-card">
            <div className="sidebar-footer-icon"><AdminIcon name="security" /></div>
            <div><strong>Protected workspace</strong><span>Role permissions active</span></div>
          </div>
        </aside>
        <div className="admin-main">
          <header className="admin-topbar">
            <div className="topbar-title-group">
              <button aria-label="Open navigation" className="mobile-menu-button" onClick={() => setSidebarOpen(true)} type="button"><span /><span /><span /></button>
              <div>
                <p className="breadcrumb"><span>Admin</span><b>/</b> {getCurrentSection(pathname)}</p>
                <h1>{currentTitle}</h1>
              </div>
            </div>
            <div className="topbar-actions">
              <span className="environment-badge"><span className="status-dot" />{process.env.NODE_ENV}</span>
              <Link aria-label="Account" className="icon-control" href="/admin/account"><AdminIcon name="owners" /></Link>
              <Link aria-label="Notifications" className="icon-control" href="/admin/notifications-monitor"><AdminIcon name="notifications" /><span className="notification-dot" /></Link>
              <Link className="user-menu" href="/admin/account"><span className="user-avatar">{displayName.slice(0, 1).toUpperCase()}</span><span className="user-menu-name">{displayName}</span></Link>
              <button className="button button-secondary topbar-logout" type="button" onClick={() => void auth.signOut()}>Logout</button>
            </div>
          </header>
          <main className="admin-content" id="admin-main-content" tabIndex={-1}>
            {pathname === '/admin/dashboard' ? <LiveOnlinePaymentsControl /> : null}
            {children}
          </main>
        </div>
      </div>
    </AdminProtectedRoute>
  );
}

function groupNavigation(items: typeof adminNavigationItems): Array<[string, typeof adminNavigationItems]> {
  const sections = new Map<string, typeof adminNavigationItems>();
  for (const item of items) {
    const existing = sections.get(item.section) ?? [];
    sections.set(item.section, [...existing, item]);
  }
  return [...sections.entries()];
}

function getCurrentSection(pathname: string): string {
  const currentItem = getCurrentNavigationItem(pathname);
  if (currentItem) return currentItem.section;
  if (pathname.includes('/audit')) return 'Audit Logs';
  if (pathname.includes('/bookings')) return 'Bookings';
  if (pathname.includes('/operations/intervention')) return 'Intervention Queue';
  if (pathname.includes('/account')) return 'Account';
  return 'Dashboard';
}

function getCurrentTitle(pathname: string): string {
  const currentItem = getCurrentNavigationItem(pathname);
  if (currentItem) return currentItem.label;
  if (pathname.includes('/audit')) return 'Audit Log Foundation';
  if (pathname.includes('/bookings')) return 'Booking Control Center';
  if (pathname.includes('/operations/intervention')) return 'Manual Intervention Queue';
  if (pathname.includes('/account')) return 'Account & Session';
  return 'Live Operations Center';
}

function getCurrentNavigationItem(pathname: string) {
  return adminNavigationItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0];
}
