import type { Bilingual } from './language';

/** Shared interface wording. Anything an owner or admin can edit lives in the remote layout instead. */
export const strings = {
  allLodges: { en: 'See all', mr: 'सर्व पहा' },
  fromTemple: { en: 'from temple', mr: 'मंदिरापासून' },
  loadError: {
    en: 'Could not load stays. Pull down to try again.',
    mr: 'निवास लोड झाले नाहीत. पुन्हा प्रयत्न करण्यासाठी खाली ओढा.',
  },
  noLodges: { en: 'No stays to show right now.', mr: 'सध्या दाखवण्यासाठी निवास नाहीत.' },
  perNight: { en: '/ night', mr: '/ रात्र' },
  searchHint: { en: 'Search lodges near the temple', mr: 'मंदिराजवळचे निवास शोधा' },
  startingFrom: { en: 'From', mr: 'पासून' },
} as const satisfies Record<string, Bilingual>;

/** Formats rupees with Indian digit grouping (12,34,567) without relying on device Intl support. */
export function formatRupees(value: string | number): string {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount)) return '';
  const digits = String(Math.abs(amount));
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped =
    rest.length > 0 ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/gu, ',')},${lastThree}` : lastThree;
  return `₹${amount < 0 ? '-' : ''}${grouped}`;
}

export function formatDistance(meters: number, lang: 'en' | 'mr'): string {
  if (meters < 1000) return lang === 'mr' ? `${meters} मी` : `${meters} m`;
  const km = Math.round(meters / 100) / 10;
  return lang === 'mr' ? `${km} किमी` : `${km} km`;
}
