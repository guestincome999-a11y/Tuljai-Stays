import { randomUUID } from 'node:crypto';

import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FeatureFlag, PromotionalBanner, SystemSetting } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/providers/supabase-storage.service';

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
  {
    description: 'Sliding promotional banners shown in the pilgrim app',
    isPublic: true,
    key: 'promotional_banners',
    value: [],
  },
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

const SETTINGS_CACHE_TTL_MS = 30_000;

interface CacheEntry<TValue> {
  expiresAt: number;
  value: TValue;
}

@Injectable()
export class SettingsService {
  private allFeatureFlagsCache: CacheEntry<FeatureFlag[]> | null = null;
  private allSettingsCache: CacheEntry<SystemSetting[]> | null = null;
  private defaultsEnsured = false;
  private defaultsPromise: Promise<void> | null = null;
  private publicFeatureFlagsCache: CacheEntry<FeatureFlag[]> | null = null;
  private publicSettingsCache: CacheEntry<SystemSetting[]> | null = null;

  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  public async uploadPromotionalBannerImage(
    file: MultipartFile,
    actorUserId: string,
  ): Promise<{ imageUrl: string }> {
    const contents = await file.toBuffer();
    if (contents.length === 0) {
      throw new BadRequestException('The selected banner image is empty');
    }
    if (contents.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Banner images must be 5 MB or smaller');
    }

    const detectedImage = this.detectPromotionalBannerImage(contents);
    if (!detectedImage) {
      throw new BadRequestException('Upload a JPEG, PNG, or WebP banner image');
    }

    const storagePath = `promotional-banners/${randomUUID()}.${detectedImage.extension}`;
    const imageUrl = await this.storageService.uploadPublicObject(
      storagePath,
      contents,
      detectedImage.mimeType,
      this.storageService.getLodgePhotosBucketName(),
    );
    await this.auditLogService.create({
      action: 'PROMOTIONAL_BANNER_IMAGE_UPLOADED',
      actorUserId,
      entityType: 'promotional_banner_image',
      metadata: { mimeType: detectedImage.mimeType, sizeBytes: contents.length, storagePath },
    });

    return { imageUrl };
  }

  public async listSettings(): Promise<SystemSetting[]> {
    const cached = this.readCache(this.allSettingsCache);

    if (cached) {
      return cached;
    }

    await this.ensureDefaults();
    const settings = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });

    const mapped = settings.map((setting) => this.toSetting(setting));
    this.allSettingsCache = this.writeCache(mapped);

    return mapped;
  }

  public async listPublicSettings(): Promise<SystemSetting[]> {
    const cached = this.readCache(this.publicSettingsCache);

    if (cached) {
      return cached;
    }

    await this.ensureDefaults();
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
      where: { isPublic: true },
    });

    const mapped = settings.map((setting) => this.toSetting(setting));
    this.publicSettingsCache = this.writeCache(mapped);

    return mapped;
  }

  public async updateSetting(
    key: string,
    dto: UpdateSystemSettingDto,
    actorUserId: string,
  ): Promise<SystemSetting> {
    if (key === 'promotional_banners') {
      await this.validatePromotionalBanners(dto.value);
    }

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
    this.invalidateSettingsCache();

    return this.toSetting(setting);
  }

  public async listFeatureFlags(): Promise<FeatureFlag[]> {
    const cached = this.readCache(this.allFeatureFlagsCache);

    if (cached) {
      return cached;
    }

    await this.ensureDefaults();
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });

    const mapped = flags.map((flag) => this.toFeatureFlag(flag));
    this.allFeatureFlagsCache = this.writeCache(mapped);

    return mapped;
  }

  public async listPublicFeatureFlags(): Promise<FeatureFlag[]> {
    const cached = this.readCache(this.publicFeatureFlagsCache);

    if (cached) {
      return cached;
    }

    await this.ensureDefaults();
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });

    const mapped = flags.map((flag) => this.toFeatureFlag(flag));
    this.publicFeatureFlagsCache = this.writeCache(mapped);

    return mapped;
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
    this.invalidateFeatureFlagsCache();

    return this.toFeatureFlag(flag);
  }

  private async ensureDefaults(): Promise<void> {
    if (this.defaultsEnsured) {
      return;
    }

    if (this.defaultsPromise) {
      return this.defaultsPromise;
    }

    this.defaultsPromise = this.ensureDefaultsUncached().finally(() => {
      this.defaultsPromise = null;
    });
    await this.defaultsPromise;
    this.defaultsEnsured = true;
  }

  private async validatePromotionalBanners(value: unknown): Promise<void> {
    if (!Array.isArray(value) || value.length > 20) {
      throw new BadRequestException('Promotional banners must be an array with at most 20 items');
    }

    const banners = value as Array<Partial<PromotionalBanner>>;
    const ids = new Set<string>();
    const lodgeSlugs: string[] = [];

    for (const banner of banners) {
      if (!banner.id || ids.has(banner.id)) {
        throw new BadRequestException('Every promotional banner requires a unique ID');
      }
      ids.add(banner.id);

      if (!['FESTIVAL', 'ANNOUNCEMENT', 'LODGE_PROMOTION'].includes(banner.category ?? '')) {
        throw new BadRequestException('Select a valid promotional banner category');
      }
      if (!banner.title?.trim() || banner.title.length > 120) {
        throw new BadRequestException('Every promotional banner requires a title');
      }
      if (banner.subtitle && banner.subtitle.length > 240) {
        throw new BadRequestException('Promotional banner subtitles cannot exceed 240 characters');
      }
      if (!banner.imageUrl || !/^https:\/\//iu.test(banner.imageUrl)) {
        throw new BadRequestException('Banner images must use a secure HTTPS URL');
      }
      if (banner.linkUrl && !/^https:\/\//iu.test(banner.linkUrl)) {
        throw new BadRequestException('Banner links must use a secure HTTPS URL');
      }
      if (typeof banner.isActive !== 'boolean' || !Number.isInteger(banner.sortOrder)) {
        throw new BadRequestException('Promotional banner status and order are required');
      }

      const startsAt = banner.startsAt ? new Date(banner.startsAt) : null;
      const expiresAt = banner.expiresAt ? new Date(banner.expiresAt) : null;
      if (
        (startsAt && Number.isNaN(startsAt.getTime())) ||
        (expiresAt && Number.isNaN(expiresAt.getTime())) ||
        (startsAt && expiresAt && startsAt >= expiresAt)
      ) {
        throw new BadRequestException('Promotional banner dates must form a valid schedule');
      }

      if (banner.category === 'LODGE_PROMOTION') {
        if (!banner.lodgeSlug?.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(banner.lodgeSlug)) {
          throw new BadRequestException('Lodge promotions require a lodge URL slug');
        }
        lodgeSlugs.push(banner.lodgeSlug.trim().toLowerCase());
      }
    }

    if (lodgeSlugs.length === 0) {
      return;
    }

    const lodges = await this.prisma.lodge.findMany({
      select: { slug: true },
      where: {
        deletedAt: null,
        isActive: true,
        slug: { in: lodgeSlugs },
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
      },
    });
    const counts = lodges.reduce<Map<string, number>>((result, lodge) => {
      const slug = lodge.slug.toLowerCase();
      result.set(slug, (result.get(slug) ?? 0) + 1);
      return result;
    }, new Map());

    for (const slug of lodgeSlugs) {
      if (counts.get(slug) !== 1) {
        throw new BadRequestException(
          `Lodge slug "${slug}" must match one unique, live lodge before it can be promoted`,
        );
      }
    }
  }

  private detectPromotionalBannerImage(contents: Buffer): {
    extension: 'jpg' | 'png' | 'webp';
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  } | null {
    if (
      contents.length >= 3 &&
      contents[0] === 0xff &&
      contents[1] === 0xd8 &&
      contents[2] === 0xff
    ) {
      return { extension: 'jpg', mimeType: 'image/jpeg' };
    }
    if (
      contents.length >= 8 &&
      contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return { extension: 'png', mimeType: 'image/png' };
    }
    if (
      contents.length >= 12 &&
      contents.subarray(0, 4).toString('ascii') === 'RIFF' &&
      contents.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { extension: 'webp', mimeType: 'image/webp' };
    }

    return null;
  }

  private async ensureDefaultsUncached(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.systemSetting.createMany({
        data: DEFAULT_SETTINGS.map((setting) => ({
          description: setting.description,
          isPublic: setting.isPublic,
          key: setting.key,
          value:
            setting.value === null ? Prisma.JsonNull : (setting.value as Prisma.InputJsonValue),
        })),
        skipDuplicates: true,
      }),
      this.prisma.featureFlag.createMany({
        data: DEFAULT_FLAGS,
        skipDuplicates: true,
      }),
    ]);
  }

  private invalidateFeatureFlagsCache(): void {
    this.allFeatureFlagsCache = null;
    this.publicFeatureFlagsCache = null;
  }

  private invalidateSettingsCache(): void {
    this.allSettingsCache = null;
    this.publicSettingsCache = null;
  }

  private readCache<TValue>(entry: CacheEntry<TValue> | null): TValue | null {
    if (!entry || entry.expiresAt <= Date.now()) {
      return null;
    }

    return entry.value;
  }

  private writeCache<TValue>(value: TValue): CacheEntry<TValue> {
    return {
      expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
      value,
    };
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
