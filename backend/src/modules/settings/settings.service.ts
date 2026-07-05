import { Injectable } from '@nestjs/common';
import type { FeatureFlag, SystemSetting } from '@tuljai/types';

import { Prisma } from '../../../generated/prisma';
import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import type { UpdateFeatureFlagDto, UpdateSystemSettingDto } from './dto/settings.dto';

const DEFAULT_SETTINGS: SystemSetting[] = [
  {
    description: 'Booking lock duration',
    isPublic: false,
    key: 'booking_lock_duration_seconds',
    value: 300,
  },
  {
    description: 'Owner response timeout',
    isPublic: false,
    key: 'owner_response_timeout_seconds',
    value: 120,
  },
  {
    description: 'QR token TTL',
    isPublic: false,
    key: 'booking_qr_token_ttl_seconds',
    value: 86400,
  },
  {
    description: 'Default commission amount',
    isPublic: false,
    key: 'default_commission_amount',
    value: null,
  },
  {
    description: 'Show owner phone after accepted',
    isPublic: false,
    key: 'show_owner_phone_after_accepted',
    value: false,
  },
  {
    description: 'WhatsApp notifications enabled',
    isPublic: true,
    key: 'enable_whatsapp_notifications',
    value: false,
  },
  {
    description: 'Online payments enabled',
    isPublic: true,
    key: 'enable_online_payments',
    value: false,
  },
  { description: 'Multi-city enabled', isPublic: true, key: 'enable_multi_city', value: false },
  { description: 'Enabled city slug', isPublic: true, key: 'enabled_city_slug', value: 'tuljapur' },
  { description: 'Support phone', isPublic: true, key: 'support_phone', value: '+910000000000' },
  {
    description: 'Support email',
    isPublic: true,
    key: 'support_email',
    value: 'support@tuljaistays.com',
  },
  { description: 'Privacy policy URL', isPublic: true, key: 'privacy_policy_url', value: '' },
  { description: 'Terms URL', isPublic: true, key: 'terms_url', value: '' },
  {
    description: 'Minimum supported app version',
    isPublic: true,
    key: 'minimum_app_version',
    value: '1.0.0',
  },
  {
    description: 'Force app update enabled',
    isPublic: true,
    key: 'force_update_enabled',
    value: false,
  },
  {
    description: 'App maintenance message',
    isPublic: true,
    key: 'app_maintenance_message',
    value: '',
  },
  {
    description: 'App welcome message',
    isPublic: true,
    key: 'app_welcome_message',
    value: 'Welcome to Tuljai Stays',
  },
  { description: 'Festival banner text', isPublic: true, key: 'festival_banner_text', value: '' },
  { description: 'Emergency banner text', isPublic: true, key: 'emergency_banner_text', value: '' },
  { description: 'Force update message', isPublic: true, key: 'force_update_message', value: '' },
  { description: 'Help text', isPublic: true, key: 'help_text', value: '' },
  { description: 'QR instruction text', isPublic: true, key: 'qr_instruction_text', value: '' },
  {
    description: 'Booking instruction text',
    isPublic: true,
    key: 'booking_instruction_text',
    value: '',
  },
  {
    description: 'Festival announcement text',
    isPublic: true,
    key: 'festival_announcement',
    value: '',
  },
  {
    description: 'Temple advisory message',
    isPublic: true,
    key: 'temple_advisory_message',
    value: '',
  },
  { description: 'Crowd warning message', isPublic: true, key: 'crowd_warning_message', value: '' },
  {
    description: 'Festival emergency contact text',
    isPublic: true,
    key: 'festival_emergency_contact_text',
    value: '',
  },
  {
    description: 'Festival support instructions',
    isPublic: true,
    key: 'festival_support_instructions',
    value: '',
  },
  { description: 'Festival start date', isPublic: true, key: 'festival_start_date', value: '' },
  { description: 'Festival end date', isPublic: true, key: 'festival_end_date', value: '' },
  { description: 'Festival UI color', isPublic: true, key: 'festival_ui_color', value: '#245b4f' },
  { description: 'Booking pause reason', isPublic: true, key: 'booking_pause_reason', value: '' },
  {
    description: 'Pilgrim app maintenance message',
    isPublic: true,
    key: 'pilgrim_app_maintenance_message',
    value: '',
  },
  {
    description: 'Owner app maintenance message',
    isPublic: true,
    key: 'owner_app_maintenance_message',
    value: '',
  },
  {
    description: 'Admin panel maintenance message',
    isPublic: false,
    key: 'admin_panel_maintenance_message',
    value: '',
  },
  {
    description: 'Backend maintenance notice',
    isPublic: true,
    key: 'backend_maintenance_notice',
    value: '',
  },
];

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    description: 'WhatsApp delivery integration',
    enabled: false,
    key: 'whatsapp_notifications',
    rolloutPercentage: null,
  },
  {
    description: 'Online payment collection',
    enabled: false,
    key: 'online_payments',
    rolloutPercentage: null,
  },
  {
    description: 'Festival mode pricing and alerts',
    enabled: false,
    key: 'festival_mode',
    rolloutPercentage: null,
  },
  {
    description: 'Owner fullscreen alerts',
    enabled: true,
    key: 'owner_fullscreen_alerts',
    rolloutPercentage: null,
  },
  {
    description: 'Register exports',
    enabled: true,
    key: 'register_exports',
    rolloutPercentage: null,
  },
  {
    description: 'Multi-city expansion',
    enabled: false,
    key: 'multi_city',
    rolloutPercentage: null,
  },
  {
    description: 'Advanced analytics',
    enabled: false,
    key: 'advanced_analytics',
    rolloutPercentage: null,
  },
  {
    description: 'Reviews and review prompts',
    enabled: true,
    key: 'reviews_enabled',
    rolloutPercentage: null,
  },
  {
    description: 'QR check-in workflow',
    enabled: true,
    key: 'qr_checkin_enabled',
    rolloutPercentage: null,
  },
  {
    description: 'New booking creation',
    enabled: true,
    key: 'booking_enabled',
    rolloutPercentage: null,
  },
  {
    description: 'Pilgrim app availability',
    enabled: true,
    key: 'pilgrim_app_enabled',
    rolloutPercentage: null,
  },
  {
    description: 'Owner app availability',
    enabled: true,
    key: 'owner_app_enabled',
    rolloutPercentage: null,
  },
  {
    description: 'Admin panel availability',
    enabled: true,
    key: 'admin_panel_enabled',
    rolloutPercentage: null,
  },
  {
    description: 'Emergency platform mode',
    enabled: false,
    key: 'emergency_mode',
    rolloutPercentage: null,
  },
  {
    description: 'Maintenance mode notice',
    enabled: false,
    key: 'maintenance_mode',
    rolloutPercentage: null,
  },
];

@Injectable()
export class SettingsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  public async listSettings(): Promise<SystemSetting[]> {
    await this.ensureDefaults();
    const settings = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });

    return settings.map((setting) => this.toSetting(setting));
  }

  public async listPublicSettings(): Promise<SystemSetting[]> {
    await this.ensureDefaults();
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
      where: { isPublic: true },
    });

    return settings.map((setting) => this.toSetting(setting));
  }

  public async updateSetting(
    key: string,
    dto: UpdateSystemSettingDto,
    actorUserId: string,
  ): Promise<SystemSetting> {
    const setting = await this.prisma.systemSetting.upsert({
      create: {
        description: dto.description,
        isPublic: dto.isPublic ?? false,
        key,
        value: dto.value as Prisma.InputJsonValue,
      },
      update: {
        description: dto.description,
        isPublic: dto.isPublic,
        value: dto.value as Prisma.InputJsonValue,
      },
      where: { key },
    });
    await this.auditLogService.create({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUserId,
      entityId: setting.id,
      entityType: 'system_setting',
      metadata: { key },
    });

    return this.toSetting(setting);
  }

  public async listFeatureFlags(): Promise<FeatureFlag[]> {
    await this.ensureDefaults();
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });

    return flags.map((flag) => this.toFeatureFlag(flag));
  }

  public async listPublicFeatureFlags(): Promise<FeatureFlag[]> {
    await this.ensureDefaults();
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });

    return flags.map((flag) => this.toFeatureFlag(flag));
  }

  public async updateFeatureFlag(
    key: string,
    dto: UpdateFeatureFlagDto,
    actorUserId: string,
  ): Promise<FeatureFlag> {
    const flag = await this.prisma.featureFlag.upsert({
      create: {
        description: dto.description,
        enabled: dto.enabled,
        key,
        rolloutPercentage: dto.rolloutPercentage,
      },
      update: {
        description: dto.description,
        enabled: dto.enabled,
        rolloutPercentage: dto.rolloutPercentage,
      },
      where: { key },
    });
    await this.auditLogService.create({
      action: 'FEATURE_FLAG_UPDATED',
      actorUserId,
      entityId: flag.id,
      entityType: 'feature_flag',
      metadata: { enabled: flag.enabled, key },
    });

    return this.toFeatureFlag(flag);
  }

  private async ensureDefaults(): Promise<void> {
    for (const setting of DEFAULT_SETTINGS) {
      await this.prisma.systemSetting.upsert({
        create: {
          description: setting.description,
          isPublic: setting.isPublic,
          key: setting.key,
          value: setting.value as Prisma.InputJsonValue,
        },
        update: {},
        where: { key: setting.key },
      });
    }

    for (const flag of DEFAULT_FLAGS) {
      await this.prisma.featureFlag.upsert({
        create: flag,
        update: {},
        where: { key: flag.key },
      });
    }
  }

  private toFeatureFlag(flag: {
    createdAt?: Date;
    description: string | null;
    enabled: boolean;
    key: string;
    rolloutPercentage: number | null;
    updatedAt?: Date;
  }): FeatureFlag {
    return {
      createdAt: flag.createdAt?.toISOString(),
      description: flag.description,
      enabled: flag.enabled,
      key: flag.key,
      rolloutPercentage: flag.rolloutPercentage,
      updatedAt: flag.updatedAt?.toISOString(),
    };
  }

  private toSetting(setting: {
    createdAt?: Date;
    description: string | null;
    isPublic: boolean;
    key: string;
    updatedAt?: Date;
    value: Prisma.JsonValue;
  }): SystemSetting {
    return {
      createdAt: setting.createdAt?.toISOString(),
      description: setting.description,
      isPublic: setting.isPublic,
      key: setting.key,
      updatedAt: setting.updatedAt?.toISOString(),
      value: setting.value,
    };
  }
}
