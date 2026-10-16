import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { SettingsService } from '../settings/settings.service';

import { DEFAULT_PILGRIM_LAYOUT, PILGRIM_LAYOUT_SETTING_KEY } from './app-config.defaults';
import type { PilgrimAppConfig, PilgrimAppLayout } from './app-config.types';
import { validatePilgrimLayout } from './app-config.validation';

@Injectable()
export class AppConfigService {
  public constructor(private readonly settingsService: SettingsService) {}

  public async getPilgrimConfig(): Promise<{ body: PilgrimAppConfig; etag: string }> {
    const [settings, flags] = await Promise.all([
      this.settingsService.listPublicSettings(),
      this.settingsService.listPublicFeatureFlags(),
    ]);

    const layoutSetting = settings.find((setting) => setting.key === PILGRIM_LAYOUT_SETTING_KEY);
    const body: PilgrimAppConfig = {
      flags: Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])),
      layout: this.readLayout(layoutSetting?.value),
      settings: Object.fromEntries(
        settings
          .filter((setting) => setting.key !== PILGRIM_LAYOUT_SETTING_KEY)
          .map((setting) => [setting.key, setting.value]),
      ),
    };
    const etag = `"${createHash('sha256').update(JSON.stringify(body)).digest('base64url').slice(0, 22)}"`;

    return { body, etag };
  }

  public async getLayoutForAdmin(): Promise<PilgrimAppLayout> {
    const settings = await this.settingsService.listSettings();

    return this.readLayout(
      settings.find((setting) => setting.key === PILGRIM_LAYOUT_SETTING_KEY)?.value,
    );
  }

  public async updateLayout(raw: unknown, actorUserId: string): Promise<PilgrimAppLayout> {
    const layout = validatePilgrimLayout(raw);
    await this.settingsService.updateSetting(
      PILGRIM_LAYOUT_SETTING_KEY,
      {
        description: 'Pilgrim app screen layout and theme',
        isPublic: true,
        value: layout,
      },
      actorUserId,
    );

    return layout;
  }

  private readLayout(value: unknown): PilgrimAppLayout {
    if (value === undefined || value === null) {
      return DEFAULT_PILGRIM_LAYOUT;
    }
    try {
      return validatePilgrimLayout(value);
    } catch {
      // A bad stored layout must never break the app; fall back to the safe default.
      return DEFAULT_PILGRIM_LAYOUT;
    }
  }
}
