import { RefundsView } from '../../../../src/components/finance/RefundsView';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminRefundsPage() {
  return (
    <PermissionGate permission="finance.view">
      <RefundsView />
    </PermissionGate>
  );
}
