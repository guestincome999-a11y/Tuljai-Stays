import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import type { MyBookingCard } from '../../core/bookings';
import { formatShortDate } from '../../core/dates';
import { useColors } from '../../design/theme';
import { elevation, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { PASS_STATUSES, formatRupees, myBookingsStrings } from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Photo } from '../../ui/Photo';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

import { BookingStatusBadge } from './BookingStatusBadge';
import { QrPass } from './QrPass';

export function BookingCard({
  booking,
  onPress,
}: {
  booking: MyBookingCard;
  onPress: (bookingId: string) => void;
}) {
  const colors = useColors();
  const [passOpen, setPassOpen] = useState(false);
  const canViewPass = PASS_STATUSES.includes(booking.status);
  const { lang, t } = useLang();

  return (
    <View style={[styles.container, elevation.card, { backgroundColor: colors.surface }]}>
    <PressableScale
      accessibilityLabel={booking.lodgeName}
      pressedScale={0.985}
      style={styles.card}
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
    <View style={styles.actions}>
      <Button label={t({ en: 'View Details', mr: 'तपशील पहा' })} variant="secondary" onPress={() => onPress(booking.id)} />
      {canViewPass ? <Button label={t({ en: 'View Pass', mr: 'पास पहा' })} onPress={() => setPassOpen(true)} /> : null}
    </View>
    <Modal visible={passOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPassOpen(false)}>
      <ScrollView contentContainerStyle={[styles.pass, { backgroundColor: colors.background }]}>
        <Button label={t({ en: 'Close', mr: 'बंद करा' })} variant="secondary" onPress={() => setPassOpen(false)} />
        {passOpen ? <QrPass bookingId={booking.id} /> : null}
      </ScrollView>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.lg },
  actions: { gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  pass: { flexGrow: 1, gap: space.lg, padding: space.lg, paddingTop: space.huge },
  body: { flex: 1, gap: space.xs },
  card: { borderRadius: radius.lg, flexDirection: 'row', gap: space.lg, padding: space.md },
  photo: { alignSelf: 'center', borderRadius: radius.md, height: 96, width: 96 },
  row: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
});
