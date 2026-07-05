'use client';

import type { Lodge, VerificationStatus } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listGovernanceLodges, verifyGovernanceLodge } from '../../../src/api/admin-governance-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  formatGovernanceStatus,
  verificationStatuses,
} from '../../../src/governance/governance-utils';
import { hasPermission } from '../../../src/permissions/permissions';

export default function AdminVerificationPage() {
  const auth = useAdminAuth();
  const canManage = hasPermission(auth.permissions, 'lodges.manage');
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [status, setStatus] = useState<VerificationStatus | ''>('PENDING');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await listGovernanceLodges({ page: 1, pageSize: 50 });
      setLodges(response.items);
    } catch {
      setErrorMessage('Verification queue could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLodges = useMemo(
    () => lodges.filter((lodge) => !status || lodge.verificationStatus === status),
    [lodges, status],
  );

  async function verify(lodgeId: string, verificationStatus: VerificationStatus) {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await verifyGovernanceLodge(lodgeId, {
        notes: notes || undefined,
        verificationStatus,
      });
      await load();
      setSuccessMessage(`Lodge marked ${formatGovernanceStatus(verificationStatus)}.`);
    } catch {
      setErrorMessage('Verification action failed.');
    }
  }

  return (
    <PermissionGate permission="lodges.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Verification Queue</p>
            <h2>Lodge verification workflow</h2>
            <p className="muted-copy">
              Review pending lodges, record decision notes, and move verified properties forward.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Queue</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as VerificationStatus | '')}
              >
                <option value="">All verification states</option>
                {verificationStatuses.map((verificationStatus) => (
                  <option key={verificationStatus} value={verificationStatus}>
                    {formatGovernanceStatus(verificationStatus)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Decision notes</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="table-panel">
          <div className="admin-table governance-lodge-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span>
              <span>Status</span>
              <span>Verification</span>
              <span>Phone</span>
              <span>Action</span>
            </div>
            {filteredLodges.map((lodge) => (
              <div className="admin-table-row" key={lodge.id}>
                <span>
                  <strong>{lodge.name}</strong>
                  <small>{lodge.slug}</small>
                </span>
                <span>{formatGovernanceStatus(lodge.status)}</span>
                <span className="status-card">
                  {formatGovernanceStatus(lodge.verificationStatus)}
                </span>
                <span>{lodge.primaryPhone}</span>
                <span className="row-actions">
                  {verificationStatuses.map((verificationStatus) => (
                    <button
                      className="ghost-control"
                      disabled={!canManage || lodge.verificationStatus === verificationStatus}
                      key={verificationStatus}
                      type="button"
                      onClick={() => void verify(lodge.id, verificationStatus)}
                    >
                      {formatGovernanceStatus(verificationStatus)}
                    </button>
                  ))}
                  <Link className="ghost-control" href={`/admin/lodges/${lodge.id}`}>
                    Detail
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
