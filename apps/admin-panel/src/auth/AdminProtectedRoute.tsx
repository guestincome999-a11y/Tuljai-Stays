'use client';

import type { PropsWithChildren } from 'react';

import { useAdminAuth } from './AdminAuthProvider';

export function AdminProtectedRoute({ children }: PropsWithChildren) {
  const auth = useAdminAuth();

  if (!auth.bootstrapComplete) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Tuljai Stays Admin</p>
          <h1>Validating session</h1>
          <p>Please wait while we check your admin access.</p>
        </section>
      </main>
    );
  }

  if (auth.accessDenied) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Access denied</p>
          <h1>Restricted admin panel</h1>
          <p>This account does not have permission to access the Tuljai Stays Admin Panel.</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void auth.signOut()}
          >
            Logout
          </button>
        </section>
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Session required</p>
          <h1>Redirecting to login</h1>
          <p>Your session expired. Please log in again.</p>
        </section>
      </main>
    );
  }

  return children;
}
