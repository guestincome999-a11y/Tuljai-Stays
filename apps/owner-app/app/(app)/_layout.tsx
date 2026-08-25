import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useAuth } from '../../src/auth/auth-context';
import { IncomingBookingAlertHost } from '../../src/features/bookings/components/IncomingBookingAlertHost';
import { useOwnerApp } from '../../src/owner-ui/OwnerAppProvider';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type OwnerTabRoute = { name: string };
type TabBarIconProps = { color: string; size: number };

export default function AppLayout() {
  const { bootstrapComplete, hasOwnerAccess, isAuthenticated } = useAuth();
  const { tr } = useOwnerApp();

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
    <>
      <Tabs
        screenOptions={({ route }: { route: OwnerTabRoute }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#7A1F2B',
          tabBarInactiveTintColor: '#817267',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 7 },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E8DED2',
            height: 76,
            paddingTop: 6,
          },
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <MaterialCommunityIcons color={color} name={getTabIcon(route.name)} size={size} />
          ),
        })}
      >
        <Tabs.Screen name="dashboard" options={{ title: tr('Dashboard') }} />
        <Tabs.Screen name="upcoming" options={{ title: tr('Upcoming') }} />
        <Tabs.Screen name="scan" options={{ title: tr('Scan QR') }} />
        <Tabs.Screen name="lodge" options={{ title: tr('Lodge') }} />
        <Tabs.Screen name="profile" options={{ title: tr('Profile') }} />
        <Tabs.Screen name="bookings" options={{ href: null, title: tr('Bookings') }} />
        <Tabs.Screen name="rooms" options={{ href: null, title: tr('Rooms & pricing') }} />
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
    </>
  );
}

function getTabIcon(routeName: string): IconName {
  if (routeName === 'upcoming') return 'calendar-clock-outline';
  if (routeName === 'scan') return 'qrcode-scan';
  if (routeName === 'lodge') return 'home-city-outline';
  if (routeName === 'profile') return 'account-circle-outline';
  if (routeName === 'reviews') return 'star-outline';
  return 'view-dashboard-outline';
}
