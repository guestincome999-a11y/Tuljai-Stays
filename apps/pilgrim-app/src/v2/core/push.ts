import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from './api';
import { deviceId } from './session';

const PUSH_PROMPTED_KEY = 'tuljai.pilgrim.pushPermissionPrompted';

// These channel IDs are what the backend sends to, so they must not change.
export const ANNOUNCEMENTS_CHANNEL = 'announcements-v1';
export const BOOKING_UPDATES_CHANNEL = 'booking-updates-v1';
export const GENERAL_CHANNEL = 'general-v1';
export const ROOM_ALERTS_CHANNEL = 'room-alerts-v1';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      priority: Notifications.AndroidNotificationPriority.HIGH,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra;
  if (isRecord(extra) && isRecord(extra['eas']) && typeof extra['eas']['projectId'] === 'string') {
    return extra['eas']['projectId'];
  }
  const easConfig: unknown = Constants.easConfig;
  if (isRecord(easConfig) && typeof easConfig['projectId'] === 'string') {
    return easConfig['projectId'];
  }
  return undefined;
}

function granted(permissions: Notifications.NotificationPermissionsStatus): boolean {
  return (
    permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function configureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(BOOKING_UPDATES_CHANNEL, {
      enableVibrate: true,
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Booking Updates',
      sound: 'default',
      vibrationPattern: [0, 350, 200, 350],
    }),
    Notifications.setNotificationChannelAsync(ROOM_ALERTS_CHANNEL, {
      enableVibrate: true,
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Room Alerts',
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500],
    }),
    Notifications.setNotificationChannelAsync(ANNOUNCEMENTS_CHANNEL, {
      enableVibrate: true,
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Announcements',
      sound: 'default',
      vibrationPattern: [0, 300],
    }),
    Notifications.setNotificationChannelAsync(GENERAL_CHANNEL, {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: 'General',
      sound: 'default',
    }),
  ]);
}

async function savePushToken(token: string): Promise<void> {
  await api.post('/auth/device-token', {
    appType: 'PILGRIM_APP',
    deviceId: await deviceId(),
    fcmToken: token,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  });
}

async function registerCurrentToken(): Promise<void> {
  const id = projectId();
  const token = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
  await savePushToken(token.data);
}

/** Asks permission (if needed) and registers this phone for booking notifications. */
export async function enablePushNotifications(): Promise<{ registered: boolean }> {
  await SecureStore.setItemAsync(PUSH_PROMPTED_KEY, 'true').catch(() => undefined);
  await configureChannels();
  const permissions = await Notifications.requestPermissionsAsync();
  if (!granted(permissions)) return { registered: false };
  try {
    await registerCurrentToken();
    return { registered: true };
  } catch {
    return { registered: false };
  }
}

/** Re-registers an already granted phone, for example after sign-in. Never prompts. */
export async function refreshPushRegistration(): Promise<boolean> {
  await configureChannels();
  const permissions = await Notifications.getPermissionsAsync();
  if (!granted(permissions)) return false;
  await registerCurrentToken();
  return true;
}

export async function syncBadge(unreadCount: number): Promise<void> {
  const count = Math.max(0, Math.floor(unreadCount));
  await Notifications.setBadgeCountAsync(count).catch(() => false);
  // Android launchers follow the notifications still in the tray, so clear them once all are read.
  if (count === 0) await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
}
