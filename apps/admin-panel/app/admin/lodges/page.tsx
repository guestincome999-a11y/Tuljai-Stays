'use client';

import type { Lodge, LodgeStatus, PaginatedResponse, VerificationStatus } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listGovernanceLodges } from '../../../src/api/admin-governance-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { FinanceStyles } from '../../../src/components/finance/FinanceStyles';
import {
  FinBanners,
  FinHeader,
  FinKpi,
  FinPanel,
  FinPill,
} from '../../../src/components/finance/FinanceUi';
import type { FinTone } from '../../../src/components/finance/FinanceUi';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { formatGovernanceStatus } from '../../../src/governance/governance-utils';
import { hasPermission } from '../../../src/permissions/permissions';

function statusTone(status: LodgeStatus): FinTone {
  if (status === 'VERIFIED') return 'green';
  if (status === 'PENDING_VERIFICATION') return 'orange';
  if (status === 'SUSPENDED' || status === 'REJECTED') return 'red';
  return 'gray';
}

function verificationTone(status: VerificationStatus): FinTone {
  if (status === 'VERIFIED') return 'green';
  if (status === 'REJECTED') return 'red';
  return 'orange';
}

export default function AdminLodgesPage() {
  const auth = useAdminAuth();
  const canManage = hasPermission(auth.permissions, 'lodges.manage');
  const [data, setData] = useState<PaginatedResponse<Lodge> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      setData(await listGovernanceLodges({ page, pageSize: 20, search }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim()
          ? `Lodges could not be loaded. ${error.message}`
          : 'Lodges could not be loaded. Please retry.',
      );
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
      <div className="fin-stack">
        <FinanceStyles />
        <FinHeader
          actions={
            <>
              {canManage ? (
                <>
                  <Link className="fin-btn" href="/admin/lodges/new">
                    Add lodge
                  </Link>
                  <Link className="fin-btn fin-btn-outline" href="/admin/lodges/import">
                    Import lodges (Excel)
                  </Link>
                </>
              ) : null}
              <button
                className="fin-btn fin-btn-soft"
                disabled={isLoading}
                type="button"
                onClick={() => void load()}
              >
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </>
          }
          description="Review lodge readiness, verification state, room coverage, and publication health."
          eyebrow="Lodges & Owners"
          title="Lodges"
        />

        <section aria-label="Lodge summary" className="fin-kpis">
          <FinKpi
            icon="lodge"
            label="Total lodges"
            meta="Across the platform"
            tone="blue"
            value={summary.total}
          />
          <FinKpi
            icon="check"
            label="Verified"
            meta="On this page"
            tone="green"
            value={summary.verified}
          />
          <FinKpi
            icon="clock"
            label="Pending review"
            meta="On this page"
            tone="orange"
            value={summary.pending}
          />
          <FinKpi
            icon="receipt"
            label="Inactive"
            meta="On this page"
            tone="red"
            value={summary.inactive}
          />
        </section>

        <FinPanel
          sub={
            data ? `${data.totalItems} ${data.totalItems === 1 ? 'lodge' : 'lodges'}` : undefined
          }
          title="Lodge directory"
        >
          <div className="fin-toolbar">
            <input
              aria-label="Search lodges"
              className="fin-search"
              placeholder="Search lodge name, slug or status"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <FinBanners error={errorMessage} />
          {isLoading && !data ? <div aria-label="Loading" className="fin-skeleton" /> : null}
          {data && data.items.length === 0 ? (
            <p className="fin-empty">No lodges found for the current search.</p>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="fin-scroll">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Lodge</th>
                    <th>Type</th>
                    <th>Visibility</th>
                    <th>Verification</th>
                    <th className="fin-num">Distance</th>
                    <th className="fin-num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((lodge) => (
                    <tr key={lodge.id}>
                      <td>
                        <Link className="fin-link" href={`/admin/lodges/${lodge.id}`}>
                          {lodge.name}
                        </Link>
                        <span className="fin-cell-sub">{lodge.slug}</span>
                      </td>
                      <td>{formatGovernanceStatus(lodge.propertyType)}</td>
                      <td>
                        <FinPill tone={statusTone(lodge.status)}>
                          {formatGovernanceStatus(lodge.status)}
                        </FinPill>
                      </td>
                      <td>
                        <FinPill tone={verificationTone(lodge.verificationStatus)}>
                          {formatGovernanceStatus(lodge.verificationStatus)}
                        </FinPill>
                      </td>
                      <td className="fin-num">
                        {lodge.distanceFromTempleMeters
                          ? `${lodge.distanceFromTempleMeters} m`
                          : 'Not set'}
                      </td>
                      <td className="fin-num">
                        <Link
                          className="fin-btn fin-btn-sm fin-btn-soft"
                          href={`/admin/lodges/${lodge.id}`}
                        >
                          Inspect
                        </Link>{' '}
                        {canManage ? (
                          <Link
                            className="fin-btn fin-btn-sm fin-btn-outline"
                            href={`/admin/verification?lodgeId=${lodge.id}`}
                          >
                            Verify
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {data ? (
            <div className="fin-pager">
              <span>
                Page {data.page} of {data.totalPages} · {data.totalItems}{' '}
                {data.totalItems === 1 ? 'lodge' : 'lodges'}
              </span>
              <button
                className="fin-btn fin-btn-sm fin-btn-soft"
                disabled={page <= 1 || isLoading}
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                className="fin-btn fin-btn-sm fin-btn-soft"
                disabled={page >= data.totalPages || isLoading}
                type="button"
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </FinPanel>
      </div>
    </PermissionGate>
  );
}
