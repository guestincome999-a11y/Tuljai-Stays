import { BookingViewList } from '../../../../src/components/bookings/BookingViewList';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminActiveStaysPage() {
  return (
    <PermissionGate permission="bookings.view">
      <BookingViewList
        emptyText="No guests are checked in right now."
        note="Guests who are checked in right now, with the earliest check-out first."
        view="active"
      />
    </PermissionGate>
  );
}
