import type { PropsWithChildren } from 'react';

import { DashboardBookingOverview } from '../../../src/components/DashboardBookingOverview';
import { DashboardKpiCards } from '../../../src/components/DashboardKpiCards';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminDashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="page-stack">
      <PermissionGate permission="dashboard.view">
        <DashboardKpiCards />
        <DashboardBookingOverview />
      </PermissionGate>
      {children}
    </div>
  );
}
