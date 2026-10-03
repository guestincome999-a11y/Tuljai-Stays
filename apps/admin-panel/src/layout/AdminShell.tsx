'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type PropsWithChildren } from 'react';

import { getAdminDisplayName, useAdminAuth } from '../auth/AdminAuthProvider';
import { AdminProtectedRoute } from '../auth/AdminProtectedRoute';
import { AdminIcon } from '../components/AdminIcon';
import { LiveOnlinePaymentsControl } from '../components/LiveOnlinePaymentsControl';
import { adminNavigationItems, type AdminNavigationItem } from '../navigation/admin-navigation';
import { hasPermission } from '../permissions/permissions';

export function AdminShell({ children }: PropsWithChildren) {
  const auth = useAdminAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const allowedItems = adminNavigationItems.filter((item) => hasPermission(auth.permissions, item.permission));
  const sidebarItems = allowedItems.filter((item) => !item.hidden);
  const groupedItems = useMemo(() => groupNavigation(sidebarItems), [sidebarItems]);
  const tabItems = getTabItems(pathname, allowedItems);
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
            {groupedItems.map(([section, items]) => {
              if (items.length === 1) {
                const only = items[0];
                if (!only) return null;
                const active = isItemActive(pathname, only);
                return (
                  <Link aria-current={active ? 'page' : undefined} className={active ? 'nav-link nav-link-active' : 'nav-link'} href={only.href} key={section} onClick={() => setSidebarOpen(false)}>
                    <span className="nav-link-leading"><span className="nav-icon-wrap"><AdminIcon name={only.icon} /></span><span>{section}</span></span>
                  </Link>
                );
              }
              const groupActive = items.some((item) => isItemActive(pathname, item));
              const open = openGroups[section] ?? groupActive;
              const lead = items[0];
              return (
                <section key={section} className="nav-section">
                  <button aria-expanded={open} className={groupActive ? 'nav-group-toggle nav-group-toggle-active' : 'nav-group-toggle'} onClick={() => setOpenGroups((current) => ({ ...current, [section]: !open }))} type="button">
                    <span className="nav-link-leading"><span className="nav-icon-wrap">{lead ? <AdminIcon name={lead.icon} /> : null}</span><span>{section}</span></span>
                    <span aria-hidden="true" className={open ? 'nav-chevron nav-chevron-open' : 'nav-chevron'}>›</span>
                  </button>
                  {open ? (
                    <div className="nav-children">
                      {items.map((item) => {
                        const active = isItemActive(pathname, item);
                        return <Link aria-current={active ? 'page' : undefined} className={active ? 'nav-link nav-child-link nav-link-active' : 'nav-link nav-child-link'} href={item.href} key={item.href} onClick={() => setSidebarOpen(false)}>
                          <span>{item.label}</span>
                        </Link>;
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
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
            {tabItems.length > 1 ? (
              <nav aria-label="Section views" className="section-tabs">
                {tabItems.map((tab) => {
                  const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                  return <Link aria-current={active ? 'page' : undefined} className={active ? 'section-tab section-tab-active' : 'section-tab'} href={tab.href} key={tab.href}>{tab.tabLabel ?? tab.label}</Link>;
                })}
              </nav>
            ) : null}
            {children}
          </main>
        </div>
        <style jsx global>{`
          .admin-command-shell { min-height: 100vh; }
          .admin-command-shell .admin-sidebar { overflow-y: auto; scrollbar-width: thin; }
          .brand-copy { min-width: 0; }
          .sidebar-status { align-items: center; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; color: rgba(255,255,255,.9); display: flex; font-size: .68rem; font-weight: 800; gap: 8px; margin: 2px 14px 12px; padding: 9px 10px; }
          .status-dot { background: #43c795; border-radius: 50%; box-shadow: 0 0 0 4px rgba(67,199,149,.12); display: inline-block; height: 7px; width: 7px; }
          .status-location { color: rgba(255,255,255,.58); margin-left: auto; }
          .nav-link-leading { align-items: center; display: flex; gap: 10px; min-width: 0; }
          .nav-icon-wrap { align-items: center; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07); border-radius: 9px; display: inline-flex; flex: 0 0 30px; height: 30px; justify-content: center; transition: transform 180ms ease, background 180ms ease; }
          .admin-nav-icon { display: block; }
          .nav-link:hover .nav-icon-wrap, .nav-link-active .nav-icon-wrap { background: rgba(255,255,255,.16); transform: scale(1.06); }
          .nav-link { animation: admin-nav-in 360ms ease both; }
          .nav-group-toggle { align-items: center; background: transparent; border: 0; border-radius: var(--radius-sm); color: rgba(255,255,255,.9); cursor: pointer; display: flex; font: inherit; justify-content: space-between; min-height: 42px; padding: 9px 10px; text-align: left; transition: background 160ms ease; width: 100%; }
          .nav-group-toggle:hover { background: rgba(255,255,255,.08); }
          .nav-group-toggle-active { color: #ffffff; font-weight: 800; }
          .nav-chevron { color: rgba(255,255,255,.55); font-size: 1.1rem; transition: transform 160ms ease; }
          .nav-chevron-open { transform: rotate(90deg); }
          .nav-children { border-left: 1px solid rgba(255,255,255,.14); display: flex; flex-direction: column; gap: 2px; margin: 2px 0 4px 24px; padding-left: 8px; }
          .nav-child-link { font-size: .82rem; min-height: 36px; padding: 7px 10px; }
          .section-tabs { border-bottom: 1px solid var(--color-outline); display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 var(--space-lg); }
          .section-tab { border-bottom: 2px solid transparent; color: var(--color-muted); font-size: .82rem; font-weight: 800; margin-bottom: -1px; padding: 10px 14px; transition: color 160ms ease, border-color 160ms ease; }
          .section-tab:hover { color: var(--color-primary-strong); }
          .section-tab-active { border-bottom-color: var(--color-primary); color: var(--color-primary-strong); }
          .nav-section:nth-child(2) .nav-link { animation-delay: 25ms; }
          .nav-section:nth-child(3) .nav-link { animation-delay: 50ms; }
          .sidebar-footer-card { align-items: center; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; display: flex; gap: 10px; margin: 14px; padding: 11px; }
          .sidebar-footer-icon { align-items: center; background: rgba(255,255,255,.12); border-radius: 9px; color: #ffffff; display: flex; height: 32px; justify-content: center; width: 32px; }
          .sidebar-footer-card strong, .sidebar-footer-card span { display: block; }
          .sidebar-footer-card strong { color: #ffffff; font-size: .73rem; }
          .sidebar-footer-card span { color: rgba(255,255,255,.62); font-size: .62rem; margin-top: 2px; }
          .admin-topbar-premium { align-items: center; }
          .topbar-title-group { align-items: center; display: flex; gap: 12px; min-width: 0; }
          .topbar-title-group h1 { animation: admin-title-in 320ms ease both; }
          .breadcrumb b { color: #9aabba; margin: 0 5px; }
          .icon-control { align-items: center; background: var(--color-surface); border: 1px solid var(--color-outline); border-radius: 11px; color: var(--color-primary-strong); display: inline-flex; height: 40px; justify-content: center; position: relative; transition: transform 170ms ease, background 170ms ease, box-shadow 170ms ease; width: 40px; }
          .icon-control:hover { background: var(--color-primary-soft); box-shadow: 0 10px 25px rgba(8,38,77,.1); transform: translateY(-2px); }
          .notification-dot { background: var(--color-primary); border: 2px solid #fff; border-radius: 50%; height: 8px; position: absolute; right: 8px; top: 7px; width: 8px; }
          .user-menu { align-items: center; display: flex; gap: 8px; }
          .user-avatar { align-items: center; background: var(--gradient-primary); border: 2px solid #fff; border-radius: 50%; box-shadow: 0 7px 18px rgba(8,38,77,.22); color: #fff; display: inline-flex; font-size: .72rem; font-weight: 900; height: 35px; justify-content: center; width: 35px; }
          .user-menu-name { color: var(--color-text); font-size: .76rem; font-weight: 850; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .mobile-menu-button, .sidebar-close { display: none; }
          .sidebar-backdrop { background: rgba(6,29,58,.48); border: 0; inset: 0; position: fixed; z-index: 4; }
          @keyframes admin-nav-in { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes admin-title-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          @media (max-width: 900px) {
            .admin-sidebar { box-shadow: 20px 0 60px rgba(6,29,58,.26); left: 0; position: fixed; transform: translateX(-102%); transition: transform 220ms ease; width: min(280px, 84vw); z-index: 6; }
            .admin-sidebar.admin-sidebar-open { transform: translateX(0); }
            .sidebar-close, .mobile-menu-button { align-items: center; background: transparent; border: 0; display: inline-flex; justify-content: center; }
            .sidebar-close { color: #ffffff; font-size: 1.5rem; height: 44px; margin-left: auto; width: 44px; }
            .mobile-menu-button { flex-direction: column; gap: 4px; height: 44px; width: 44px; }
            .mobile-menu-button span { background: var(--color-primary-strong); border-radius: 2px; height: 2px; width: 18px; }
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

function isItemActive(pathname: string, item: AdminNavigationItem): boolean {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  if (!item.tabGroup) return false;
  return adminNavigationItems.some((other) => other.tabGroup === item.tabGroup && (pathname === other.href || pathname.startsWith(`${other.href}/`)));
}

function getTabItems(pathname: string, allowed: AdminNavigationItem[]): AdminNavigationItem[] {
  const current = adminNavigationItems.filter((item) => item.tabGroup && (pathname === item.href || pathname.startsWith(`${item.href}/`))).sort((a, b) => b.href.length - a.href.length)[0];
  if (!current?.tabGroup) return [];
  return allowed.filter((item) => item.tabGroup === current.tabGroup);
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
