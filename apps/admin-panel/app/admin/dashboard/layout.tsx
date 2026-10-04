import type { PropsWithChildren } from 'react';

import { DashboardKpiCards } from '../../../src/components/DashboardKpiCards';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminDashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="page-stack">
      <PermissionGate permission="dashboard.view">
        <DashboardKpiCards />
      </PermissionGate>
      {children}
    </div>
  );
}
