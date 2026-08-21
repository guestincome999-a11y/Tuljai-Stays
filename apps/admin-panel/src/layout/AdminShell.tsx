'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';

import { LiveOnlinePaymentsControl } from '../components/LiveOnlinePaymentsControl';
import { getAdminDisplayName, useAdminAuth } from '../auth/AdminAuthProvider';
import { AdminProtectedRoute } from '../auth/AdminProtectedRoute';
import { adminNavigationItems } from '../navigation/admin-navigation';
import { hasPermission } from '../permissions/permissions';

export function AdminShell({ children }: PropsWithChildren) {
  const auth = useAdminAuth();
  const pathname = usePathname();
  const visibleItems = adminNavigationItems.filter((item) =>
    hasPermission(auth.permissions, item.permission),
  );
  const groupedItems = groupNavigation(visibleItems);
  const displayName = getAdminDisplayName(auth.session.user);

  return (
    <AdminProtectedRoute>
      <div className="admin-shell">
        <a className="skip-link" href="#admin-main-content">
          Skip to main content
        </a>
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <div className="brand-block">
            <span className="brand-mark">TS</span>
            <div>
              <p className="brand-title">Tuljai Stays</p>
              <p className="brand-subtitle">Admin Console</p>
            </div>
          </div>

          <nav className="nav-stack">
            {groupedItems.map(([section, items]) => (
              <section key={section} className="nav-section">
                <p className="nav-section-title">{section}</p>
                {items.map((item) => {
                  const active = pathname === item.href;

                  return (
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'nav-link nav-link-active' : 'nav-link'}
                      href={item.status === 'ready' ? item.href : '/admin/dashboard'}
                      key={item.label}
                    >
                      <span>{item.label}</span>
                      {item.status === 'placeholder' ? (
                        <span className="nav-pill">Soon</span>
                      ) : null}
                    </Link>
                  );
                })}
              </section>
            ))}
          </nav>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div>
              <p className="breadcrumb">Admin / {getCurrentSection(pathname)}</p>
              <h1>{getCurrentTitle(pathname)}</h1>
            </div>
            <div className="topbar-actions">
              <span className="environment-badge">{process.env.NODE_ENV}</span>
              <button className="ghost-control" type="button">
                Search
              </button>
              <button className="ghost-control" type="button">
                Notifications
              </button>
              <Link className="user-menu" href="/admin/account">
                {displayName}
              </Link>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void auth.signOut()}
              >
                Logout
              </button>
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

function groupNavigation(
  items: typeof adminNavigationItems,
): Array<[string, typeof adminNavigationItems]> {
  const sections = new Map<string, typeof adminNavigationItems>();

  for (const item of items) {
    const existing = sections.get(item.section) ?? [];
    sections.set(item.section, [...existing, item]);
  }

  return [...sections.entries()];
}

function getCurrentSection(pathname: string): string {
  const currentItem = getCurrentNavigationItem(pathname);

  if (currentItem) {
    return currentItem.section;
  }

  if (pathname.includes('/audit')) {
    return 'Audit Logs';
  }

  if (pathname.includes('/bookings')) {
    return 'Bookings';
  }

  if (pathname.includes('/operations/intervention')) {
    return 'Intervention Queue';
  }

  if (pathname.includes('/account')) {
    return 'Account';
  }

  return 'Dashboard';
}

function getCurrentTitle(pathname: string): string {
  const currentItem = getCurrentNavigationItem(pathname);

  if (currentItem) {
    return currentItem.label;
  }

  if (pathname.includes('/audit')) {
    return 'Audit Log Foundation';
  }

  if (pathname.includes('/bookings')) {
    return 'Booking Control Center';
  }

  if (pathname.includes('/operations/intervention')) {
    return 'Manual Intervention Queue';
  }

  if (pathname.includes('/account')) {
    return 'Account & Session';
  }

  return 'Live Operations Center';
}

function getCurrentNavigationItem(pathname: string) {
  return adminNavigationItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0];
}
