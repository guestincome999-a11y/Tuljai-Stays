import { BookingViewList } from '../../../../src/components/bookings/BookingViewList';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminCompletedStaysPage() {
  return (
    <PermissionGate permission="bookings.view">
      <BookingViewList
        emptyText="No completed stays yet."
        note="Stays that have ended, most recently updated first."
        view="completed"
      />
    </PermissionGate>
  );
}
