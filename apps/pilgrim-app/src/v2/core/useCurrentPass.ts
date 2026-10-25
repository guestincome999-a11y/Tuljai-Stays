import { CONTACT_STATUSES } from '../i18n/strings';

import { fetchMyBookings } from './bookings';
import { startOfToday, toDateOnly } from './dates';
import { useCachedFetch } from './useCachedFetch';
import { useSession } from './useSession';

/** The confirmed or current stay whose check-in pass the pilgrim is most likely to need next. */
export function useCurrentPass() {
  const session = useSession();
  const signedIn = session.user !== null;
  const { data: bookings } = useCachedFetch(
    signedIn ? 'my-bookings' : 'my-bookings:signed-out',
    () => (signedIn ? fetchMyBookings() : Promise.resolve([])),
  );
  const today = toDateOnly(startOfToday());
  const currentPass = (bookings ?? [])
    .filter((booking) => CONTACT_STATUSES.includes(booking.status) && booking.checkOutDate >= today)
    .sort((left, right) => left.checkInDate.localeCompare(right.checkInDate))[0];

  return { currentPass, signedIn };
}
