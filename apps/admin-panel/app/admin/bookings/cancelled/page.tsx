import { BookingViewList } from '../../../../src/components/bookings/BookingViewList';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminCancelledBookingsPage() {
  return (
    <PermissionGate permission="bookings.view">
      <BookingViewList
        emptyText="No cancelled or rejected bookings."
        note="Bookings that were cancelled, rejected by the owner, expired, or ended as a no-show."
        view="cancelled"
      />
    </PermissionGate>
  );
}
