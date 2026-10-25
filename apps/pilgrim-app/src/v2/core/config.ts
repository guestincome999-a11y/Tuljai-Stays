import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import { DEFAULT_THEME_TOKENS } from '../design/theme';
import type { RemoteThemeTokens } from '../design/theme';

import { apiBaseUrl } from './api';

export type SectionType =
  'BANNERS' | 'HERO' | 'INFO_STRIP' | 'LODGE_RAIL' | 'NOTICE' | 'SEARCH' | 'TRUST_POINTS';

export interface LayoutSection {
  enabled: boolean;
  id: string;
  props: Record<string, unknown>;
  type: SectionType;
}

export interface PilgrimAppLayout {
  screens: { home: { sections: LayoutSection[] } };
  theme: RemoteThemeTokens;
  version: 1;
}

export interface PilgrimAppConfig {
  flags: Record<string, boolean>;
  layout: PilgrimAppLayout;
  settings: Record<string, unknown>;
}

/** Used on the very first launch, or when the network is unavailable and nothing is cached. */
export const DEFAULT_CONFIG: PilgrimAppConfig = {
  flags: {},
  layout: {
    screens: {
      home: {
        sections: [
          {
            enabled: true,
            id: 'hero',
            props: {
              ctaEn: 'Explore stays',
              ctaMr: 'निवास पहा',
              passLabelEn: 'Darshan Pass',
              passLabelMr: 'दर्शन पास',
              showBell: true,
              showPass: true,
              subtitleEn: '',
              subtitleMr: '',
              titleEn: 'Rest well. Pray in peace.',
              titleMr: 'शांत मुक्काम. निश्चिंत दर्शन.',
            },
            type: 'HERO',
          },
          { enabled: true, id: 'search', props: {}, type: 'SEARCH' },
          { enabled: true, id: 'banners', props: {}, type: 'BANNERS' },
          {
            enabled: true,
            id: 'featured-lodges',
            props: {
              limit: 8,
              subtitleEn: 'Handpicked for comfort and trust',
              subtitleMr: 'आराम आणि विश्वासासाठी निवडलेले',
              titleEn: 'Loved by pilgrims',
              titleMr: 'भाविकांची आवड',
            },
            type: 'LODGE_RAIL',
          },
          {
            enabled: true,
            id: 'trust',
            props: {
              points: [
                { titleEn: 'Verified lodges', titleMr: 'पडताळलेले निवास' },
                { titleEn: 'Instant confirmation', titleMr: 'तात्काळ पुष्टी' },
                { titleEn: 'Secure payments', titleMr: 'सुरक्षित पेमेंट' },
              ],
            },
            type: 'TRUST_POINTS',
          },
        ],
      },
    },
    theme: DEFAULT_THEME_TOKENS,
    version: 1,
  },
  settings: {},
};

export interface ConfigState {
  config: PilgrimAppConfig;
  etag: string | null;
  /** 'default' = bundled fallback, 'cached' = last saved copy, 'live' = fetched this session. */
  source: 'cached' | 'default' | 'live';
}

let state: ConfigState = { config: DEFAULT_CONFIG, etag: null, source: 'default' };
const listeners = new Set<() => void>();
const cacheFile = new File(Paths.document, 'pilgrim-config-v2.json');

function setState(next: ConfigState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isConfig(value: unknown): value is PilgrimAppConfig {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PilgrimAppConfig>;
  return (
    candidate.layout?.version === 1 &&
    Array.isArray(candidate.layout.screens?.home?.sections) &&
    typeof candidate.layout.theme === 'object'
  );
}

/** Loads the last saved copy from disk so the app opens with the latest design, even offline. */
export async function hydrateConfig(): Promise<void> {
  try {
    if (!cacheFile.exists) return;
    const stored = JSON.parse(await cacheFile.text()) as { config?: unknown; etag?: string | null };
    if (isConfig(stored.config)) {
      setState({ config: stored.config, etag: stored.etag ?? null, source: 'cached' });
    }
  } catch {
    // A damaged cache is ignored; the bundled default is used and the next fetch repairs it.
  }
}

/** Asks the server for the current design. A 304 means nothing changed and costs almost nothing. */
export async function refreshConfig(): Promise<void> {
  try {
    const response = await fetch(`${apiBaseUrl()}/app-config/pilgrim`, {
      headers: {
        Accept: 'application/json',
        ...(state.etag ? { 'If-None-Match': state.etag } : {}),
      },
    });
    if (response.status === 304) {
      if (state.source !== 'live') setState({ ...state, source: 'live' });
      return;
    }
    if (!response.ok) return;
    const body: unknown = await response.json();
    if (!isConfig(body)) return;
    const etag = response.headers.get('ETag');
    setState({ config: body, etag, source: 'live' });
    if (!cacheFile.exists) cacheFile.create();
    cacheFile.write(JSON.stringify({ config: body, etag }));
  } catch {
    // Offline or server unreachable: keep showing whatever is already loaded.
  }
}

export function useRemoteConfig(): ConfigState {
  return useSyncExternalStore(subscribe, () => state);
}
