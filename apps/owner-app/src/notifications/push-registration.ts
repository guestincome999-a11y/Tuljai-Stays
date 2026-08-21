import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from '../api/client';
import { getDevicePlatform, getOrCreateDeviceId } from '../device/device-identity';

export const ACCEPT_BOOKING_ACTION = 'ACCEPT_BOOKING';
export const ANNOUNCEMENTS_CHANNEL = 'announcements-v1';
export const BOOKING_REQUEST_CATEGORY = 'BOOKING_REQUEST';
export const BOOKING_REQUEST_CHANNEL = 'booking-requests-v2';
export const BOOKING_UPDATES_CHANNEL = 'booking-updates-v1';
export const GENERAL_CHANNEL = 'general-v1';
export const REJECT_BOOKING_ACTION = 'REJECT_BOOKING';
export const ROOM_ALERTS_CHANNEL = 'room-alerts-v1';

Notifications.setNotificationHandler({
  handleNotification: (notification) => {
    const isBookingRequest = notification.request.content.data?.type === 'BOOKING_REQUEST';

    return Promise.resolve({
      priority: isBookingRequest
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  },
});

export async function registerOwnerPushNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  await configureOwnerNotificationActions();
  const existingPermissions = await Notifications.getPermissionsAsync();
  const permissions = hasNotificationPermission(existingPermissions)
    ? existingPermissions
    : await Notifications.requestPermissionsAsync();

  if (!hasNotificationPermission(permissions)) {
    return false;
  }

  const projectId = readExpoProjectId();
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  await savePushToken(token.data);

  return true;
}

export async function registerRotatedOwnerPushToken(
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

export async function syncOwnerNotificationBadge(unreadCount: number): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(unreadCount))).catch(() => false);
}

async function savePushToken(token: string): Promise<void> {
  await apiClient.post('/auth/device-token', {
    appType: 'OWNER_APP',
    deviceId: await getOrCreateDeviceId(),
    fcmToken: token,
    platform: getDevicePlatform(),
  });
}

async function configureOwnerNotificationActions(): Promise<void> {
  if (Platform.OS === 'android') {
    await Promise.all([
      Notifications.setNotificationChannelAsync(BOOKING_REQUEST_CHANNEL, {
        enableVibrate: true,
        importance: Notifications.AndroidImportance.MAX,
        name: 'Booking Requests',
        sound: 'default',
        vibrationPattern: [0, 900, 450, 900, 450, 900, 450, 900],
      }),
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

  await Notifications.setNotificationCategoryAsync(BOOKING_REQUEST_CATEGORY, [
    {
      buttonTitle: 'Accept',
      identifier: ACCEPT_BOOKING_ACTION,
      options: {
        opensAppToForeground: true,
      },
    },
    {
      buttonTitle: 'Reject',
      identifier: REJECT_BOOKING_ACTION,
      options: {
        isDestructive: true,
        opensAppToForeground: true,
      },
      textInput: {
        placeholder: 'Reason for rejection',
        submitButtonTitle: 'Reject booking',
      },
    },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
