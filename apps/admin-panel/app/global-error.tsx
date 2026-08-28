'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin panel root layout error', { digest: error.digest });
  }, [error]);

  // This replaces the entire root layout, so it must include its own <html>/<body> and cannot
  // rely on globals.css having loaded correctly — kept intentionally inline and dependency-free.
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }} role="alert" aria-live="assertive">
          <h1>The admin panel failed to load</h1>
          <p style={{ marginTop: 8 }}>
            Something went wrong while starting the application. Reloading usually fixes this.
          </p>
          {error.digest ? (
            <p style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.85em', opacity: 0.7 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
            type="button"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
