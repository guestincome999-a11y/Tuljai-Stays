import { PaymentsView } from '../../../../src/components/finance/PaymentsView';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminRefundsPage() {
  return (
    <PermissionGate permission="finance.view">
      <PaymentsView
        preset={{
          note: 'Payments marked as refunded. Refunds themselves are issued from the Razorpay dashboard; this list shows what has been recorded here.',
          status: 'REFUNDED',
        }}
      />
    </PermissionGate>
  );
}
