'use client';

import { useCallback, useEffect, useState } from 'react';

import { assignStaffRole, listStaffAccounts, type StaffAccount, type StaffRole } from '../../../src/api/admin-staff-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

const roles: Array<{ value: StaffRole; label: string }> = [
  { value: 'FINANCE_ADMIN', label: 'Finance Admin' },
  { value: 'OPERATIONS_MANAGER', label: 'Operations Manager' },
  { value: 'SUPPORT_EXECUTIVE', label: 'Support Executive' },
  { value: 'PHOTO_REVIEWER', label: 'Photo Reviewer' },
  { value: 'ANALYST', label: 'Analyst' },
];

export default function StaffPage() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setAccounts(await listStaffAccounts()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load staff accounts.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(userId: string, role: StaffRole | null) { setSavingId(userId); setError(null); try { await assignStaffRole(userId, role); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update staff role.'); } finally { setSavingId(null); } }
  return <PermissionGate permission="settings.manage"><div className="page-stack"><section className="hero-panel"><div><p className="eyebrow">Access Control</p><h1>Staff roles</h1><p>Assign one least-privilege operating role to an existing admin account.</p></div></section>{error ? <section className="error-banner">{error}<button className="button button-secondary" type="button" onClick={() => void load()}>Retry</button></section> : null}<section className="panel-card">{loading ? <p>Loading staff accounts…</p> : null}{!loading && accounts.length === 0 ? <div className="empty-state"><h2>No staff accounts</h2><p>Create an admin account first, then assign its operating role here.</p></div> : null}{!loading && accounts.length > 0 ? <div className="table-shell"><table className="data-table"><thead><tr><th>Account</th><th>Base role</th><th>Staff role</th><th>Save</th></tr></thead><tbody>{accounts.map((account) => <StaffRow account={account} busy={savingId === account.user_id} key={account.user_id} onSave={save} />)}</tbody></table></div> : null}</section></div></PermissionGate>;
}
function StaffRow({ account, busy, onSave }: { account: StaffAccount; busy: boolean; onSave: (userId: string, role: StaffRole | null) => Promise<void>; }) {
  const [role, setRole] = useState<StaffRole | ''>(account.staff_role ?? '');
  return <tr><td><strong>{account.display_name || 'Unnamed admin'}</strong><div className="table-muted">{account.phone_number || 'No phone number'}</div></td><td>{account.base_roles.join(', ')}</td><td><select aria-label={`Staff role for ${account.display_name || account.user_id}`} className="input" disabled={busy} value={role} onChange={(event) => setRole(event.target.value as StaffRole | '')}><option value="">No sub-role</option>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td><td><button className="button button-primary" disabled={busy} type="button" onClick={() => void onSave(account.user_id, role || null)}>{busy ? 'Saving…' : 'Save'}</button></td></tr>;
}
