import type { Notification, NotificationUnreadCount, PaginatedResponse } from '@tuljai/types';
import { useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../core/api';
import { syncBadge } from '../../core/push';
import { refreshAllCached, useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { accountStrings } from '../../i18n/accountStrings';
import { useLang } from '../../i18n/language';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';

const PAGE_SIZE = 30;

export function fetchUnreadCount(): Promise<NotificationUnreadCount> {
  return api.get<NotificationUnreadCount>('/notifications/unread-count');
}

function fetchNotifications(): Promise<PaginatedResponse<Notification>> {
  return api.get<PaginatedResponse<Notification>>('/notifications', {
    params: { limit: PAGE_SIZE, page: 1 },
  });
}

function relativeTime(iso: string, lang: 'en' | 'mr'): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return lang === 'mr' ? 'आत्ता' : 'Just now';
  if (minutes < 60) return lang === 'mr' ? `${minutes} मि. पूर्वी` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return lang === 'mr' ? `${hours} तासांपूर्वी` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return lang === 'mr' ? `${days} दिवसांपूर्वी` : `${days} d ago`;
}

export function NotificationsScreen({
  onBack,
  onOpenBooking,
}: {
  onBack: () => void;
  onOpenBooking: (bookingId: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const { data, loading } = useCachedFetch('notifications', fetchNotifications);
  const items = data?.items ?? [];
  const unread = items.filter((item) => item.readAt === null).length;

  useEffect(() => {
    void syncBadge(unread);
  }, [unread]);

  async function open(notification: Notification) {
    if (notification.readAt === null) {
      await api.post(`/notifications/${notification.id}/read`).catch(() => undefined);
      void refreshAllCached();
    }
    if (notification.bookingId) onOpenBooking(notification.bookingId);
  }

  async function markAll() {
    await api.post('/notifications/read-all').catch(() => undefined);
    await refreshAllCached();
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
        <Text style={styles.title} variant="title">
          {t(accountStrings.notifications)}
        </Text>
        {unread > 0 ? (
          <PressableScale
            accessibilityLabel={t(accountStrings.markAllRead)}
            onPress={() => void markAll()}
          >
            <Text color="primary" variant="label">
              {t(accountStrings.markAllRead)}
            </Text>
          </PressableScale>
        ) : null}
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
            <Skeleton height={80} />
            <Skeleton height={80} />
          </>
        ) : null}
        {data && items.length === 0 ? (
          <Text align="center" color="inkMuted" style={styles.empty}>
            {t(accountStrings.noNotifications)}
          </Text>
        ) : null}
        {items.map((item) => (
          <PressableScale
            accessibilityLabel={item.title}
            key={item.id}
            pressedScale={0.985}
            style={[
              styles.card,
              { backgroundColor: item.readAt === null ? colors.surface : colors.surfaceMuted },
            ]}
            onPress={() => void open(item)}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
              <Icon color="primary" name="bell" size={18} />
            </View>
            <View style={styles.copy}>
              <Text variant="label">{item.title}</Text>
              <Text color="inkMuted" numberOfLines={3} variant="caption">
                {item.body}
              </Text>
              <Text color="inkFaint" variant="caption">
                {relativeTime(item.createdAt, lang)}
              </Text>
            </View>
            {item.readAt === null ? (
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            ) : null}
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
  card: {
    alignItems: 'flex-start',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
  },
  copy: { flex: 1, gap: 2 },
  dot: { borderRadius: radius.pill, height: 10, marginTop: 6, width: 10 },
  empty: { paddingVertical: space.huge },
  header: { alignItems: 'center', flexDirection: 'row', gap: space.lg, paddingHorizontal: gutter },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  list: {
    gap: space.md,
    paddingBottom: space.huge * 2,
    paddingHorizontal: gutter,
    paddingTop: space.lg,
  },
  screen: { flex: 1 },
  title: { flex: 1 },
});
