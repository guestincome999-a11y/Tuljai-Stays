'use client';

import type { Lodge, PaginatedResponse } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listGovernanceLodges } from '../../../src/api/admin-governance-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { formatGovernanceStatus } from '../../../src/governance/governance-utils';
import { hasPermission } from '../../../src/permissions/permissions';

export default function AdminLodgesPage() {
  const auth = useAdminAuth();
  const [data, setData] = useState<PaginatedResponse<Lodge> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const canManage = hasPermission(auth.permissions, 'lodges.manage');

  const load = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const response = await listGovernanceLodges({ page, pageSize: 20, search });
      setData(response);
    } catch {
      setErrorMessage('Lodges could not be loaded. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const lodges = data?.items ?? [];
    return {
      inactive: lodges.filter((lodge) => !lodge.isActive).length,
      pending: lodges.filter((lodge) => lodge.verificationStatus === 'PENDING').length,
      total: data?.totalItems ?? lodges.length,
      verified: lodges.filter((lodge) => lodge.verificationStatus === 'VERIFIED').length,
    };
  }, [data]);

  return (
    <PermissionGate permission="lodges.view">
      <div className="page-stack">
        <section className="hero-panel command-hero">
          <div>
            <p className="eyebrow">Governance Center</p>
            <h2>Lodges</h2>
            <p className="muted-copy">
              Review lodge readiness, verification state, room coverage, and publication health.
            </p>
          </div>
          <div className="row-actions">
            {canManage ? (
              <Link className="button button-primary" href="/admin/lodges/new">
                Add Lodge
              </Link>
            ) : null}
            <button className="button button-secondary" type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </section>

        <section className="grid grid-4">
          <MetricCard label="Total lodges" value={summary.total} />
          <MetricCard label="Verified on page" value={summary.verified} />
          <MetricCard label="Pending review" value={summary.pending} />
          <MetricCard label="Inactive on page" value={summary.inactive} />
        </section>

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Search</span>
              <input
                placeholder="Lodge name, slug, status"
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
              />
            </label>
          </div>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="table-panel">
          <div className="admin-table governance-lodge-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span>
              <span>Type</span>
              <span>Visibility</span>
              <span>Verification</span>
              <span>Distance</span>
              <span>Actions</span>
            </div>
            {(data?.items ?? []).map((lodge) => (
              <div className="admin-table-row" key={lodge.id}>
                <span>
                  <strong>{lodge.name}</strong>
                  <small>{lodge.slug}</small>
                </span>
                <span>{formatGovernanceStatus(lodge.propertyType)}</span>
                <span className="status-card">{formatGovernanceStatus(lodge.status)}</span>
                <span className="status-card">
                  {formatGovernanceStatus(lodge.verificationStatus)}
                </span>
                <span>
                  {lodge.distanceFromTempleMeters
                    ? `${lodge.distanceFromTempleMeters} m`
                    : 'Not set'}
                </span>
                <span className="row-actions">
                  <Link className="ghost-control" href={`/admin/lodges/${lodge.id}`}>
                    Inspect
                  </Link>
                  {canManage ? (
                    <Link
                      className="ghost-control"
                      href={`/admin/verification?lodgeId=${lodge.id}`}
                    >
                      Verify
                    </Link>
                  ) : null}
                </span>
              </div>
            ))}
          </div>

          {!isLoading && (data?.items.length ?? 0) === 0 ? (
            <p className="empty-table">No lodges found for the current filters.</p>
          ) : null}

          <div className="pagination-row">
            <button
              className="button button-secondary"
              disabled={page <= 1}
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {data?.page ?? page} of {data?.totalPages ?? 1}
            </span>
            <button
              className="button button-secondary"
              disabled={!data || page >= data.totalPages}
              type="button"
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">TS</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
