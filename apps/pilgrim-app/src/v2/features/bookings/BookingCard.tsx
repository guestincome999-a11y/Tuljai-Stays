import { StyleSheet, View } from 'react-native';

import type { MyBookingCard } from '../../core/bookings';
import { formatShortDate } from '../../core/dates';
import { useColors } from '../../design/theme';
import { elevation, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { formatRupees, myBookingsStrings } from '../../i18n/strings';
import { Icon } from '../../ui/Icon';
import { Photo } from '../../ui/Photo';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

import { BookingStatusBadge } from './BookingStatusBadge';

export function BookingCard({
  booking,
  onPress,
}: {
  booking: MyBookingCard;
  onPress: (bookingId: string) => void;
}) {
  const colors = useColors();
  const { lang, t } = useLang();

  return (
    <PressableScale
      accessibilityLabel={booking.lodgeName}
      pressedScale={0.985}
      style={[styles.card, elevation.card, { backgroundColor: colors.surface }]}
      onPress={() => onPress(booking.id)}
    >
      <Photo style={styles.photo} uri={booking.coverUrl} />
      <View style={styles.body}>
        <Text numberOfLines={1} variant="heading">
          {booking.lodgeName}
        </Text>
        <View style={styles.row}>
          <Icon color="inkMuted" name="calendar" size={14} />
          <Text color="inkMuted" variant="caption">
            {formatShortDate(booking.checkInDate, lang)} →{' '}
            {formatShortDate(booking.checkOutDate, lang)}
          </Text>
        </View>
        <Text color="inkMuted" variant="caption">
          {booking.totalGuests} {t(myBookingsStrings.guests)}
          {booking.totalAmount ? ` · ${formatRupees(booking.totalAmount)}` : ''}
        </Text>
        <BookingStatusBadge status={booking.status} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: space.xs },
  card: { borderRadius: radius.lg, flexDirection: 'row', gap: space.lg, padding: space.md },
  photo: { alignSelf: 'center', borderRadius: radius.md, height: 96, width: 96 },
  row: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
});
