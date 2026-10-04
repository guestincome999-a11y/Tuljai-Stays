import type { PropsWithChildren } from 'react';

import { DashboardBookingOverview } from '../../../src/components/DashboardBookingOverview';
import { DashboardInsights } from '../../../src/components/DashboardInsights';
import { DashboardKpiCards } from '../../../src/components/DashboardKpiCards';
import { DashboardOperations } from '../../../src/components/DashboardOperations';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminDashboardLayout({ children }: PropsWithChildren) {
  return (
    <div className="page-stack">
      <PermissionGate permission="dashboard.view">
        <DashboardKpiCards />
        <DashboardBookingOverview />
        <DashboardInsights />
        <DashboardOperations />
      </PermissionGate>
      {children}
    </div>
  );
}
