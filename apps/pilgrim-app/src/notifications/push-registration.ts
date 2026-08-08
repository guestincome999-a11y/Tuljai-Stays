import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiClient } from '../api/client';
import { getDevicePlatform, getOrCreateDeviceId } from '../device/device-identity';

const PUSH_PERMISSION_PROMPTED_KEY = 'tuljai.pilgrim.pushPermissionPrompted';
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

export async function wasPushPermissionPrompted(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PUSH_PERMISSION_PROMPTED_KEY)) === 'true';
}

export async function markPushPermissionPrompted(): Promise<void> {
  await SecureStore.setItemAsync(PUSH_PERMISSION_PROMPTED_KEY, 'true');
}

export async function requestAndRegisterPushToken(): Promise<{
  message: string;
  registered: boolean;
}> {
  await markPushPermissionPrompted();

  if (Platform.OS === 'web') {
    return {
      message: 'Push notifications need a mobile build for this app.',
      registered: false,
    };
  }

  await configurePilgrimNotificationChannels();
  const permissions = await Notifications.requestPermissionsAsync();

  const permissionStatus = hasNotificationPermission(permissions);

  if (!permissionStatus) {
    return {
      message: 'Notifications can be enabled later from your device settings.',
      registered: false,
    };
  }

  try {
    await registerExpoPushToken();

    return { message: 'Notifications enabled for booking updates.', registered: true };
  } catch {
    return {
      message: 'Push notification setup could not be completed. Please try again.',
      registered: false,
    };
  }
}

export async function registerExistingPilgrimPushToken(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  await configurePilgrimNotificationChannels();
  const existingPermissions = await Notifications.getPermissionsAsync();
  const permissions = hasNotificationPermission(existingPermissions)
    ? existingPermissions
    : await Notifications.requestPermissionsAsync();

  if (!hasNotificationPermission(permissions)) {
    return false;
  }

  await markPushPermissionPrompted().catch(() => undefined);
  await registerExpoPushToken();
  return true;
}

export async function registerRotatedPilgrimPushToken(
  devicePushToken: Notifications.DevicePushToken,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const projectId = readExpoProjectId();
  const token = await Notifications.getExpoPushTokenAsync({
    ...(projectId ? { projectId } : {}),
    devicePushToken,
  });
  await savePushToken(token.data);
  return true;
}

export async function syncPilgrimNotificationBadge(unreadCount: number): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(unreadCount))).catch(
    () => false,
  );
}

async function registerExpoPushToken(): Promise<void> {
  const projectId = readExpoProjectId();
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await savePushToken(token.data);
}

async function savePushToken(token: string): Promise<void> {
  await apiClient.post('/auth/device-token', {
    appType: 'PILGRIM_APP',
    deviceId: await getOrCreateDeviceId(),
    fcmToken: token,
    platform: getDevicePlatform(),
  });
}

async function configurePilgrimNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

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

function readExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra;

  if (isRecord(extra)) {
    const eas = extra.eas;

    if (isRecord(eas) && typeof eas.projectId === 'string') {
      return eas.projectId;
    }
  }

  const easConfig: unknown = Constants.easConfig;

  if (isRecord(easConfig) && typeof easConfig.projectId === 'string') {
    return easConfig.projectId;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function hasNotificationPermission(permissions: unknown): boolean {
  if (!isRecord(permissions)) {
    return false;
  }

  if (typeof permissions.granted === 'boolean') {
    return permissions.granted;
  }

  if (permissions.status === 'granted') {
    return true;
  }

  const ios = permissions.ios;

  if (isRecord(ios) && typeof ios.status === 'number') {
    return ios.status === 2 || ios.status === 3 || ios.status === 4;
  }

  return false;
}
