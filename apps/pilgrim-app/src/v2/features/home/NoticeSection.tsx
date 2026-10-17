import type { Announcement, PaginatedResponse } from '@tuljai/types';
import { StyleSheet, View } from 'react-native';

import { api } from '../../core/api';
import { useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

/** Shows the newest active announcement as a single quiet card. Hidden when there is none. */
export function NoticeSection({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const { data } = useCachedFetch('announcements:latest', () =>
    api.get<PaginatedResponse<Announcement>>('/announcements', { params: { limit: 1, page: 1 } }),
  );
  const notice = data?.items[0];
  if (!notice) return null;

  return (
    <PressableScale
      accessibilityLabel={notice.title}
      pressedScale={0.985}
      style={[styles.card, { backgroundColor: colors.accentSoft }]}
      onPress={onPress}
    >
      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
        <Icon color="onPrimary" name="bell" size={16} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} variant="label">
          {notice.title}
        </Text>
        <Text color="inkMuted" numberOfLines={2} variant="caption">
          {notice.body}
        </Text>
      </View>
      <Icon color="inkMuted" name="chevron-right" size={18} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  card: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: space.md,
    marginHorizontal: gutter,
    padding: space.lg,
  },
  copy: { flex: 1, gap: 2 },
});
