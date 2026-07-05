import type {
  AdminBookingSummary,
  Announcement,
  FeatureFlag,
  NotificationMetrics,
  PresenceSummary,
  QrScanLogEntry,
  SystemSetting,
} from '@tuljai/types';

import type { HealthResponse } from '../api/admin-monitoring-api';

export type HealthStatus = 'Healthy' | 'Warning' | 'Critical' | 'Offline';
export type Severity = 'Critical' | 'Warning' | 'Info';

export interface HealthServiceCard {
  detail: string;
  lastChecked: string;
  name: string;
  responseTimeMs?: number;
  status: HealthStatus;
  uptime: string;
}

export interface ApiDiagnosticRow {
  availability: HealthStatus;
  endpoint: string;
  errorRate: string;
  lastFailure: string;
  p95Response: string;
  responseTime: string;
  successRate: string;
}

export interface MonitoringAlert {
  message: string;
  severity: Severity;
  title: string;
}

export const monitoredApiRows: ApiDiagnosticRow[] = [
  buildFoundationApiRow('Authentication', '/api/auth/*'),
  buildFoundationApiRow('Bookings', '/api/admin/bookings'),
  buildFoundationApiRow('Lodges', '/api/lodges'),
  buildFoundationApiRow('Owners', '/api/admin/lodges/:id/owners'),
  buildFoundationApiRow('Rooms', '/api/owner/lodges/:id/rooms'),
  buildFoundationApiRow('QR', '/api/qr/scan'),
  buildFoundationApiRow('Notifications', '/api/admin/notifications/metrics'),
  buildFoundationApiRow('Announcements', '/api/announcements'),
  buildFoundationApiRow('Settings', '/api/admin/settings'),
  buildFoundationApiRow('Reports', '/api/admin/reports/*'),
];

export function buildHealthServices(
  health: HealthResponse | null,
  presence: PresenceSummary | null,
  notificationMetrics: NotificationMetrics | null,
  settings: SystemSetting[],
  flags: FeatureFlag[],
  checkedAt: string,
): HealthServiceCard[] {
  const maintenanceMode = flags.find((flag) => flag.key === 'maintenance_mode')?.enabled;
  const qrEnabled = flags.find((flag) => flag.key === 'qr_checkin_enabled')?.enabled;
  const bookingEnabled = flags.find((flag) => flag.key === 'booking_enabled')?.enabled;
  const appMaintenanceMessage = settings.find(
    (setting) => setting.key === 'app_maintenance_message',
  );

  return [
    {
      detail:
        health?.status === 'ok'
          ? 'API health endpoint is responding.'
          : 'Health endpoint is degraded.',
      lastChecked: health?.timestamp ?? checkedAt,
      name: 'Platform Status',
      status: health?.status === 'ok' ? 'Healthy' : 'Warning',
      uptime: 'Runtime uptime endpoint required',
    },
    {
      detail: health
        ? 'Backend application responded to health check.'
        : 'Health check unavailable.',
      lastChecked: health?.timestamp ?? checkedAt,
      name: 'Backend Status',
      status: health ? 'Healthy' : 'Offline',
      uptime: 'Process uptime endpoint required',
    },
    {
      detail:
        health?.database === 'ok'
          ? 'Database SELECT 1 succeeded.'
          : 'Database health check failed.',
      lastChecked: health?.timestamp ?? checkedAt,
      name: 'Database Status',
      status: health?.database === 'ok' ? 'Healthy' : 'Critical',
      uptime: 'Connection pool metrics required',
    },
    {
      detail: presence
        ? `${presence.totalOnline} active realtime connections.`
        : 'Presence API unavailable.',
      lastChecked: checkedAt,
      name: 'Realtime Status',
      status: presence ? 'Healthy' : 'Warning',
      uptime: 'Socket uptime endpoint required',
    },
    {
      detail: health?.storageConfigured
        ? 'Supabase storage client configured.'
        : 'Storage client not configured.',
      lastChecked: health?.timestamp ?? checkedAt,
      name: 'Storage Status',
      status: health?.storageConfigured ? 'Healthy' : 'Warning',
      uptime: 'Storage usage endpoint required',
    },
    {
      detail: notificationMetrics
        ? `${notificationMetrics.failedCount} failed notifications recorded.`
        : 'Notification metrics unavailable.',
      lastChecked: checkedAt,
      name: 'Notification Service',
      status: getNotificationHealth(notificationMetrics),
      uptime: 'Provider queue metrics required',
    },
    {
      detail: qrEnabled === false ? 'QR check-in flag is disabled.' : 'QR feature flag is enabled.',
      lastChecked: checkedAt,
      name: 'QR Service',
      status: qrEnabled === false ? 'Warning' : 'Healthy',
      uptime: 'QR validation metrics required',
    },
    {
      detail: 'Background job instrumentation is not exposed yet.',
      lastChecked: checkedAt,
      name: 'Background Jobs',
      status: 'Warning',
      uptime: 'Worker status endpoint required',
    },
    {
      detail: 'Cache/Redis metrics depend on deployment instrumentation.',
      lastChecked: checkedAt,
      name: 'Cache Status',
      status: 'Warning',
      uptime: 'Redis endpoint required',
    },
    {
      detail:
        bookingEnabled === false || maintenanceMode
          ? 'Traffic controls are active.'
          : 'No global traffic pause detected.',
      lastChecked: checkedAt,
      name: 'API Gateway',
      status:
        bookingEnabled === false || maintenanceMode || appMaintenanceMessage?.value
          ? 'Warning'
          : 'Healthy',
      uptime: 'Gateway metrics endpoint required',
    },
  ];
}

export function summarizeQrScans(logs: QrScanLogEntry[]) {
  const total = logs.length;
  const success = logs.filter((log) => log.result === 'SUCCESS').length;
  const failed = total - success;

  return {
    duplicate: countFailure(logs, 'duplicate'),
    expired: countFailure(logs, 'expired'),
    failed,
    invalid: countFailure(logs, 'invalid'),
    success,
    successRate: total > 0 ? Math.round((success / total) * 100) : 0,
    total,
    wrongLodge: countFailure(logs, 'lodge'),
  };
}

export function buildMonitoringAlerts(
  health: HealthResponse | null,
  notificationMetrics: NotificationMetrics | null,
  qrLogs: QrScanLogEntry[],
  flags: FeatureFlag[],
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const qrSummary = summarizeQrScans(qrLogs);

  if (!health || health.status !== 'ok') {
    alerts.push({
      message: 'Backend health is degraded or unavailable.',
      severity: 'Critical',
      title: 'Backend Health',
    });
  }

  if (health?.database === 'error') {
    alerts.push({
      message: 'Database health check is failing.',
      severity: 'Critical',
      title: 'Database Health',
    });
  }

  if (notificationMetrics && notificationMetrics.failureRate > 10) {
    alerts.push({
      message: `${notificationMetrics.failureRate}% notification failure rate.`,
      severity: 'Warning',
      title: 'Notification Delivery',
    });
  }

  if (qrSummary.total >= 10 && qrSummary.successRate < 80) {
    alerts.push({
      message: `QR success rate is ${qrSummary.successRate}%.`,
      severity: 'Warning',
      title: 'QR Validation',
    });
  }

  if (flags.find((flag) => flag.key === 'booking_enabled')?.enabled === false) {
    alerts.push({
      message: 'Global booking creation is paused.',
      severity: 'Info',
      title: 'Booking Pause',
    });
  }

  return alerts;
}

export function maskIpAddress(ipAddress: string): string {
  const parts = ipAddress.split('.');

  if (parts.length !== 4) {
    return 'Masked';
  }

  return `${parts[0]}.${parts[1]}.x.x`;
}

export function formatMonitoringLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function getNotificationHealth(metrics: NotificationMetrics | null): HealthStatus {
  if (!metrics) {
    return 'Warning';
  }

  if (metrics.failureRate >= 25) {
    return 'Critical';
  }

  if (metrics.failureRate >= 10 || metrics.invalidDeviceTokens > 0) {
    return 'Warning';
  }

  return 'Healthy';
}

function buildFoundationApiRow(name: string, endpoint: string): ApiDiagnosticRow {
  return {
    availability: 'Warning',
    endpoint: `${name} - ${endpoint}`,
    errorRate: 'Diagnostics endpoint required',
    lastFailure: 'Not exposed',
    p95Response: 'Not exposed',
    responseTime: 'Not exposed',
    successRate: 'Not exposed',
  };
}

function countFailure(logs: QrScanLogEntry[], needle: string): number {
  return logs.filter((log) => log.failureReason?.toLowerCase().includes(needle)).length;
}

export function summarizeRecentSecuritySignals(
  bookings: AdminBookingSummary[],
  announcements: Announcement[],
  flags: FeatureFlag[],
) {
  return {
    adminAnnouncements: announcements.filter(
      (announcement) => announcement.targetAudience === 'ADMINS',
    ).length,
    criticalFlags: flags.filter(
      (flag) =>
        ['emergency_mode', 'maintenance_mode', 'admin_panel_enabled'].includes(flag.key) &&
        flag.enabled,
    ).length,
    manualBookingAttention: bookings.filter((booking) =>
      ['PENDING_OWNER_APPROVAL', 'ACCEPTED', 'REJECTED'].includes(booking.status),
    ).length,
  };
}
