import { PaymentsView } from '../../../src/components/finance/PaymentsView';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminPaymentsPage() {
  return (
    <PermissionGate permission="finance.view">
      <PaymentsView
        preset={{
          note: 'Every payment collected for a booking, online or at the lodge. Use the status filters to narrow the list.',
        }}
      />
    </PermissionGate>
  );
}
