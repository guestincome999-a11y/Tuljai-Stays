import { SettlementsView } from '../../../src/components/finance/SettlementsView';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminOwnerSettlementsPage() {
  return (
    <PermissionGate permission="finance.view">
      <SettlementsView />
    </PermissionGate>
  );
}
