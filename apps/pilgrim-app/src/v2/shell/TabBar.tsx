import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCachedFetch } from '../core/useCachedFetch';
import { useCurrentPass } from '../core/useCurrentPass';
import { useColors } from '../design/theme';
import { elevation, space } from '../design/tokens';
import { fetchUnreadCount } from '../features/notifications/NotificationsScreen';
import { extraStrings } from '../i18n/extraStrings';
import { useLang } from '../i18n/language';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { PressableScale } from '../ui/PressableScale';
import { Text } from '../ui/Text';

import { useGo } from './navigation';

const TABS: Array<{ icon: IconName; label: keyof typeof extraStrings; name: string }> = [
  { icon: 'home', label: 'tabHome', name: 'index' },
  { icon: 'compass', label: 'tabExplore', name: 'explore' },
  { icon: 'calendar', label: 'tabBookings', name: 'bookings' },
  { icon: 'user', label: 'tabProfile', name: 'profile' },
];

/**
 * Four tabs, plus a raised Pass button in the middle whenever there is a confirmed or current
 * stay, so the check-in QR is always one tap away.
 */
export function TabBar({ navigation, state }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { push } = useGo();
  const { currentPass, signedIn } = useCurrentPass();
  const { data: unread } = useCachedFetch(
    signedIn ? 'notifications:unread' : 'notifications:none',
    () => (signedIn ? fetchUnreadCount() : Promise.resolve({ unreadCount: 0 })),
  );

  const activeName = state.routes[state.index]?.name;
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  function renderTab(tab: (typeof TABS)[number]) {
    const selected = activeName === tab.name;
    const showDot = tab.name === 'profile' && (unread?.unreadCount ?? 0) > 0;
    return (
      <PressableScale
        accessibilityLabel={t(extraStrings[tab.label])}
        accessibilityState={{ selected }}
        key={tab.name}
        pressedScale={0.92}
        style={styles.tab}
        onPress={() => navigation.navigate(tab.name)}
      >
        <View>
          <Icon color={selected ? 'primary' : 'inkMuted'} name={tab.icon} size={22} />
          {showDot ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
        </View>
        <Text color={selected ? 'primary' : 'inkMuted'} variant="caption">
          {t(extraStrings[tab.label])}
        </Text>
      </PressableScale>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        elevation.raised,
        { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}
    >
      {left.map(renderTab)}
      {currentPass ? (
        <View style={styles.centerSlot}>
          <PressableScale
            accessibilityLabel={t(extraStrings.pass)}
            haptic
            pressedScale={0.92}
            style={[styles.centerButton, elevation.raised, { backgroundColor: colors.primary }]}
            onPress={() => push(`/booking/${currentPass.id}`)}
          >
            <Icon color="onPrimary" name="grid" size={24} />
          </PressableScale>
        </View>
      ) : null}
      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'flex-end', flexDirection: 'row', paddingTop: space.sm },
  centerButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    marginTop: -space.xxl,
    width: 56,
  },
  centerSlot: { alignItems: 'center', flex: 1 },
  dot: { borderRadius: 999, height: 8, position: 'absolute', right: -4, top: -2, width: 8 },
  tab: { alignItems: 'center', flex: 1, gap: 2, paddingVertical: space.xs },
});
