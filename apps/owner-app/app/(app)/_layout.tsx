import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useAuth } from '../../src/auth/auth-context';
import { IncomingBookingAlertHost } from '../../src/features/bookings/components/IncomingBookingAlertHost';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type OwnerTabRoute = { name: string };
type TabBarIconProps = { color: string; size: number };

export default function AppLayout() {
  const { bootstrapComplete, hasOwnerAccess, isAuthenticated } = useAuth();

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
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="upcoming" options={{ title: 'Upcoming' }} />
        <Tabs.Screen name="scan" options={{ title: 'Scan QR' }} />
        <Tabs.Screen name="lodge" options={{ title: 'Lodge' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="bookings" options={{ href: null, title: 'Bookings' }} />
        <Tabs.Screen name="earnings" options={{ href: null, title: 'Earnings' }} />
        <Tabs.Screen name="rooms" options={{ href: null, title: 'Rooms & pricing' }} />
        <Tabs.Screen name="scan-history" options={{ href: null, title: 'Scan History' }} />
        <Tabs.Screen name="register" options={{ href: null, title: 'Guest Register' }} />
        <Tabs.Screen
          name="previous-bookings"
          options={{ href: null, title: 'Previous Bookings' }}
        />
        <Tabs.Screen
          name="register-dashboard"
          options={{ href: null, title: 'Register Dashboard' }}
        />
        <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
        <Tabs.Screen name="announcements" options={{ href: null, title: 'Announcements' }} />
        <Tabs.Screen name="reports" options={{ href: null, title: 'Reports' }} />
        <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
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
  return 'view-dashboard-outline';
}
