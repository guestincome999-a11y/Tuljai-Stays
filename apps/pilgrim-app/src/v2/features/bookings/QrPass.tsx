import * as MediaLibrary from 'expo-media-library';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { fetchQrPass } from '../../core/bookings';
import { useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { elevation, radius, space } from '../../design/tokens';
import { extraStrings } from '../../i18n/extraStrings';
import { useLang } from '../../i18n/language';
import { myBookingsStrings } from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';

/**
 * The check-in QR. It is drawn black on white with a generous margin because the lodge scans it
 * with a phone camera, often in bright sun, and contrast matters more than matching the theme.
 */
export function QrPass({ bookingId }: { bookingId: string }) {
  const colors = useColors();
  const { t } = useLang();
  const toast = useToast();
  const shot = useRef<View>(null);
  const [saving, setSaving] = useState(false);
  const { data, error, loading, refresh } = useCachedFetch(`qr:${bookingId}`, () =>
    fetchQrPass(bookingId),
  );

  async function savePass() {
    if (!shot.current || saving) return;
    setSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        toast(t(extraStrings.savePassDenied));
        return;
      }
      const uri = await captureRef(shot, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      toast(t(extraStrings.savePassDone));
    } catch {
      toast(t(extraStrings.somethingWrong));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.card, elevation.card, { backgroundColor: colors.surface }]}>
      <Text variant="heading">{t(myBookingsStrings.passTitle)}</Text>
      {data ? (
        <>
          <View collapsable={false} ref={shot} style={styles.shot}>
            <View style={styles.qrFrame}>
              <QRCode backgroundColor="#FFFFFF" color="#000000" size={232} value={data.qrPayload} />
            </View>
            <Text align="center" variant="title">
              {data.bookingCode}
            </Text>
          </View>
          <Text align="center" color="inkMuted" variant="label">
            {t(myBookingsStrings.passHint)}
          </Text>
          <Button
            label={t(extraStrings.savePass)}
            loading={saving}
            variant="secondary"
            onPress={() => void savePass()}
          />
        </>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : null}
      {!data && error ? (
        <View style={styles.errorBox}>
          <Text align="center" color="inkMuted">
            {t(myBookingsStrings.passUnavailable)}
          </Text>
          <Button
            label={t(myBookingsStrings.passRetry)}
            variant="secondary"
            onPress={() => void refresh()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', borderRadius: radius.lg, gap: space.lg, padding: space.xl },
  errorBox: { alignSelf: 'stretch', gap: space.md },
  loader: { paddingVertical: space.huge },
  shot: { alignItems: 'center', backgroundColor: '#FFFFFF', gap: space.md, padding: space.md },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderColor: '#E8DED3',
    borderWidth: 1,
    padding: space.lg,
  },
});
