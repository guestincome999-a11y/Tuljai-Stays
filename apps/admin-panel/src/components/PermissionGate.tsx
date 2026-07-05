'use client';

import type { PropsWithChildren } from 'react';

import { useAdminAuth } from '../auth/AdminAuthProvider';
import { hasPermission, type AdminPermission } from '../permissions/permissions';

export function PermissionGate({
  children,
  permission,
}: PropsWithChildren<{ permission: AdminPermission }>) {
  const auth = useAdminAuth();

  if (!hasPermission(auth.permissions, permission)) {
    return (
      <section className="panel">
        <p className="eyebrow">Restricted</p>
        <h2>You do not have permission to view this section.</h2>
        <p>Ask a Super Admin to review your role if you need access.</p>
      </section>
    );
  }

  return children;
}
