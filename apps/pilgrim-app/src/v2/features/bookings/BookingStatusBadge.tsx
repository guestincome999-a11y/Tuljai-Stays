import { StyleSheet, View } from 'react-native';

import { useColors } from '../../design/theme';
import type { ThemeColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { bookingStatusText } from '../../i18n/strings';
import { Text } from '../../ui/Text';

const TONE: Record<string, keyof ThemeColors> = {
  ACCEPTED: 'success',
  CANCELLED: 'danger',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'inkMuted',
  COMPLETED: 'inkMuted',
  DRAFT: 'inkMuted',
  EXPIRED: 'danger',
  NO_SHOW: 'danger',
  PENDING_OWNER_APPROVAL: 'accent',
  QR_GENERATED: 'success',
  REJECTED: 'danger',
};

export function statusTone(status: string): keyof ThemeColors {
  return TONE[status] ?? 'inkMuted';
}

export function BookingStatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const { t } = useLang();
  const tone = statusTone(status);
  const text = bookingStatusText[status];

  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.dot, { backgroundColor: colors[tone] }]} />
      <Text variant="caption">{text ? t(text.label) : status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  dot: { borderRadius: radius.pill, height: 8, width: 8 },
});
