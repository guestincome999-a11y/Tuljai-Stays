import type { PromotionalBanner } from '@tuljai/types';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  isFestivalModeEnabled,
  listPublicFeatureFlags,
  listPublicSettings,
} from './public-settings-api';

interface PublicSettingsState {
  festivalModeEnabled: boolean;
  promotionalBanners: PromotionalBanner[];
  privacyPolicyUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  termsUrl: string | null;
}

const initialState: PublicSettingsState = {
  festivalModeEnabled: false,
  promotionalBanners: [],
  privacyPolicyUrl: null,
  supportEmail: null,
  supportPhone: null,
  termsUrl: null,
};

export function usePublicSettings() {
  const [state, setState] = useState<PublicSettingsState>(initialState);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [settings, flags] = await Promise.all([
        listPublicSettings().catch(() => []),
        listPublicFeatureFlags().catch(() => []),
      ]);

      if (mounted) {
        setState({
          festivalModeEnabled: isFestivalModeEnabled(settings, flags),
          promotionalBanners: readPromotionalBanners(settings),
          privacyPolicyUrl: readPublicUrl(settings, 'privacy_policy_url'),
          supportEmail: readSupportEmail(settings),
          supportPhone: readSupportPhone(settings),
          termsUrl: readPublicUrl(settings, 'terms_url'),
        });
      }
    }

    void load();
    const interval = setInterval(() => void load(), 60_000);
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void load();
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return state;
}

function readPromotionalBanners(
  settings: Awaited<ReturnType<typeof listPublicSettings>>,
): PromotionalBanner[] {
  const value = settings.find((setting) => setting.key === 'promotional_banners')?.value;
  if (!Array.isArray(value)) return [];

  const now = Date.now();
  return value
    .filter(isPromotionalBanner)
    .filter((banner) => {
      const startsAt = banner.startsAt ? new Date(banner.startsAt).getTime() : null;
      const expiresAt = banner.expiresAt ? new Date(banner.expiresAt).getTime() : null;
      return (
        banner.isActive &&
        (startsAt === null || startsAt <= now) &&
        (expiresAt === null || expiresAt > now)
      );
    })
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function isPromotionalBanner(value: unknown): value is PromotionalBanner {
  if (!value || typeof value !== 'object') return false;
  const banner = value as Partial<PromotionalBanner>;
  return (
    typeof banner.id === 'string' &&
    typeof banner.title === 'string' &&
    typeof banner.imageUrl === 'string' &&
    /^https:\/\//iu.test(banner.imageUrl) &&
    typeof banner.isActive === 'boolean' &&
    typeof banner.sortOrder === 'number' &&
    ['FESTIVAL', 'ANNOUNCEMENT', 'LODGE_PROMOTION'].includes(banner.category ?? '')
  );
}

function readSettingValue(
  settings: Awaited<ReturnType<typeof listPublicSettings>>,
  key: string,
): string | null {
  const value = settings.find((setting) => setting.key === key)?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readPublicUrl(
  settings: Awaited<ReturnType<typeof listPublicSettings>>,
  key: string,
): string | null {
  const value = readSettingValue(settings, key);
  return value && /^https:\/\//iu.test(value) ? value : null;
}

function readSupportEmail(settings: Awaited<ReturnType<typeof listPublicSettings>>): string | null {
  const value = readSettingValue(settings, 'support_email');
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) ? value : null;
}

function readSupportPhone(settings: Awaited<ReturnType<typeof listPublicSettings>>): string | null {
  const value = readSettingValue(settings, 'support_phone');
  if (!value) return null;

  const digits = value.replace(/\D/gu, '');
  const nationalDigits = digits.startsWith('91') ? digits.slice(2) : digits;
  const isPlaceholder = /^0+$/u.test(nationalDigits) || /^(\d)\1{9}$/u.test(nationalDigits);
  return /^[6-9]\d{9}$/u.test(nationalDigits) && !isPlaceholder ? `+91${nationalDigits}` : null;
}
