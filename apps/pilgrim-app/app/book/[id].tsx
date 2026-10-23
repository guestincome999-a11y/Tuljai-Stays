import { useLocalSearchParams } from 'expo-router';

import { BookingScreen } from '../../src/v2/features/booking/BookingScreen';
import { useGo, useRequireAuth } from '../../src/v2/shell/navigation';

export default function BookRoute() {
  const { id, roomTypeId } = useLocalSearchParams<{ id: string; roomTypeId?: string }>();
  const { back, replace } = useGo();
  const allowed = useRequireAuth(`/book/${id}`);

  if (!allowed) return null;

  return (
    <BookingScreen
      initialRoomTypeId={roomTypeId}
      lodgeId={id}
      onBack={back}
      onBooked={(bookingId) => replace(`/booking/${bookingId}`)}
    />
  );
}
