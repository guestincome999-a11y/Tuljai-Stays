/**
 * Backend-controlled content for the pilgrim Home screen. The admin panel
 * (App Content) saves one public setting, `pilgrim_home_content`; every field
 * is optional and falls back to the defaults below, so a missing or malformed
 * value can never break the screen.
 */
export const HOME_CONTENT_KEY = 'pilgrim_home_content';

export interface HomeContent {
  featuredCount: number;
  featuredSubtitleEn: string;
  featuredSubtitleMr: string;
  featuredTitleEn: string;
  featuredTitleMr: string;
  heroColors: [string, string, string];
  heroCtaEn: string;
  heroCtaMr: string;
  heroSubtitleEn: string;
  heroSubtitleMr: string;
  heroTitleEn: string;
  heroTitleMr: string;
  showCategories: boolean;
  showFeatured: boolean;
  showTrust: boolean;
}

export const defaultHomeContent: HomeContent = {
  featuredCount: 4,
  featuredSubtitleEn: 'Handpicked for comfort and trust',
  featuredSubtitleMr: 'आराम आणि विश्वासासाठी निवडलेले',
  featuredTitleEn: 'Loved by pilgrims',
  featuredTitleMr: 'भाविकांची आवड',
  heroColors: ['#FFA24A', '#F0561D', '#C23A1B'],
  heroCtaEn: 'Explore stays',
  heroCtaMr: 'निवास पहा',
  // Empty subtitle means "show the live starting price line".
  heroSubtitleEn: '',
  heroSubtitleMr: '',
  heroTitleEn: 'Rest well. Pray in peace.',
  heroTitleMr: 'शांत मुक्काम. निश्चिंत दर्शन.',
  showCategories: true,
  showFeatured: true,
  showTrust: true,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

export function parseHomeContent(value: unknown): HomeContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultHomeContent;
  const raw = value as Record<string, unknown>;
  const text = (key: keyof HomeContent, max: number): string => {
    const candidate = raw[key];
    const fallback = defaultHomeContent[key] as string;
    return typeof candidate === 'string' && candidate.trim().length <= max
      ? candidate.trim() || fallback
      : fallback;
  };
  // Subtitles are allowed to be empty on purpose (it switches on the live price line).
  const optionalText = (key: 'heroSubtitleEn' | 'heroSubtitleMr'): string => {
    const candidate = raw[key];
    return typeof candidate === 'string' ? candidate.trim().slice(0, 140) : '';
  };
  const flag = (key: 'showCategories' | 'showFeatured' | 'showTrust'): boolean =>
    typeof raw[key] === 'boolean' ? raw[key] : true;
  const colors = Array.isArray(raw.heroColors)
    ? raw.heroColors.filter((c): c is string => typeof c === 'string' && HEX_COLOR.test(c))
    : [];
  const count = Number(raw.featuredCount);

  return {
    featuredCount: Number.isInteger(count) && count >= 2 && count <= 8 ? count : 4,
    featuredSubtitleEn: text('featuredSubtitleEn', 80),
    featuredSubtitleMr: text('featuredSubtitleMr', 80),
    featuredTitleEn: text('featuredTitleEn', 40),
    featuredTitleMr: text('featuredTitleMr', 40),
    heroColors:
      colors.length === 3 ? [colors[0], colors[1], colors[2]] : defaultHomeContent.heroColors,
    heroCtaEn: text('heroCtaEn', 24),
    heroCtaMr: text('heroCtaMr', 24),
    heroSubtitleEn: optionalText('heroSubtitleEn'),
    heroSubtitleMr: optionalText('heroSubtitleMr'),
    heroTitleEn: text('heroTitleEn', 70),
    heroTitleMr: text('heroTitleMr', 70),
    showCategories: flag('showCategories'),
    showFeatured: flag('showFeatured'),
    showTrust: flag('showTrust'),
  };
}
