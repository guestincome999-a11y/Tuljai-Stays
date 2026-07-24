import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppScreen, EmptyState, TopBar, ui, type PilgrimIconName } from '../components';
import type { PilgrimNotification } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

const notificationIcon: Record<string, PilgrimIconName> = {
  booking: 'calendar-check-outline',
  offer: 'ticket-percent-outline',
  payment: 'credit-card-check-outline',
  temple: 'temple-hindu',
};

export function PilgrimNotificationsScreen() {
  const router = useRouter();
  const { markNotificationRead, markNotificationsRead, notifications, t } = usePilgrimApp();
  const hasUnread = notifications.some((item) => !item.read);

  async function openNotification(item: PilgrimNotification) {
    await markNotificationRead(item.id);
    if (item.bookingId) {
      router.push({ pathname: '/(app)/bookings/[id]', params: { id: item.bookingId } });
      return;
    }
    if (item.type === 'temple') {
      router.push('/(app)/announcements');
      return;
    }
    if (item.type === 'payment') {
      router.push('/(app)/bookings');
      return;
    }
    router.push('/(app)/lodges');
  }

  return (
    <AppScreen className="gap-5 pt-1">
      <TopBar
        onBack={() => router.back()}
        right={
          hasUnread ? (
            <Pressable
              className="min-h-11 justify-center"
              onPress={() => void markNotificationsRead()}
            >
              <Text className="text-sm font-extrabold text-saffron-700">
                {t('Mark all read', 'सर्व वाचले')}
              </Text>
            </Pressable>
          ) : undefined
        }
        subtitle={t('Booking and travel updates', 'बुकिंग आणि प्रवास अपडेट')}
        title={t('Notifications', 'सूचना')}
      />
      {notifications.length ? (
        <View className="overflow-hidden rounded-3xl border border-warm-100 bg-white px-4">
          {notifications.map((item, index) => (
            <Pressable
              accessibilityRole="button"
              className={`min-h-24 flex-row items-start gap-3 py-4 ${index < notifications.length - 1 ? 'border-b border-warm-100' : ''}`}
              key={item.id}
              onPress={() => void openNotification(item)}
            >
              <View
                className={`h-12 w-12 items-center justify-center rounded-2xl ${item.read ? 'bg-warm-100' : 'bg-saffron-50'}`}
              >
                <MaterialCommunityIcons
                  color={item.read ? ui.muted : ui.saffronDeep}
                  name={notificationIcon[item.type]}
                  size={24}
                />
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-start gap-2">
                  <Text className="flex-1 text-base font-extrabold text-warm-900">
                    {item.title}
                  </Text>
                  {!item.read ? (
                    <View className="mt-1 h-2.5 w-2.5 rounded-full bg-saffron-500" />
                  ) : null}
                </View>
                <Text className="mt-1 text-sm leading-5 text-warm-500">{item.body}</Text>
                <Text className="mt-2 text-xs font-semibold text-warm-500">{item.time}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          body={t(
            'Booking updates and local travel notices will appear here.',
            'बुकिंग अपडेट आणि स्थानिक प्रवास सूचना येथे दिसतील.',
          )}
          icon="bell-sleep-outline"
          title={t('All quiet for now', 'सध्या कोणतीही सूचना नाही')}
        />
      )}
      <View className="flex-row items-start gap-3 rounded-2xl bg-warm-100 p-4">
        <MaterialCommunityIcons color={ui.maroon} name="shield-check-outline" size={22} />
        <Text className="flex-1 text-sm leading-5 text-warm-600">
          {t(
            'We only send useful booking, payment and temple-town travel updates.',
            'आम्ही फक्त उपयुक्त बुकिंग, पेमेंट आणि मंदिर-शहर प्रवास अपडेट पाठवतो.',
          )}
        </Text>
      </View>
    </AppScreen>
  );
}
