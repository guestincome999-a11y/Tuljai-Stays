import { useLocalSearchParams } from 'expo-router';

import { BookingDetailScreen } from '../../src/v2/features/bookings/BookingDetailScreen';
import { useGo, useRequireAuth } from '../../src/v2/shell/navigation';

export default function BookingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { back } = useGo();
  const allowed = useRequireAuth(`/booking/${id}`);

  if (!allowed) return null;

  return <BookingDetailScreen bookingId={id} onBack={back} />;
}
