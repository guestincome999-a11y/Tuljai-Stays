import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from '../api/client';
import { getDevicePlatform, getOrCreateDeviceId } from '../device/device-identity';

export const ACCEPT_BOOKING_ACTION = 'ACCEPT_BOOKING';
export const BOOKING_REQUEST_CATEGORY = 'BOOKING_REQUEST';
export const BOOKING_REQUEST_CHANNEL = 'booking-requests-v2';
export const REJECT_BOOKING_ACTION = 'REJECT_BOOKING';

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

  await apiClient.post('/auth/device-token', {
    appType: 'OWNER_APP',
    deviceId: await getOrCreateDeviceId(),
    fcmToken: token.data,
    platform: getDevicePlatform(),
  });

  return true;
}

async function configureOwnerNotificationActions(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(BOOKING_REQUEST_CHANNEL, {
      enableVibrate: true,
      importance: Notifications.AndroidImportance.MAX,
      name: 'New booking requests',
      sound: 'default',
      vibrationPattern: [0, 900, 450, 900, 450, 900, 450, 900],
    });
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
