'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PropsWithChildren } from 'react';

import { getAdminDisplayName, useAdminAuth } from '../auth/AdminAuthProvider';
import { AdminProtectedRoute } from '../auth/AdminProtectedRoute';
import { AdminIcon } from '../components/AdminIcon';
import { LiveOnlinePaymentsControl } from '../components/LiveOnlinePaymentsControl';
import { adminNavigationItems, type AdminNavigationItem } from '../navigation/admin-navigation';
import { hasPermission } from '../permissions/permissions';

export function AdminShell({ children }: PropsWithChildren) {
  const auth = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const allowedItems = adminNavigationItems.filter((item) => hasPermission(auth.permissions, item.permission));
  const sidebarItems = allowedItems.filter((item) => !item.hidden);
  const groupedItems = useMemo(() => groupNavigation(sidebarItems), [sidebarItems]);
  const tabItems = getTabItems(pathname, allowedItems);
  const displayName = getAdminDisplayName(auth.session.user);
  const roleLabel = auth.session.user?.roles.includes('SUPER_ADMIN') ? 'Super Admin' : 'Admin';
  const currentItem = getCurrentNavigationItem(pathname);
  const isDashboard = pathname === '/admin/dashboard';

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return allowedItems
      .filter((item) => `${item.label} ${item.section} ${item.tabLabel ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 7);
  }, [allowedItems, query]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function go(item: AdminNavigationItem) {
    setQuery('');
    setSearchOpen(false);
    setSidebarOpen(false);
    router.push(item.href);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      const target = matches[highlight];
      if (target) go(target);
    } else if (event.key === 'Escape') {
      setSearchOpen(false);
      searchRef.current?.blur();
    }
  }

  return (
    <AdminProtectedRoute>
      <div className="admin-frame">
        <a className="skip-link" href="#admin-main-content">Skip to main content</a>

        <header className="app-header">
          <div className="app-brand">
            <span className="brand-mark">TS</span>
            <div className="brand-copy">
              <p className="brand-title">Tuljai Stays</p>
              <p className="brand-subtitle">Stay Near, Stay Blessed</p>
            </div>
          </div>
          <button aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} className="header-toggle" onClick={() => setSidebarOpen((current) => !current)} type="button">
            <span /><span /><span />
          </button>

          <div className="header-search" role="search">
            <svg aria-hidden="true" className="search-glyph" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="16"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              aria-controls="admin-search-results"
              aria-expanded={searchOpen && matches.length > 0}
              aria-label="Jump to an admin page"
              autoComplete="off"
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
              onChange={(event) => { setQuery(event.target.value); setHighlight(0); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKey}
              placeholder="Jump to bookings, lodges, users, finance…"
              ref={searchRef}
              role="combobox"
              type="search"
              value={query}
            />
            <kbd className="search-hint">Ctrl + K</kbd>
            {searchOpen && query.trim() ? (
              <ul className="search-results" id="admin-search-results" role="listbox">
                {matches.length === 0 ? <li className="search-empty">No matching page</li> : matches.map((item, index) => (
                  <li aria-selected={index === highlight} className={index === highlight ? 'search-result search-result-active' : 'search-result'} key={item.href} onMouseDown={(event) => { event.preventDefault(); go(item); }} role="option">
                    <span className="search-result-icon"><AdminIcon name={item.icon} /></span>
                    <span><b>{item.tabLabel && item.hidden ? item.tabLabel : item.label}</b><small>{item.section}</small></span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="header-actions">
            <Link aria-label="Notifications" className="header-icon" href="/admin/notifications-monitor"><AdminIcon name="notifications" /></Link>
            <Link className="header-user" href="/admin/account">
              <span className="user-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
              <span className="user-meta"><b>{displayName}</b><small>{roleLabel}</small></span>
            </Link>
            <button className="header-logout" type="button" onClick={() => void auth.signOut()}>Logout</button>
          </div>
        </header>

        <div className="app-body">
          {sidebarOpen ? <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button" /> : null}
          <aside aria-label="Admin navigation" className={sidebarOpen ? 'app-sidebar app-sidebar-open' : 'app-sidebar'}>
            <nav className="side-nav">
              {groupedItems.map(([section, items]) => {
                if (items.length === 1) {
                  const only = items[0];
                  if (!only) return null;
                  const active = isItemActive(pathname, only);
                  return (
                    <Link aria-current={active ? 'page' : undefined} className={active ? 'side-link side-link-active' : 'side-link'} href={only.href} key={section} onClick={() => setSidebarOpen(false)}>
                      <span className="side-icon"><AdminIcon name={only.icon} /></span><span>{section}</span>
                    </Link>
                  );
                }
                const groupActive = items.some((item) => isItemActive(pathname, item));
                const open = openGroups[section] ?? groupActive;
                const lead = items[0];
                return (
                  <section className="side-group" key={section}>
                    <button aria-expanded={open} className={groupActive ? 'side-group-toggle side-group-active' : 'side-group-toggle'} onClick={() => setOpenGroups((current) => ({ ...current, [section]: !open }))} type="button">
                      <span className="side-icon">{lead ? <AdminIcon name={lead.icon} /> : null}</span>
                      <span className="side-group-label">{section}</span>
                      <span aria-hidden="true" className={open ? 'side-chevron side-chevron-open' : 'side-chevron'}>›</span>
                    </button>
                    {open ? (
                      <div className="side-children">
                        {items.map((item) => {
                          const active = isItemActive(pathname, item);
                          return <Link aria-current={active ? 'page' : undefined} className={active ? 'side-child side-child-active' : 'side-child'} href={item.href} key={item.href} onClick={() => setSidebarOpen(false)}>{item.label}</Link>;
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </nav>
          </aside>

          <main className="app-main" id="admin-main-content" tabIndex={-1}>
            {isDashboard ? (
              <div className="page-heading">
                <div>
                  <h1>{greeting()}, {displayName}!</h1>
                  <p>Here&apos;s what&apos;s happening with your Tuljai Stays today.</p>
                </div>
                <time className="page-date" dateTime={new Date().toISOString()}>{formatToday()}</time>
              </div>
            ) : (
              <div className="page-heading">
                <div>
                  <p className="page-crumb">Admin <b>/</b> {currentItem?.section ?? 'Dashboard'}</p>
                  <h1>{getCurrentTitle(pathname)}</h1>
                </div>
              </div>
            )}
            {isDashboard ? <LiveOnlinePaymentsControl /> : null}
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
          .admin-frame { background: var(--color-background); min-height: 100vh; }
          .app-header { align-items: center; background: #fff; border-bottom: 1px solid var(--color-outline); display: flex; gap: 18px; height: 68px; padding: 0 22px; position: sticky; top: 0; z-index: 30; }
          .app-brand { align-items: center; display: flex; flex: 0 0 218px; gap: 11px; }
          .app-brand .brand-mark { background: var(--color-navy); border-radius: 12px; height: 40px; width: 40px; }
          .app-brand .brand-title { color: var(--color-primary-strong); font-size: 1.05rem; font-weight: 800; line-height: 1.15; }
          .app-brand .brand-subtitle { font-size: 0.64rem; font-weight: 700; }
          .header-toggle { align-items: center; background: transparent; border: 0; border-radius: 10px; cursor: pointer; display: inline-flex; flex-direction: column; gap: 4px; height: 38px; justify-content: center; width: 38px; }
          .header-toggle:hover { background: var(--color-surface-muted); }
          .header-toggle span { background: var(--color-primary-strong); border-radius: 2px; height: 2px; width: 16px; }
          .header-toggle span:nth-child(2) { width: 11px; }
          .header-search { align-items: center; background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 12px; display: flex; flex: 1 1 420px; gap: 9px; margin: 0 auto; max-width: 560px; min-width: 0; padding: 0 12px; position: relative; }
          .header-search:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
          .search-glyph { color: var(--color-muted); flex: 0 0 auto; }
          .header-search input { background: transparent; border: 0; color: var(--color-text); flex: 1; font-size: 0.82rem; height: 40px; min-width: 0; outline: none; }
          .header-search input::placeholder { color: var(--color-muted); }
          .header-search input::-webkit-search-cancel-button { display: none; }
          .search-hint { background: #fff; border: 1px solid var(--color-outline); border-radius: 7px; color: var(--color-muted); font: inherit; font-size: 0.66rem; font-weight: 700; padding: 2px 7px; }
          .search-results { background: #fff; border: 1px solid var(--color-outline); border-radius: 14px; box-shadow: 0 18px 40px rgba(15, 31, 61, 0.14); left: 0; list-style: none; margin: 0; padding: 6px; position: absolute; right: 0; top: calc(100% + 8px); z-index: 40; }
          .search-result { align-items: center; border-radius: 10px; cursor: pointer; display: flex; gap: 10px; padding: 8px 10px; }
          .search-result b { display: block; font-size: 0.82rem; }
          .search-result small { color: var(--color-muted); font-size: 0.7rem; font-weight: 600; }
          .search-result-active, .search-result:hover { background: var(--color-primary-soft); }
          .search-result-icon { align-items: center; background: var(--color-surface-muted); border-radius: 9px; display: inline-flex; height: 30px; justify-content: center; width: 30px; }
          .search-empty { color: var(--color-muted); font-size: 0.8rem; padding: 10px; }
          .header-actions { align-items: center; display: flex; gap: 12px; margin-left: auto; }
          .header-icon { align-items: center; background: #fff; border: 1px solid var(--color-outline); border-radius: 50%; color: var(--color-primary-strong); display: inline-flex; height: 40px; justify-content: center; transition: background 160ms ease; width: 40px; }
          .header-icon:hover { background: var(--color-primary-soft); }
          .header-user { align-items: center; display: flex; gap: 10px; }
          .user-avatar { align-items: center; background: var(--color-navy); border-radius: 50%; color: #fff; display: inline-flex; font-size: 0.8rem; font-weight: 800; height: 38px; justify-content: center; width: 38px; }
          .user-meta b, .user-meta small { display: block; line-height: 1.2; }
          .user-meta b { font-size: 0.82rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .user-meta small { color: var(--color-muted); font-size: 0.7rem; font-weight: 600; }
          .header-logout { background: transparent; border: 1px solid var(--color-outline); border-radius: 10px; color: var(--color-primary-strong); cursor: pointer; font-size: 0.76rem; font-weight: 800; padding: 8px 12px; }
          .header-logout:hover { background: var(--color-surface-muted); }
          .app-body { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: calc(100vh - 68px); }
          .app-sidebar { align-self: start; background: #fff; border-right: 1px solid var(--color-outline); height: calc(100vh - 68px); overflow-y: auto; padding: 14px 12px 24px; position: sticky; scrollbar-width: thin; top: 68px; }
          .side-nav { display: flex; flex-direction: column; gap: 4px; }
          .side-link, .side-group-toggle { align-items: center; background: transparent; border: 0; border-radius: 12px; color: var(--color-primary-strong); cursor: pointer; display: flex; font: inherit; font-size: 0.86rem; font-weight: 700; gap: 11px; min-height: 42px; padding: 8px 12px; text-align: left; transition: background 160ms ease, color 160ms ease; width: 100%; }
          .side-link:hover, .side-group-toggle:hover { background: var(--color-surface-muted); }
          .side-link-active, .side-link-active:hover { background: var(--color-accent-soft); color: var(--color-accent); }
          .side-group-active { color: var(--color-primary-strong); font-weight: 800; }
          .side-icon { align-items: center; color: currentColor; display: inline-flex; flex: 0 0 20px; justify-content: center; opacity: 0.85; }
          .side-group-label { flex: 1; }
          .side-chevron { color: var(--color-muted); font-size: 1.05rem; transition: transform 160ms ease; }
          .side-chevron-open { transform: rotate(-90deg); }
          .side-children { border-left: 1px solid var(--color-outline); display: flex; flex-direction: column; gap: 2px; margin: 2px 0 6px 21px; padding-left: 10px; }
          .side-child { border-radius: 10px; color: var(--color-muted); font-size: 0.82rem; font-weight: 600; padding: 8px 12px; transition: background 160ms ease, color 160ms ease; }
          .side-child:hover { background: var(--color-surface-muted); color: var(--color-primary-strong); }
          .side-child-active, .side-child-active:hover { background: var(--color-accent-soft); color: var(--color-accent); font-weight: 800; }
          .app-main { min-width: 0; padding: 26px 28px 40px; }
          .page-heading { align-items: flex-end; display: flex; gap: 16px; justify-content: space-between; margin-bottom: 20px; }
          .page-heading h1 { color: var(--color-primary-strong); font-size: 1.55rem; letter-spacing: -0.01em; margin: 0; }
          .page-heading p { color: var(--color-muted); font-size: 0.86rem; font-weight: 500; margin: 4px 0 0; }
          .page-heading .page-crumb { color: var(--color-muted); font-size: 0.74rem; font-weight: 700; margin: 0 0 4px; }
          .page-crumb b { margin: 0 5px; opacity: 0.5; }
          .page-date { background: #fff; border: 1px solid var(--color-outline); border-radius: 10px; color: var(--color-primary-strong); font-size: 0.78rem; font-weight: 700; padding: 8px 12px; white-space: nowrap; }
          .section-tabs { border-bottom: 1px solid var(--color-outline); display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 var(--space-lg); }
          .section-tab { border-bottom: 2px solid transparent; color: var(--color-muted); font-size: 0.82rem; font-weight: 800; margin-bottom: -1px; padding: 10px 14px; transition: color 160ms ease, border-color 160ms ease; }
          .section-tab:hover { color: var(--color-primary-strong); }
          .section-tab-active { border-bottom-color: var(--color-accent); color: var(--color-accent); }
          .sidebar-backdrop { background: rgba(15, 31, 61, 0.4); border: 0; inset: 68px 0 0 0; position: fixed; z-index: 24; }
          @media (min-width: 1025px) { .header-toggle { display: none; } }
          @media (max-width: 1024px) {
            .app-body { grid-template-columns: minmax(0, 1fr); }
            .app-sidebar { box-shadow: none; left: 0; position: fixed; top: 68px; transform: translateX(-102%); transition: transform 220ms ease; width: min(290px, 86vw); z-index: 26; }
            .app-sidebar-open { box-shadow: 14px 0 40px rgba(15, 31, 61, 0.16); transform: translateX(0); }
            .app-brand { flex: 0 0 auto; }
            .brand-copy { display: none; }
            .user-meta, .header-logout, .search-hint { display: none; }
            .app-main { padding: 20px 16px 32px; }
            .app-header { gap: 8px; padding: 0 12px; }
            .header-actions { gap: 8px; }
          }
          @media (max-width: 620px) {
            .page-heading { align-items: flex-start; flex-direction: column; }
            .page-heading h1 { font-size: 1.25rem; }
          }
          @media (prefers-reduced-motion: reduce) {
            .app-sidebar, .side-chevron { transition: none; }
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

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatToday(): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' }).format(new Date());
}

function getCurrentTitle(pathname: string): string {
  const currentItem = getCurrentNavigationItem(pathname);
  if (currentItem) return currentItem.label;
  if (pathname.includes('/audit')) return 'Audit Log';
  if (pathname.includes('/bookings')) return 'Bookings';
  if (pathname.includes('/account')) return 'Account & Session';
  return 'Dashboard';
}

function getCurrentNavigationItem(pathname: string) {
  return adminNavigationItems.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((first, second) => second.href.length - first.href.length)[0];
}
