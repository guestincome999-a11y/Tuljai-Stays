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
  Dashboard: 'dashboard', 'Live Operations': 'operations', Bookings: 'bookings', Lodges: 'lodges',
  'Add Lodge': 'lodges', 'Import Lodges (Excel)': 'lodges', Owners: 'owners', Staff: 'staff', Rooms: 'rooms',
  'Photo Review': 'reviews', Finance: 'finance', 'Promo Codes': 'marketing', Feedback: 'reviews',
  'Review Moderation': 'reviews', 'User Support': 'support', Verification: 'verification', Announcements: 'notifications',
  'Festival Control': 'operations', 'Emergency Control': 'security', Reports: 'reports', 'Executive BI': 'analytics',
  Analytics: 'analytics', Revenue: 'finance', 'Lodge Commission': 'finance', Performance: 'analytics', Exports: 'reports',
  'System Health': 'system', 'API Health': 'system', 'Notifications Monitor': 'notifications', 'QR Monitor': 'qr',
  Security: 'security', Sessions: 'security', Backups: 'backups', 'Audit Logs': 'audit', Settings: 'settings', 'Feature Flags': 'settings',
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
      <div className="admin-shell admin-command-shell">
        <a className="skip-link" href="#admin-main-content">Skip to main content</a>
        {sidebarOpen ? <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button" /> : null}
        <aside className={sidebarOpen ? 'admin-sidebar admin-sidebar-open' : 'admin-sidebar'} aria-label="Admin navigation">
          <div className="brand-block">
            <span className="brand-mark">TS</span>
            <div className="brand-copy"><p className="brand-title">Tuljai Stays</p><p className="brand-subtitle">Admin Command Center</p></div>
            <button aria-label="Close navigation" className="sidebar-close" onClick={() => setSidebarOpen(false)} type="button">×</button>
          </div>
          <div className="sidebar-status"><span className="status-dot" /><span>Operations online</span><span className="status-location">Tuljapur · INR</span></div>
          <nav className="nav-stack">
            {groupedItems.map(([section, items]) => (
              <section key={section} className="nav-section">
                <p className="nav-section-title">{section}</p>
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const icon = ICONS[item.label] ?? 'system';
                  return <Link aria-current={active ? 'page' : undefined} className={active ? 'nav-link nav-link-active' : 'nav-link'} href={item.href} key={item.label} onClick={() => setSidebarOpen(false)}>
                    <span className="nav-link-leading"><span className="nav-icon-wrap"><AdminIcon name={icon} /></span><span>{item.label}</span></span>
                  </Link>;
                })}
              </section>
            ))}
          </nav>
          <div className="sidebar-footer-card"><div className="sidebar-footer-icon"><AdminIcon name="security" /></div><div><strong>Protected workspace</strong><span>Role permissions active</span></div></div>
        </aside>
        <div className="admin-main">
          <header className="admin-topbar admin-topbar-premium">
            <div className="topbar-title-group">
              <button aria-label="Open navigation" className="mobile-menu-button" onClick={() => setSidebarOpen(true)} type="button"><span /><span /><span /></button>
              <div><p className="breadcrumb"><span>Admin</span><b>/</b> {getCurrentSection(pathname)}</p><h1>{currentTitle}</h1></div>
            </div>
            <div className="topbar-actions">
              <span className="environment-badge"><span className="status-dot" />{process.env.NODE_ENV}</span>
              <Link aria-label="Account" className="icon-control" href="/admin/account"><AdminIcon name="owners" /></Link>
              <Link aria-label="Notifications" className="icon-control notification-control" href="/admin/notifications-monitor"><AdminIcon name="notifications" /><span className="notification-dot" /></Link>
              <Link className="user-menu" href="/admin/account"><span className="user-avatar">{displayName.slice(0, 1).toUpperCase()}</span><span className="user-menu-name">{displayName}</span></Link>
              <button className="button button-secondary topbar-logout" type="button" onClick={() => void auth.signOut()}>Logout</button>
            </div>
          </header>
          <main className="admin-content" id="admin-main-content" tabIndex={-1}>
            {pathname === '/admin/dashboard' ? <LiveOnlinePaymentsControl /> : null}
            {children}
          </main>
        </div>
        <style jsx global>{`
          .admin-command-shell { min-height: 100vh; }
          .admin-command-shell .admin-sidebar { overflow-y: auto; scrollbar-width: thin; }
          .brand-copy { min-width: 0; }
          .sidebar-status { align-items: center; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; color: #f4eee6; display: flex; font-size: .68rem; font-weight: 800; gap: 8px; margin: 2px 14px 12px; padding: 9px 10px; }
          .status-dot { background: #43c795; border-radius: 50%; box-shadow: 0 0 0 4px rgba(67,199,149,.12); display: inline-block; height: 7px; width: 7px; }
          .status-location { color: rgba(250,247,242,.55); margin-left: auto; }
          .nav-link-leading { align-items: center; display: flex; gap: 10px; min-width: 0; }
          .nav-icon-wrap { align-items: center; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07); border-radius: 9px; display: inline-flex; flex: 0 0 30px; height: 30px; justify-content: center; transition: transform 180ms ease, background 180ms ease; }
          .admin-nav-icon { display: block; }
          .nav-link:hover .nav-icon-wrap, .nav-link-active .nav-icon-wrap { background: linear-gradient(135deg, rgba(251,146,60,.28), rgba(142,41,56,.24)); transform: scale(1.06); }
          .nav-link { animation: admin-nav-in 360ms ease both; }
          .nav-section:nth-child(2) .nav-link { animation-delay: 25ms; }
          .nav-section:nth-child(3) .nav-link { animation-delay: 50ms; }
          .sidebar-footer-card { align-items: center; background: linear-gradient(135deg, rgba(230,126,34,.16), rgba(142,41,56,.14)); border: 1px solid rgba(255,255,255,.1); border-radius: 14px; display: flex; gap: 10px; margin: 14px; padding: 11px; }
          .sidebar-footer-icon { align-items: center; background: rgba(255,255,255,.12); border-radius: 9px; color: #fdba74; display: flex; height: 32px; justify-content: center; width: 32px; }
          .sidebar-footer-card strong, .sidebar-footer-card span { display: block; }
          .sidebar-footer-card strong { color: #faf7f2; font-size: .73rem; }
          .sidebar-footer-card span { color: rgba(250,247,242,.58); font-size: .62rem; margin-top: 2px; }
          .admin-topbar-premium { align-items: center; }
          .topbar-title-group { align-items: center; display: flex; gap: 12px; min-width: 0; }
          .topbar-title-group h1 { animation: admin-title-in 320ms ease both; }
          .breadcrumb b { color: #b0a89f; margin: 0 5px; }
          .icon-control { align-items: center; background: rgba(255,255,255,.7); border: 1px solid rgba(230,126,34,.14); border-radius: 11px; color: #853f16; display: inline-flex; height: 40px; justify-content: center; position: relative; transition: transform 170ms ease, background 170ms ease, box-shadow 170ms ease; width: 40px; }
          .icon-control:hover { background: #fff; box-shadow: 0 10px 25px rgba(38,26,18,.1); transform: translateY(-2px); }
          .notification-dot { background: #c96818; border: 2px solid #fff; border-radius: 50%; height: 8px; position: absolute; right: 8px; top: 7px; width: 8px; }
          .user-menu { align-items: center; display: flex; gap: 8px; }
          .user-avatar { align-items: center; background: linear-gradient(135deg,#e67e22,#8e2938); border: 2px solid #fff; border-radius: 50%; box-shadow: 0 7px 18px rgba(201,104,24,.25); color: #fff; display: inline-flex; font-size: .72rem; font-weight: 900; height: 35px; justify-content: center; width: 35px; }
          .user-menu-name { color: #3a2c24; font-size: .76rem; font-weight: 850; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .mobile-menu-button, .sidebar-close { display: none; }
          .sidebar-backdrop { background: rgba(20,10,8,.45); border: 0; inset: 0; position: fixed; z-index: 4; }
          @keyframes admin-nav-in { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes admin-title-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          @media (max-width: 900px) {
            .admin-sidebar { box-shadow: 20px 0 60px rgba(20,10,8,.25); left: 0; position: fixed; transform: translateX(-102%); transition: transform 220ms ease; width: min(280px, 84vw); z-index: 6; }
            .admin-sidebar.admin-sidebar-open { transform: translateX(0); }
            .sidebar-close, .mobile-menu-button { align-items: center; background: transparent; border: 0; display: inline-flex; justify-content: center; }
            .sidebar-close { color: #faf7f2; font-size: 1.5rem; height: 44px; margin-left: auto; width: 44px; }
            .mobile-menu-button { flex-direction: column; gap: 4px; height: 44px; width: 44px; }
            .mobile-menu-button span { background: #3a2c24; border-radius: 2px; height: 2px; width: 18px; }
            .icon-control { height: 44px; width: 44px; }
            .user-avatar { height: 44px; width: 44px; }
            .user-menu-name, .topbar-logout { display: none; }
            .admin-topbar { gap: 8px; padding-left: 12px; padding-right: 12px; }
          }
          @media (max-width: 620px) {
            .environment-badge { display: none; }
            .topbar-actions { gap: 5px; }
            .admin-topbar h1 { font-size: 1.05rem; }
            .breadcrumb { font-size: .65rem; }
            .admin-content { padding-left: 12px; padding-right: 12px; }
            .status-location { display: none; }
          }
          @media (prefers-reduced-motion: reduce) {
            .nav-link, .topbar-title-group h1 { animation: none; }
            .nav-icon-wrap, .icon-control { transition: none; }
          }
        `}</style>
      </div>
    </AdminProtectedRoute>
  );
}

function groupNavigation(items: typeof adminNavigationItems): Array<[string, typeof adminNavigationItems]> {
  const sections = new Map<string, typeof adminNavigationItems>();
  for (const item of items) { const existing = sections.get(item.section) ?? []; sections.set(item.section, [...existing, item]); }
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
  return adminNavigationItems.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((first, second) => second.href.length - first.href.length)[0];
}
