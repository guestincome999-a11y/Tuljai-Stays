import type { Announcement, PaginatedResponse } from '@tuljai/types';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../core/api';
import { refreshAllCached, useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { accountStrings } from '../../i18n/accountStrings';
import { useLang } from '../../i18n/language';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';

function fetchAnnouncements(): Promise<PaginatedResponse<Announcement>> {
  return api.get<PaginatedResponse<Announcement>>('/announcements', {
    params: { limit: 30, page: 1 },
  });
}

function formatDate(iso: string, lang: 'en' | 'mr'): string {
  return new Date(iso).toLocaleDateString(lang === 'mr' ? 'mr-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AnnouncementsScreen({ onBack }: { onBack: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const { data, loading } = useCachedFetch('announcements', fetchAnnouncements);
  const items = data?.items ?? [];

  async function markRead(item: Announcement) {
    if (item.readAt !== null) return;
    await api.post(`/announcements/${item.id}/read`).catch(() => undefined);
    void refreshAllCached();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressableScale
          accessibilityLabel="Back"
          pressedScale={0.92}
          style={[styles.back, { backgroundColor: colors.surface }]}
          onPress={onBack}
        >
          <Icon name="arrow-left" size={20} />
        </PressableScale>
        <Text variant="title">{t(accountStrings.announcements)}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={false}
            tintColor={colors.primary}
            onRefresh={() => void refreshAllCached()}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? (
          <>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </>
        ) : null}
        {data && items.length === 0 ? (
          <Text align="center" color="inkMuted" style={styles.empty}>
            {t(accountStrings.noAnnouncements)}
          </Text>
        ) : null}
        {items.map((item) => (
          <PressableScale
            accessibilityLabel={item.title}
            key={item.id}
            pressedScale={0.99}
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => void markRead(item)}
          >
            <View style={styles.top}>
              <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
                <Text color="accent" variant="caption">
                  {item.category.replace(/_/gu, ' ')}
                </Text>
              </View>
              {item.readAt === null ? (
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              ) : null}
            </View>
            <Text variant="heading">{item.title}</Text>
            <Text color="inkMuted">{item.body}</Text>
            <Text color="inkFaint" variant="caption">
              {formatDate(item.createdAt, lang)}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  card: { borderRadius: radius.lg, gap: space.sm, padding: space.lg },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  dot: { borderRadius: radius.pill, height: 10, width: 10 },
  empty: { paddingVertical: space.huge },
  header: { alignItems: 'center', flexDirection: 'row', gap: space.lg, paddingHorizontal: gutter },
  list: {
    gap: space.md,
    paddingBottom: space.huge * 2,
    paddingHorizontal: gutter,
    paddingTop: space.lg,
  },
  screen: { flex: 1 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
