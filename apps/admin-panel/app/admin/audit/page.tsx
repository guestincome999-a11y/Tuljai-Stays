'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient } from '../../../src/api/client';
import { PermissionGate } from '../../../src/components/PermissionGate';
interface AuditPage {
  items: Array<{
    id: string;
    at: string;
    action: string;
    entityId: string | null;
    entityType: string;
    actor: string;
    metadata: unknown;
  }>;
  page: number;
  pageSize: number;
  total: number;
}
export default function AdminAuditPage() {
  return (
    <PermissionGate permission="audit_logs.view">
      <AuditExplorer />
    </PermissionGate>
  );
}
function AuditExplorer() {
  const [entityId, setEntityId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    setEntityId(new URLSearchParams(window.location.search).get('entityId') ?? '');
    setReady(true);
  }, []);
  const load = useCallback(async () => {
    if (!ready) return;
    const id = ++revision.current;
    setLoading(true);
    try {
      const result = await apiClient.get<AuditPage>('/admin/audit-logs', {
        params: { entityId: entityId || undefined, action: action || undefined, page },
      });
      if (id !== revision.current) return;
      setData(result);
      setError(null);
    } catch {
      if (id === revision.current)
        setError('Audit records could not be loaded. Check the entity ID and retry.');
    } finally {
      if (id === revision.current) setLoading(false);
    }
  }, [entityId, action, page, ready]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => {
      clearTimeout(timer);
      revision.current++;
    };
  }, [load]);
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Audit Explorer</p>
          <h2>Audit history</h2>
          <p className="muted-copy">
            Authoritative admin actions, entity changes and recovery records.
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={loading}
          onClick={() => void load()}
          type="button"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </section>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="control-grid">
          <label className="form-field">
            <span>Entity ID</span>
            <input
              value={entityId}
              onChange={(event) => {
                setEntityId(event.target.value);
                setPage(1);
              }}
              placeholder="UUID, or empty for all entities"
            />
          </label>
          <label className="form-field">
            <span>Action contains</span>
            <input
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              maxLength={80}
              placeholder="FESTIVAL, ROOM, BOOKING…"
            />
          </label>
        </div>
      </section>
      <section className="panel">
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time · IST</th>
                <th>Admin / actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Change details</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {new Date(entry.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td>{entry.actor}</td>
                  <td>{entry.action.replaceAll('_', ' ')}</td>
                  <td>
                    {entry.entityType}
                    <br />
                    {entry.entityId}
                  </td>
                  <td>
                    <details>
                      <summary>Metadata / previous / new values</summary>
                      <pre
                        style={{ whiteSpace: 'pre-wrap', maxWidth: 480, overflowWrap: 'anywhere' }}
                      >
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !data?.items.length && (
          <p className="empty-table">No audit records match these filters.</p>
        )}
        <div className="quick-actions">
          <button
            className="button button-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {page} · {data?.total ?? 0} records
          </span>
          <button
            className="button button-secondary"
            disabled={!data || page * data.pageSize >= data.total || loading}
            onClick={() => setPage(page + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
