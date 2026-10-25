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

export function PilgrimTabBar({ state }: BottomTabBarProps) {
  const router = useRouter();
  const selectedRoute = state.routes[state.index]?.name ?? '';
  const { bookings, t } = usePilgrimApp();
  const upcoming = selectCurrentPassBooking(bookings);
  const passSelected = selectedRoute === 'pass';

  function openPass() {
    router.push('/(app)/pass');
  }

  return (
    <SafeAreaView className="border-t border-warm-200 bg-white" edges={['bottom']}>
      <View className="relative h-[72px] flex-row items-center px-1">
        {tabItems.slice(0, 2).map((item) => (
          <TabItem
            item={item}
            key={item.href}
            router={router}
            selectedRoute={selectedRoute}
            t={t}
          />
        ))}

        <View className="flex-1 items-center">
          <Pressable
            accessibilityLabel={t('Open upcoming stay pass', 'आगामी निवास पास उघडा')}
            accessibilityRole="button"
            className={`absolute -top-8 h-[68px] w-[68px] items-center justify-center rounded-full border-[5px] border-white shadow-lg shadow-maroon-800/30 active:bg-maroon-800 ${passSelected ? 'bg-saffron-600' : 'bg-maroon-700'}`}
            onPress={openPass}
          >
            <MaterialCommunityIcons color="#FFFFFF" name="qrcode-scan" size={29} />
            {upcoming?.qrReady ? (
              <View className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-white bg-templeGreen-500" />
            ) : null}
          </Pressable>
          <Text
            className={`mt-10 text-[11px] font-extrabold ${passSelected ? 'text-saffron-700' : 'text-maroon-700'}`}
          >
            {t('Pass', 'पास')}
          </Text>
        </View>

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
      className="min-h-16 flex-1 items-center justify-center gap-1"
      onPress={() => router.push(item.href)}
    >
      <View
        className={`h-8 min-w-12 items-center justify-center rounded-full px-3 ${selected ? 'bg-saffron-50' : ''}`}
      >
        <MaterialCommunityIcons
          color={selected ? ui.saffronDeep : ui.muted}
          name={selected ? item.activeIcon : item.icon}
          size={23}
        />
      </View>
      <Text className={`text-[10px] font-bold ${selected ? 'text-saffron-700' : 'text-warm-500'}`}>
        {t(item.label, item.labelMr)}
      </Text>
    </Pressable>
  );
}
