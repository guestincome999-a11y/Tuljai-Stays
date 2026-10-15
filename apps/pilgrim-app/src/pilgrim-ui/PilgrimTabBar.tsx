import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { selectCurrentPassBooking } from './booking-selection';
import { ui, type PilgrimIconName } from './components';
import { usePilgrimApp } from './PilgrimAppProvider';

const tabItems: Array<{
  activeIcon: PilgrimIconName;
  href: '/(app)/bookings' | '/(app)/home' | '/(app)/lodges' | '/(app)/profile';
  icon: PilgrimIconName;
  label: string;
  labelMr: string;
  routeMatch: string;
}> = [
  {
    activeIcon: 'home-heart',
    href: '/(app)/home',
    icon: 'home-outline',
    label: 'Home',
    labelMr: 'मुख्य',
    routeMatch: '/home',
  },
  {
    activeIcon: 'compass',
    href: '/(app)/lodges',
    icon: 'compass-outline',
    label: 'Explore',
    labelMr: 'शोधा',
    routeMatch: '/lodges',
  },
  {
    activeIcon: 'calendar-check',
    href: '/(app)/bookings',
    icon: 'calendar-check-outline',
    label: 'Bookings',
    labelMr: 'बुकिंग',
    routeMatch: '/bookings',
  },
  {
    activeIcon: 'account-circle',
    href: '/(app)/profile',
    icon: 'account-circle-outline',
    label: 'Profile',
    labelMr: 'प्रोफाइल',
    routeMatch: '/profile',
  },
];

// Lodge detail and checkout own a sticky bottom action bar (Check availability /
// Pay), so the tab bar steps aside there — like a booking app's funnel pages.
// The nested stack's active screen is read from the tab route's own state.
function isFunnelScreen(state: BottomTabBarProps['state']): boolean {
  const route = state.routes[state.index];
  const nested = route?.state;
  const nestedName = nested?.routes[nested.index ?? nested.routes.length - 1]?.name;
  if (!route || !nestedName) return false;
  return (
    (route.name === 'lodges' && nestedName === '[id]') ||
    (route.name === 'bookings' && nestedName === 'new')
  );
}

export function PilgrimTabBar({ state }: BottomTabBarProps) {
  const router = useRouter();
  const selectedRoute = state.routes[state.index]?.name ?? '';
  const { bookings, t } = usePilgrimApp();
  const upcoming = selectCurrentPassBooking(bookings);
  const passSelected = selectedRoute === 'pass';

  if (isFunnelScreen(state)) return null;

  return (
    <SafeAreaView className="border-t border-warm-200 bg-white" edges={['bottom']}>
      <View className="h-[60px] flex-row items-center">
        {tabItems.slice(0, 2).map((item) => (
          <TabItem
            item={item}
            key={item.href}
            router={router}
            selectedRoute={selectedRoute}
            t={t}
          />
        ))}

        <Pressable
          accessibilityLabel={t('Open upcoming stay pass', 'आगामी निवास पास उघडा')}
          accessibilityRole="button"
          className="h-full flex-1 items-center justify-center gap-0.5 active:opacity-70"
          onPress={() => router.push('/(app)/pass')}
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron-500">
            <MaterialCommunityIcons color="#FFFFFF" name="qrcode-scan" size={19} />
            {upcoming?.qrReady ? (
              <View className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-templeGreen-500" />
            ) : null}
          </View>
          <Text
            className={`text-[11px] font-bold ${passSelected ? 'text-saffron-600' : 'text-warm-500'}`}
          >
            {t('Pass', 'पास')}
          </Text>
        </Pressable>

        {tabItems.slice(2).map((item) => (
          <TabItem
            item={item}
            key={item.href}
            router={router}
            selectedRoute={selectedRoute}
            t={t}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

function TabItem({
  item,
  router,
  selectedRoute,
  t,
}: {
  item: (typeof tabItems)[number];
  router: ReturnType<typeof useRouter>;
  selectedRoute: string;
  t: (english: string, marathi: string) => string;
}) {
  const routeName = item.routeMatch.slice(1);
  const selected = selectedRoute === routeName || selectedRoute.startsWith(`${routeName}/`);

  return (
    <Pressable
      accessibilityLabel={t(item.label, item.labelMr)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="h-full flex-1 items-center justify-center gap-0.5 active:opacity-70"
      onPress={() => router.push(item.href)}
    >
      <MaterialCommunityIcons
        color={selected ? ui.brandDeep : ui.muted}
        name={selected ? item.activeIcon : item.icon}
        size={24}
      />
      <Text className={`text-[11px] font-bold ${selected ? 'text-saffron-600' : 'text-warm-500'}`}>
        {t(item.label, item.labelMr)}
      </Text>
    </Pressable>
  );
}
