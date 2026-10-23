import { NotificationsScreen } from '../src/v2/features/notifications/NotificationsScreen';
import { useGo, useRequireAuth } from '../src/v2/shell/navigation';

export default function NotificationsRoute() {
  const { back, push } = useGo();
  const allowed = useRequireAuth('/notifications');

  if (!allowed) return null;

  return (
    <NotificationsScreen
      onBack={back}
      onOpenBooking={(bookingId) => push(`/booking/${bookingId}`)}
    />
  );
}
