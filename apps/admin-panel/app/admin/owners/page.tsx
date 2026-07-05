'use client';

import type { Lodge } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  assignGovernanceLodgeOwner,
  listGovernanceLodges,
} from '../../../src/api/admin-governance-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { formatGovernanceStatus } from '../../../src/governance/governance-utils';
import { hasPermission } from '../../../src/permissions/permissions';

interface OwnerAssignmentForm {
  isPrimary: boolean;
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  roleTitle: string;
  selectedLodgeId: string;
  userId: string;
}

const initialForm: OwnerAssignmentForm = {
  isPrimary: true,
  ownerEmail: '',
  ownerName: '',
  ownerPhone: '',
  roleTitle: 'Owner',
  selectedLodgeId: '',
  userId: '',
};

export default function AdminOwnersPage() {
  const auth = useAdminAuth();
  const canManage = hasPermission(auth.permissions, 'owners.manage');
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [form, setForm] = useState<OwnerAssignmentForm>(initialForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await listGovernanceLodges({ page: 1, pageSize: 50 });
      setLodges(response.items);
      setForm((current) => ({
        ...current,
        selectedLodgeId: current.selectedLodgeId || response.items[0]?.id || '',
      }));
    } catch {
      setErrorMessage('Lodge list could not be loaded for owner assignment.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignOwner() {
    if (!form.selectedLodgeId || !form.userId || !form.ownerName || !form.ownerPhone) {
      setErrorMessage('Select a lodge and provide owner user id, name, and phone.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await assignGovernanceLodgeOwner(form.selectedLodgeId, {
        isPrimary: form.isPrimary,
        ownerEmail: form.ownerEmail || undefined,
        ownerName: form.ownerName,
        ownerPhone: form.ownerPhone,
        roleTitle: form.roleTitle || undefined,
        userId: form.userId,
      });
      setSuccessMessage('Owner assigned to lodge.');
    } catch {
      setErrorMessage('Owner assignment failed. Confirm the user id belongs to an owner account.');
    }
  }

  return (
    <PermissionGate permission="owners.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Owner Governance</p>
            <h2>Lodge owner assignment</h2>
            <p className="muted-copy">
              Assign existing owner users to lodges and document ownership responsibility.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Assign Owner</p>
            <h3>Existing user to lodge</h3>
            <div className="form-stack">
              <label className="form-field">
                <span>Lodge</span>
                <select
                  disabled={!canManage}
                  value={form.selectedLodgeId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, selectedLodgeId: event.target.value }))
                  }
                >
                  {lodges.map((lodge) => (
                    <option key={lodge.id} value={lodge.id}>
                      {lodge.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Owner user id</span>
                <input
                  disabled={!canManage}
                  value={form.userId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, userId: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Owner name</span>
                <input
                  disabled={!canManage}
                  value={form.ownerName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ownerName: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Owner phone</span>
                <input
                  disabled={!canManage}
                  placeholder="+919999999999"
                  value={form.ownerPhone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ownerPhone: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Owner email</span>
                <input
                  disabled={!canManage}
                  value={form.ownerEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ownerEmail: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Role title</span>
                <input
                  disabled={!canManage}
                  value={form.roleTitle}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, roleTitle: event.target.value }))
                  }
                />
              </label>
              <label className="checkbox-row">
                <input
                  checked={form.isPrimary}
                  disabled={!canManage}
                  type="checkbox"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isPrimary: event.target.checked }))
                  }
                />
                <span>Primary lodge owner</span>
              </label>
              <button
                className="button button-primary"
                disabled={!canManage}
                type="button"
                onClick={() => void assignOwner()}
              >
                Assign Owner
              </button>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Owner Directory Foundation</p>
            <h3>API limitation documented</h3>
            <p className="muted-copy">
              This sequence uses the existing owner-assignment endpoint. A searchable owner
              directory needs a future `GET /api/admin/users?role=OWNER` endpoint before the table
              can list every owner account safely.
            </p>
            <div className="quick-actions">
              <Link className="ghost-control" href="/admin/lodges">
                Open Lodges
              </Link>
              <Link className="ghost-control" href="/admin/verification">
                Open Verification
              </Link>
            </div>
          </section>
        </section>

        <section className="table-panel">
          <div className="admin-table governance-lodge-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span>
              <span>Type</span>
              <span>Status</span>
              <span>Verification</span>
              <span>Action</span>
            </div>
            {lodges.map((lodge) => (
              <div className="admin-table-row" key={lodge.id}>
                <span>
                  <strong>{lodge.name}</strong>
                  <small>{lodge.slug}</small>
                </span>
                <span>{formatGovernanceStatus(lodge.propertyType)}</span>
                <span>{formatGovernanceStatus(lodge.status)}</span>
                <span>{formatGovernanceStatus(lodge.verificationStatus)}</span>
                <span>
                  <Link className="ghost-control" href={`/admin/lodges/${lodge.id}`}>
                    Inspect
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
