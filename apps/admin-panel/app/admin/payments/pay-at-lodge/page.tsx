import { PaymentsView } from '../../../../src/components/finance/PaymentsView';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminPayAtLodgePaymentsPage() {
  return (
    <PermissionGate permission="finance.view">
      <PaymentsView
        preset={{
          method: 'PAY_AT_LODGE',
          note: 'Bookings where the guest pays the lodge directly. A payment counts as successful once the lodge records it as collected.',
        }}
      />
    </PermissionGate>
  );
}
