import { Linking, StyleSheet, View } from 'react-native';

import { fetchLodgeContact } from '../../core/bookings';
import { useCachedFetch } from '../../core/useCachedFetch';
import { space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { myBookingsStrings } from '../../i18n/strings';
import { Button } from '../../ui/Button';

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
      <Button
        label={t(myBookingsStrings.call)}
        style={styles.button}
        variant="secondary"
        onPress={() => void Linking.openURL(`tel:${data.primaryPhone}`)}
      />
      {whatsappDigits.length > 0 ? (
        <Button
          label={t(myBookingsStrings.whatsapp)}
          style={styles.button}
          variant="secondary"
          onPress={() => void Linking.openURL(`https://wa.me/${whatsappDigits}`)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
});
