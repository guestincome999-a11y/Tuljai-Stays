'use client';

import type { Lodge } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  assignGovernanceLodgeOwner,
  createLodgeTeamMember,
  listGovernanceLodges,
  listLodgeTeam,
  updateLodgeTeamMember,
  type LodgeTeamMember,
  type LodgeTeamMemberType,
} from '../../../src/api/admin-governance-api';
import { adminSetUserPassword } from '../../../src/api/admin-user-directory-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
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

interface CreateTeamMemberForm {
  email: string;
  isPrimary: boolean;
  memberType: LodgeTeamMemberType;
  name: string;
  password: string;
  phoneNumber: string;
  roleTitle: string;
}

const initialTeamForm: CreateTeamMemberForm = {
  email: '',
  isPrimary: false,
  memberType: 'STAFF',
  name: '',
  password: '',
  phoneNumber: '',
  roleTitle: '',
};

export default function AdminOwnersPage() {
  const auth = useAdminAuth();
  const canManage = hasPermission(auth.permissions, 'owners.manage');
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [form, setForm] = useState<OwnerAssignmentForm>(initialForm);
  const [teamForm, setTeamForm] = useState<CreateTeamMemberForm>(initialTeamForm);
  const [team, setTeam] = useState<LodgeTeamMember[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTeam = useCallback(async (lodgeId: string) => {
    if (!lodgeId) {
      setTeam([]);
      return;
    }
    try {
      setTeam(await listLodgeTeam(lodgeId));
    } catch {
      setTeam([]);
    }
  }, []);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await listGovernanceLodges({ page: 1, pageSize: 50 });
      setLodges(response.items);
      const selectedLodgeId = form.selectedLodgeId || response.items[0]?.id || '';
      setForm((current) => ({ ...current, selectedLodgeId }));
      await loadTeam(selectedLodgeId);
    } catch {
      setErrorMessage('Lodge list could not be loaded for owner assignment.');
    }
  }, [loadTeam]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectLodge(lodgeId: string) {
    setForm((current) => ({ ...current, selectedLodgeId: lodgeId }));
    void loadTeam(lodgeId);
  }

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
      await loadTeam(form.selectedLodgeId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Owner assignment failed. Confirm the user id belongs to an owner account.',
      );
    }
  }

  async function createTeamMember() {
    if (
      !form.selectedLodgeId ||
      !teamForm.email ||
      !teamForm.name ||
      !teamForm.phoneNumber ||
      !teamForm.password
    ) {
      setErrorMessage('Select a lodge and fill in name, email, phone, and an initial password.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createLodgeTeamMember(form.selectedLodgeId, {
        email: teamForm.email,
        isPrimary: teamForm.isPrimary,
        memberType: teamForm.memberType,
        name: teamForm.name,
        password: teamForm.password,
        phoneNumber: teamForm.phoneNumber,
        roleTitle: teamForm.roleTitle || undefined,
      });
      setSuccessMessage(
        `${teamForm.memberType === 'STAFF' ? 'Staff' : 'Owner'} account created. Share the email and password with them to sign in to the Owner App.`,
      );
      setTeamForm(initialTeamForm);
      await loadTeam(form.selectedLodgeId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create the account.',
      );
    }
  }

  async function resetPassword(member: LodgeTeamMember) {
    if (!member.user.email) {
      setErrorMessage('This account has no login email on file - it cannot use password login yet.');
      return;
    }
    const newPassword = window.prompt(
      `New password for ${member.user.displayName ?? member.user.email} (min 8 characters, at least one letter and one number):`,
    );
    if (!newPassword) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await adminSetUserPassword(member.user.id, newPassword);
      setSuccessMessage(`Password reset for ${member.user.displayName ?? member.user.email}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not reset the password.');
    }
  }

  async function toggleActive(member: LodgeTeamMember) {
    if (!form.selectedLodgeId) return;
    const nextActive = !member.isActive;
    if (
      !window.confirm(
        `${nextActive ? 'Reactivate' : 'Deactivate'} ${member.user.displayName ?? member.user.email ?? 'this account'}?`,
      )
    )
      return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateLodgeTeamMember(form.selectedLodgeId, member.id, { isActive: nextActive });
      await loadTeam(form.selectedLodgeId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update the account.');
    }
  }

  return (
    <PermissionGate permission="owners.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Owner Governance</p>
            <h2>Lodge owners &amp; staff</h2>
            <p className="muted-copy">
              Create owner and staff accounts for a lodge, reset their passwords, and manage
              access. Staff accounts sign in to the Owner App with the same email/password login
              but are limited to day-to-day operations (check-in/check-out, room status).
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="panel">
          <label className="form-field">
            <span>Lodge</span>
            <select
              value={form.selectedLodgeId}
              onChange={(event) => selectLodge(event.target.value)}
            >
              {lodges.map((lodge) => (
                <option key={lodge.id} value={lodge.id}>
                  {lodge.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="table-panel">
          <p className="eyebrow">Team for this lodge</p>
          <div className="admin-table governance-lodge-table">
            <div className="admin-table-row admin-table-head">
              <span>Name</span>
              <span>Type</span>
              <span>Email</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {team.map((member) => (
              <div className="admin-table-row" key={member.id}>
                <span>
                  <strong>{member.user.displayName ?? '—'}</strong>
                  {member.isPrimary ? <small>Primary</small> : null}
                  {member.roleTitle ? <small>{member.roleTitle}</small> : null}
                </span>
                <span>{member.memberType === 'STAFF' ? 'Staff' : 'Owner'}</span>
                <span>{member.user.email ?? '—'}</span>
                <span>{member.isActive ? 'Active' : 'Inactive'}</span>
                <span className="quick-actions">
                  <button
                    className="ghost-control"
                    disabled={!canManage}
                    type="button"
                    onClick={() => void resetPassword(member)}
                  >
                    Reset password
                  </button>
                  <button
                    className="ghost-control"
                    disabled={!canManage}
                    type="button"
                    onClick={() => void toggleActive(member)}
                  >
                    {member.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </span>
              </div>
            ))}
            {team.length === 0 ? (
              <div className="admin-table-row">
                <span>No owners or staff added for this lodge yet.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Add to team</p>
            <h3>Create owner or staff account</h3>
            <div className="form-stack">
              <label className="form-field">
                <span>Type</span>
                <select
                  disabled={!canManage}
                  value={teamForm.memberType}
                  onChange={(event) =>
                    setTeamForm((current) => ({
                      ...current,
                      memberType: event.target.value as LodgeTeamMemberType,
                    }))
                  }
                >
                  <option value="OWNER">Owner</option>
                  <option value="STAFF">Staff</option>
                </select>
              </label>
              <label className="form-field">
                <span>Full name</span>
                <input
                  disabled={!canManage}
                  value={teamForm.name}
                  onChange={(event) =>
                    setTeamForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Email (login)</span>
                <input
                  disabled={!canManage}
                  type="email"
                  value={teamForm.email}
                  onChange={(event) =>
                    setTeamForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input
                  disabled={!canManage}
                  placeholder="+919999999999"
                  value={teamForm.phoneNumber}
                  onChange={(event) =>
                    setTeamForm((current) => ({ ...current, phoneNumber: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Initial password</span>
                <input
                  disabled={!canManage}
                  placeholder="Min 8 characters, 1 letter + 1 number"
                  type="text"
                  value={teamForm.password}
                  onChange={(event) =>
                    setTeamForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Role title (optional)</span>
                <input
                  disabled={!canManage}
                  placeholder="e.g. Front Desk"
                  value={teamForm.roleTitle}
                  onChange={(event) =>
                    setTeamForm((current) => ({ ...current, roleTitle: event.target.value }))
                  }
                />
              </label>
              {teamForm.memberType === 'OWNER' ? (
                <label className="checkbox-row">
                  <input
                    checked={teamForm.isPrimary}
                    disabled={!canManage}
                    type="checkbox"
                    onChange={(event) =>
                      setTeamForm((current) => ({ ...current, isPrimary: event.target.checked }))
                    }
                  />
                  <span>Primary lodge owner</span>
                </label>
              ) : null}
              <button
                className="button button-primary"
                disabled={!canManage}
                type="button"
                onClick={() => void createTeamMember()}
              >
                Create account
              </button>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Assign existing user</p>
            <h3>Attach an existing owner account to this lodge</h3>
            <p className="muted-copy">
              Only for a user who already has an owner login elsewhere. For a brand-new person, use
              &quot;Create owner or staff account&quot; instead.
            </p>
            <div className="form-stack">
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
        </section>

        <section className="table-panel">
          <div className="quick-actions">
            <Link className="ghost-control" href="/admin/lodges">
              Open Lodges
            </Link>
            <Link className="ghost-control" href="/admin/verification">
              Open Verification
            </Link>
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
