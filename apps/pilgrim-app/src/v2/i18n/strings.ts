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

export const exploreStrings = {
  clearFilters: { en: 'Clear filters', mr: 'फिल्टर हटवा' },
  emptyBody: {
    en: 'Try a different search or remove a filter.',
    mr: 'वेगळा शोध घ्या किंवा एखादा फिल्टर काढा.',
  },
  emptyTitle: { en: 'No stays match', mr: 'जुळणारे निवास नाहीत' },
  resultCount: { en: 'stays', mr: 'निवास' },
  searchPlaceholder: { en: 'Search by lodge name', mr: 'निवासाच्या नावाने शोधा' },
  title: { en: 'Find your stay', mr: 'तुमचा मुक्काम शोधा' },
} as const satisfies Record<string, Bilingual>;

export const sortOptions = [
  { id: 'distance', label: { en: 'Nearest', mr: 'जवळचे' } },
  { id: 'price', label: { en: 'Lowest price', mr: 'कमी किंमत' } },
  { id: 'rating', label: { en: 'Top rated', mr: 'सर्वोत्तम' } },
] as const satisfies ReadonlyArray<{ id: string; label: Bilingual }>;

export const propertyTypeOptions = [
  { id: 'LODGE', label: { en: 'Lodge', mr: 'लॉज' } },
  { id: 'BHAKT_NIWAS', label: { en: 'Bhakt Niwas', mr: 'भक्त निवास' } },
  { id: 'DHARAMSHALA', label: { en: 'Dharamshala', mr: 'धर्मशाळा' } },
  { id: 'HOTEL', label: { en: 'Hotel', mr: 'हॉटेल' } },
  { id: 'HOMESTAY', label: { en: 'Homestay', mr: 'होमस्टे' } },
] as const satisfies ReadonlyArray<{ id: string; label: Bilingual }>;

export const priceOptions = [
  { id: 'under1000', label: { en: 'Under ₹1,000', mr: '₹१,००० पर्यंत' }, max: 1000 },
  { id: '1000to2000', label: { en: '₹1,000–2,000', mr: '₹१,०००–२,०००' }, max: 2000, min: 1000 },
  { id: 'over2000', label: { en: '₹2,000+', mr: '₹२,०००+' }, min: 2000 },
] as const satisfies ReadonlyArray<{
  id: string;
  label: Bilingual;
  max?: number;
  min?: number;
}>;

export const amenityOptions = [
  { id: 'ac', label: { en: 'AC', mr: 'एसी' } },
  { id: 'wifi', label: { en: 'Wi-Fi', mr: 'वाय-फाय' } },
  { id: 'parking', label: { en: 'Parking', mr: 'पार्किंग' } },
  { id: 'hot-water', label: { en: 'Hot water', mr: 'गरम पाणी' } },
  { id: 'lift', label: { en: 'Lift', mr: 'लिफ्ट' } },
] as const satisfies ReadonlyArray<{ id: string; label: Bilingual }>;

export const detailStrings = {
  amenities: { en: 'What this stay offers', mr: 'या निवासातील सुविधा' },
  checkAvailability: { en: 'Check availability', mr: 'उपलब्धता तपासा' },
  checkIn: { en: 'Check-in', mr: 'चेक-इन' },
  checkOut: { en: 'Check-out', mr: 'चेक-आउट' },
  directions: { en: 'Get directions', mr: 'मार्ग पहा' },
  guests: { en: 'guests', mr: 'पाहुणे' },
  loadError: {
    en: 'This stay could not be loaded.',
    mr: 'हा निवास लोड होऊ शकला नाही.',
  },
  noReviews: { en: 'No reviews yet', mr: 'अजून परीक्षणे नाहीत' },
  ownerReply: { en: 'Reply from the lodge', mr: 'निवासाचे उत्तर' },
  readLess: { en: 'Show less', mr: 'कमी दाखवा' },
  readMore: { en: 'Read more', mr: 'अधिक वाचा' },
  reviews: { en: 'Pilgrim reviews', mr: 'भाविकांची परीक्षणे' },
  rooms: { en: 'Rooms', mr: 'खोल्या' },
  rules: { en: 'House rules', mr: 'निवासाचे नियम' },
  tryAgain: { en: 'Try again', mr: 'पुन्हा प्रयत्न करा' },
} as const satisfies Record<string, Bilingual>;
