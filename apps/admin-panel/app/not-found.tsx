import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <section className="panel" style={{ maxWidth: 480, textAlign: 'center' }} role="alert" aria-live="polite">
        <p className="eyebrow">404</p>
        <h1 style={{ marginTop: 8 }}>This page doesn&apos;t exist</h1>
        <p style={{ marginTop: 8 }}>
          The page you&apos;re looking for was moved, renamed, or never existed. Check the link or
          head back to the dashboard.
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link className="button button-primary" href="/admin/dashboard">
            Go to dashboard
          </Link>
          <Link className="button button-secondary" href="/admin/support">
            Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}
