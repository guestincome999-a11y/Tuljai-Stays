import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '../../src/auth/auth-context';

export default function AppLayout() {
  const { bootstrapComplete, isAuthenticated } = useAuth();

  if (bootstrapComplete && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="lodges" options={{ title: 'Lodges' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="announcements" options={{ href: null, title: 'Announcements' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
