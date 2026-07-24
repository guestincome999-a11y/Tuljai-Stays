import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';

import { useAuth } from '../../src/auth/auth-context';
import { usePilgrimApp } from '../../src/pilgrim-ui/PilgrimAppProvider';
import { PilgrimTabBar } from '../../src/pilgrim-ui/PilgrimTabBar';

export default function AppLayout() {
  const { bootstrapComplete, isAuthenticated } = useAuth();
  const { t } = usePilgrimApp();

  if (bootstrapComplete && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <PilgrimTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarAccessibilityLabel: 'Home',
          title: t('Home', 'मुख्य'),
        }}
      />
      <Tabs.Screen
        name="lodges"
        options={{
          tabBarAccessibilityLabel: 'Find lodges',
          title: t('Explore', 'निवास'),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarAccessibilityLabel: 'My bookings',
          title: t('Bookings', 'बुकिंग'),
        }}
      />
      <Tabs.Screen name="announcements" options={{ href: null, title: 'Announcements' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="pass" options={{ href: null, title: t('Pass', 'पास') }} />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarAccessibilityLabel: 'Profile and support',
          title: t('Profile', 'प्रोफाइल'),
        }}
      />
    </Tabs>
  );
}
