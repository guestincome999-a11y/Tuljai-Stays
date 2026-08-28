'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log safely: message + digest only, never stack traces or request payloads to the console
    // that a shared/shoulder-surfed screen could expose. Server-side logging of the full error
    // already happens via Next.js's own server logs using the same digest.
    console.error('Admin panel error', { digest: error.digest });
  }, [error]);

  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <section className="panel" style={{ maxWidth: 480, textAlign: 'center' }} role="alert" aria-live="assertive">
        <p className="eyebrow">Something went wrong</p>
        <h1 style={{ marginTop: 8 }}>This page hit an unexpected error</h1>
        <p style={{ marginTop: 8 }}>
          Nothing was lost. You can try again, or head back to the dashboard. If this keeps
          happening, share the reference code below with support.
        </p>
        {error.digest ? (
          <p style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.85em', opacity: 0.7 }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="button button-primary" onClick={reset} type="button">
            Try again
          </button>
          <a className="button button-secondary" href="/admin/dashboard">
            Go to dashboard
          </a>
        </div>
      </section>
    </main>
  );
}
