import { BookingConflictsView } from '../../../../src/components/bookings/BookingConflictsView';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminBookingConflictsPage() {
  return (
    <PermissionGate permission="operations.view">
      <BookingConflictsView />
    </PermissionGate>
  );
}
