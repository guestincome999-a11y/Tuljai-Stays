import type { AdminPermission } from '../permissions/permissions';

export type SettingValueType = 'boolean' | 'date' | 'email' | 'number' | 'phone' | 'text' | 'url';

export interface SettingDefinition {
  category:
    | 'App Configuration'
    | 'Booking'
    | 'Commission'
    | 'Maintenance'
    | 'Multi-city'
    | 'Notifications'
    | 'QR'
    | 'Support';
  critical?: boolean;
  description: string;
  key: string;
  permission?: AdminPermission;
  publicDefault: boolean;
  type: SettingValueType;
}

export interface FeatureFlagDefinition {
  critical?: boolean;
  description: string;
  key: string;
}

export const settingDefinitions: SettingDefinition[] = [
  {
    category: 'Booking',
    description: 'Seconds to hold availability during booking creation.',
    key: 'booking_lock_duration_seconds',
    publicDefault: false,
    type: 'number',
  },
  {
    category: 'Booking',
    critical: true,
    description: 'Seconds owners have to respond before escalation.',
    key: 'owner_response_timeout_seconds',
    publicDefault: false,
    type: 'number',
  },
  {
    category: 'QR',
    critical: true,
    description: 'Seconds a generated booking QR remains valid.',
    key: 'booking_qr_token_ttl_seconds',
    publicDefault: false,
    type: 'number',
  },
  {
    category: 'Commission',
    critical: true,
    description: 'Default commission amount for future booking accounting.',
    key: 'default_commission_amount',
    permission: 'finance.manage',
    publicDefault: false,
    type: 'number',
  },
  {
    category: 'Booking',
    description: 'Reveal owner phone after booking acceptance.',
    key: 'show_owner_phone_after_accepted',
    publicDefault: false,
    type: 'boolean',
  },
  {
    category: 'Notifications',
    critical: true,
    description: 'Enable WhatsApp notification pathway when provider support is active.',
    key: 'enable_whatsapp_notifications',
    publicDefault: true,
    type: 'boolean',
  },
  {
    category: 'App Configuration',
    critical: true,
    description:
      'Enable online payment entry points. This is disabled until the administrator explicitly enables online collection.',
    key: 'enable_online_payments',
    publicDefault: false,
    type: 'boolean',
  },
  {
    category: 'Multi-city',
    critical: true,
    description: 'Allow more than the current Tuljapur city scope.',
    key: 'enable_multi_city',
    publicDefault: true,
    type: 'boolean',
  },
  {
    category: 'Multi-city',
    description: 'Primary city slug served by public apps.',
    key: 'enabled_city_slug',
    publicDefault: true,
    type: 'text',
  },
  {
    category: 'Support',
    description: 'Public support phone number.',
    key: 'support_phone',
    publicDefault: true,
    type: 'phone',
  },
  {
    category: 'Support',
    description: 'Public support email address.',
    key: 'support_email',
    publicDefault: true,
    type: 'email',
  },
  {
    category: 'App Configuration',
    description: 'Privacy policy URL shown in apps.',
    key: 'privacy_policy_url',
    publicDefault: true,
    type: 'url',
  },
  {
    category: 'App Configuration',
    description: 'Terms URL shown in apps.',
    key: 'terms_url',
    publicDefault: true,
    type: 'url',
  },
  {
    category: 'App Configuration',
    critical: true,
    description: 'Minimum app version allowed without warning.',
    key: 'minimum_app_version',
    publicDefault: true,
    type: 'text',
  },
  {
    category: 'App Configuration',
    critical: true,
    description: 'Force users to update below minimum app version.',
    key: 'force_update_enabled',
    publicDefault: true,
    type: 'boolean',
  },
  {
    category: 'Maintenance',
    critical: true,
    description: 'Public maintenance message shown in apps.',
    key: 'app_maintenance_message',
    publicDefault: true,
    type: 'text',
  },
];

export const remoteAppConfigKeys = [
  'app_welcome_message',
  'festival_banner_text',
  'emergency_banner_text',
  'support_phone',
  'support_email',
  'terms_url',
  'privacy_policy_url',
  'minimum_app_version',
  'force_update_message',
  'app_maintenance_message',
  'help_text',
  'qr_instruction_text',
  'booking_instruction_text',
];

export const festivalSettingKeys = [
  'festival_banner_text',
  'festival_announcement',
  'temple_advisory_message',
  'crowd_warning_message',
  'festival_emergency_contact_text',
  'festival_support_instructions',
  'festival_start_date',
  'festival_end_date',
  'festival_ui_color',
];

export const maintenanceSettingKeys = [
  'app_maintenance_message',
  'pilgrim_app_maintenance_message',
  'owner_app_maintenance_message',
  'admin_panel_maintenance_message',
  'backend_maintenance_notice',
];

export const featureFlagDefinitions: FeatureFlagDefinition[] = [
  { description: 'WhatsApp delivery integration.', key: 'whatsapp_notifications', critical: true },
  { description: 'Online payment collection.', key: 'online_payments', critical: true },
  { description: 'Festival mode pricing and alerts.', key: 'festival_mode' },
  { description: 'Owner fullscreen alerts.', key: 'owner_fullscreen_alerts' },
  { description: 'Register exports.', key: 'register_exports' },
  { description: 'Multi-city expansion.', key: 'multi_city', critical: true },
  { description: 'Advanced analytics foundation.', key: 'advanced_analytics' },
  { description: 'Reviews and review prompts.', key: 'reviews_enabled' },
  { description: 'QR check-in workflow.', key: 'qr_checkin_enabled', critical: true },
  { description: 'New booking creation.', key: 'booking_enabled', critical: true },
  { description: 'Pilgrim app availability.', key: 'pilgrim_app_enabled', critical: true },
  { description: 'Owner app availability.', key: 'owner_app_enabled', critical: true },
  { description: 'Admin panel availability.', key: 'admin_panel_enabled', critical: true },
  { description: 'Emergency platform mode.', key: 'emergency_mode', critical: true },
  { description: 'Maintenance mode notice.', key: 'maintenance_mode', critical: true },
];

export const rolloutOptions = [0, 10, 25, 50, 100];

export function formatControlLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function coerceSettingValue(value: string, type: SettingValueType): unknown {
  if (type === 'boolean') {
    return value === 'true';
  }

  if (type === 'number') {
    return Number(value);
  }

  return value;
}

export function stringifySettingValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return '';
}
