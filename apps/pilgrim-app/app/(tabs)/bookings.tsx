import { BookingsScreen } from '../../src/v2/features/bookings/BookingsScreen';
import { useGo } from '../../src/v2/shell/navigation';

export default function BookingsRoute() {
  const { push } = useGo();

  return (
    <BookingsScreen
      onExplore={() => push('/explore')}
      onOpenBooking={(bookingId) => push(`/booking/${bookingId}`)}
      onSignIn={() => push('/login?next=%2Fbookings')}
    />
  );
}
