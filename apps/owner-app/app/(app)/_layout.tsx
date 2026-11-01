import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/auth-context';
import { IncomingBookingAlertHost } from '../../src/features/bookings/components/IncomingBookingAlertHost';
import { useOwnerApp } from '../../src/owner-ui/OwnerAppProvider';
import { ownerColors } from '../../src/owner-ui/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type OwnerTabRoute = { name: string };
type TabBarIconProps = { color: string; size: number };

export default function AppLayout() {
  const { bootstrapComplete, hasOwnerAccess, isAuthenticated } = useAuth();
  const { tr } = useOwnerApp();
  const insets = useSafeAreaInsets();

  if (!bootstrapComplete) {
    return (
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  if (!isAuthenticated || !hasOwnerAccess) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: ownerColors.cream }}
    >
      <Tabs
        screenOptions={({ route }: { route: OwnerTabRoute }) => ({
          headerShown: false,
          sceneStyle: { backgroundColor: ownerColors.cream },
          tabBarActiveTintColor: ownerColors.primary,
          tabBarInactiveTintColor: ownerColors.muted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: ownerColors.border,
            height: 64 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <MaterialCommunityIcons color={color} name={getTabIcon(route.name)} size={size} />
          ),
        })}
      >
        <Tabs.Screen name="dashboard" options={{ title: tr('Home') }} />
        <Tabs.Screen name="bookings" options={{ title: tr('Bookings') }} />
        <Tabs.Screen name="rooms" options={{ title: tr('Rooms') }} />
        <Tabs.Screen name="profile" options={{ title: tr('More') }} />
        <Tabs.Screen name="upcoming" options={{ href: null, title: tr('Upcoming') }} />
        <Tabs.Screen name="scan" options={{ href: null, title: tr('Scan QR') }} />
        <Tabs.Screen name="lodge" options={{ href: null, title: tr('Lodge') }} />
        <Tabs.Screen name="scan-history" options={{ href: null, title: tr('Scan History') }} />
        <Tabs.Screen name="register" options={{ href: null, title: tr('Guest Register') }} />
        <Tabs.Screen
          name="previous-bookings"
          options={{ href: null, title: tr('Previous Bookings') }}
        />
        <Tabs.Screen
          name="register-dashboard"
          options={{ href: null, title: tr('Register Dashboard') }}
        />
        <Tabs.Screen name="notifications" options={{ href: null, title: tr('Notifications') }} />
        <Tabs.Screen name="announcements" options={{ href: null, title: tr('Announcements') }} />
        <Tabs.Screen name="reports" options={{ href: null, title: tr('Reports') }} />
        <Tabs.Screen name="reviews" options={{ href: null, title: tr('Guest Reviews') }} />
        <Tabs.Screen name="settings" options={{ href: null, title: tr('Settings') }} />
      </Tabs>
      <IncomingBookingAlertHost />
    </SafeAreaView>
  );
}

function getTabIcon(routeName: string): IconName {
  if (routeName === 'bookings') return 'calendar-check-outline';
  if (routeName === 'rooms') return 'bed-outline';
  if (routeName === 'upcoming') return 'calendar-clock-outline';
  if (routeName === 'scan') return 'qrcode-scan';
  if (routeName === 'lodge') return 'home-city-outline';
  if (routeName === 'profile') return 'dots-horizontal-circle-outline';
  if (routeName === 'reviews') return 'star-outline';
  return 'home-outline';
}
