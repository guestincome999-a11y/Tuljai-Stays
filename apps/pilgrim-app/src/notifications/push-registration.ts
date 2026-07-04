import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiClient } from '../api/client';
import { getDevicePlatform, getOrCreateDeviceId } from '../device/device-identity';

const PUSH_PERMISSION_PROMPTED_KEY = 'tuljai.pilgrim.pushPermissionPrompted';

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

  const permissions = await Notifications.requestPermissionsAsync();

  if (!permissions.granted) {
    return {
      message: 'Notifications can be enabled later from your device settings.',
      registered: false,
    };
  }

  try {
    const projectId = readExpoProjectId();
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const deviceId = await getOrCreateDeviceId();

    await apiClient.post('/auth/device-token', {
      appType: 'PILGRIM_APP',
      deviceId,
      fcmToken: token.data,
      platform: getDevicePlatform(),
    });

    return { message: 'Notifications enabled for booking updates.', registered: true };
  } catch {
    return {
      message: 'Push setup needs an Expo development build. The app will keep working normally.',
      registered: false,
    };
  }
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
