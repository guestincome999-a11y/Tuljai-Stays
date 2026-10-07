import { PaymentsView } from '../../../../src/components/finance/PaymentsView';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminRazorpayTransactionsPage() {
  return (
    <PermissionGate permission="finance.view">
      <PaymentsView
        preset={{
          method: 'ONLINE',
          note: 'Online payments taken through Razorpay for prepaid bookings. The reference is the Razorpay payment ID (or order ID until the payment completes).',
        }}
      />
    </PermissionGate>
  );
}
