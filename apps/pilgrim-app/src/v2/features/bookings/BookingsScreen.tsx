import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchMyBookings } from '../../core/bookings';
import { useCachedFetch } from '../../core/useCachedFetch';
import { useSession } from '../../core/useSession';
import { useColors } from '../../design/theme';
import { gutter, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { UPCOMING_STATUSES, myBookingsStrings } from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';

import { BookingCard } from './BookingCard';

export interface BookingsScreenProps {
  onExplore: () => void;
  onOpenBooking: (bookingId: string) => void;
  onSignIn: () => void;
}

export function BookingsScreen({ onExplore, onOpenBooking, onSignIn }: BookingsScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const session = useSession();
  const signedIn = session.user !== null;
  const [tab, setTab] = useState<'past' | 'upcoming'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, refresh } = useCachedFetch(
    signedIn ? 'my-bookings' : 'my-bookings:signed-out',
    () => (signedIn ? fetchMyBookings() : Promise.resolve([])),
  );

  const shown = useMemo(() => {
    const all = data ?? [];
    if (tab === 'upcoming') {
      return all
        .filter((booking) => UPCOMING_STATUSES.includes(booking.status))
        .sort((left, right) => left.checkInDate.localeCompare(right.checkInDate));
    }
    return all.filter((booking) => !UPCOMING_STATUSES.includes(booking.status));
  }, [data, tab]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.lg }]}>
      <Text variant="title">{t(myBookingsStrings.title)}</Text>
    </View>
  );

  if (!signedIn) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.empty}>
          <Text align="center" variant="heading">
            {t(myBookingsStrings.signInTitle)}
          </Text>
          <Text align="center" color="inkMuted">
            {t(myBookingsStrings.signInBody)}
          </Text>
          <Button label={t(myBookingsStrings.signInAction)} onPress={onSignIn} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {header}
      <View style={styles.tabs}>
        <FilterChip
          label={t(myBookingsStrings.upcoming)}
          selected={tab === 'upcoming'}
          onPress={() => setTab('upcoming')}
        />
        <FilterChip
          label={t(myBookingsStrings.past)}
          selected={tab === 'past'}
          onPress={() => setTab('past')}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              void refresh().finally(() => setRefreshing(false));
            }}
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
        {data && shown.length === 0 ? (
          <View style={styles.empty}>
            <Text align="center" color="inkMuted">
              {t(myBookingsStrings.empty)}
            </Text>
            {tab === 'upcoming' ? (
              <Button
                label={t(myBookingsStrings.emptyAction)}
                variant="secondary"
                onPress={onExplore}
              />
            ) : null}
          </View>
        ) : null}
        {shown.map((booking) => (
          <BookingCard booking={booking} key={booking.id} onPress={onOpenBooking} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: gutter,
    paddingVertical: space.huge,
  },
  header: { paddingHorizontal: gutter },
  list: {
    gap: space.lg,
    paddingBottom: space.huge * 2,
    paddingHorizontal: gutter,
    paddingTop: space.lg,
  },
  screen: { flex: 1 },
  tabs: { flexDirection: 'row', gap: space.sm, paddingHorizontal: gutter, paddingTop: space.lg },
});
