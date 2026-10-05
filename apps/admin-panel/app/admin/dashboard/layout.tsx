import type { PropsWithChildren } from 'react';

import { DashboardView } from '../../../src/components/dashboard/DashboardView';
import { PermissionGate } from '../../../src/components/PermissionGate';

/**
 * The dashboard is composed entirely by DashboardView (mockup layout). The previous
 * live-operations tiles in ./page.tsx are intentionally no longer rendered here; the
 * page file is kept unchanged so they can be rebuilt as cards if wanted.
 */
export default function AdminDashboardLayout({ children }: PropsWithChildren) {
  void children;
  return (
    <div className="page-stack">
      <PermissionGate permission="dashboard.view">
        <DashboardView />
      </PermissionGate>
    </div>
  );
}
