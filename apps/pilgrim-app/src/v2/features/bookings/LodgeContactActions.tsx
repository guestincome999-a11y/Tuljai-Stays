import { Linking, StyleSheet, View } from 'react-native';

import { BookingActionButton } from '../../../features/bookings/components/BookingActionButton';
import { fetchLodgeContact } from '../../core/bookings';
import { useCachedFetch } from '../../core/useCachedFetch';
import { space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { myBookingsStrings } from '../../i18n/strings';

/**
 * Lodge phone numbers are only released by the backend once a booking is confirmed, so this is
 * mounted only for confirmed or later bookings.
 */
export function LodgeContactActions({ bookingId }: { bookingId: string }) {
  const { t } = useLang();
  const { data } = useCachedFetch(`contact:${bookingId}`, () => fetchLodgeContact(bookingId));
  if (!data) return null;

  const whatsappDigits = data.whatsappNumber?.replace(/\D/gu, '') ?? '';

  return (
    <View style={styles.row}>
      <BookingActionButton
        icon="phone-outline"
        label={t(myBookingsStrings.call)}
        onPress={() => void Linking.openURL(`tel:${data.primaryPhone}`)}
      />
      {whatsappDigits.length > 0 ? (
        <BookingActionButton
          icon="whatsapp"
          label={t(myBookingsStrings.whatsapp)}
          onPress={() => void Linking.openURL(`https://wa.me/${whatsappDigits}`)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
});
