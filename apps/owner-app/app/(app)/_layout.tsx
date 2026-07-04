import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useAuth } from '../../src/auth/auth-context';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function AppLayout() {
  const { bootstrapComplete, hasOwnerAccess, isAuthenticated } = useAuth();

  if (bootstrapComplete && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (bootstrapComplete && isAuthenticated && !hasOwnerAccess) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons color={color} name={getTabIcon(route.name)} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan QR' }} />
      <Tabs.Screen name="rooms" options={{ title: 'Rooms' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

function getTabIcon(routeName: string): IconName {
  if (routeName === 'bookings') {
    return 'clipboard-list-outline';
  }

  if (routeName === 'scan') {
    return 'qrcode-scan';
  }

  if (routeName === 'rooms') {
    return 'bed-outline';
  }

  if (routeName === 'profile') {
    return 'account-circle-outline';
  }

  return 'view-dashboard-outline';
}
