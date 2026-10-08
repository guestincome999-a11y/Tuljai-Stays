import { BookingViewList } from '../../../../src/components/bookings/BookingViewList';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminUpcomingBookingsPage() {
  return (
    <PermissionGate permission="bookings.view">
      <BookingViewList
        emptyText="No upcoming bookings match these filters."
        note="Guests who have not arrived yet, soonest first. Use the date filters to see who arrives today, tomorrow, this week or later."
        view="upcoming"
      />
    </PermissionGate>
  );
}
