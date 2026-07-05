const ADMIN_DEVICE_ID_KEY = 'tuljai.admin.deviceId';

export function getOrCreateAdminDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'admin-browser-server';
  }

  const stored = window.sessionStorage.getItem(ADMIN_DEVICE_ID_KEY);

  if (stored) {
    return stored;
  }

  const deviceId = crypto.randomUUID();
  window.sessionStorage.setItem(ADMIN_DEVICE_ID_KEY, deviceId);
  return deviceId;
}
