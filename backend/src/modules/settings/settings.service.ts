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
    description: string | null;
    enabled: boolean;
    key: string;
    rolloutPercentage: number | null;
  }): FeatureFlag {
    return {
      description: flag.description,
      enabled: flag.enabled,
      key: flag.key,
      rolloutPercentage: flag.rolloutPercentage,
    };
  }

  private toSetting(setting: {
    description: string | null;
    isPublic: boolean;
    key: string;
    value: Prisma.JsonValue;
  }): SystemSetting {
    return {
      description: setting.description,
      isPublic: setting.isPublic,
      key: setting.key,
      value: setting.value,
    };
  }
}
