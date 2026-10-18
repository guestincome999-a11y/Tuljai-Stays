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

export const bookingStrings = {
  adults: { en: 'Adults', mr: 'प्रौढ' },
  apply: { en: 'Apply dates', mr: 'तारखा निवडा' },
  changeDates: { en: 'Change', mr: 'बदला' },
  checkInOut: { en: 'Check-in → Check-out', mr: 'चेक-इन → चेक-आउट' },
  children: { en: 'Children', mr: 'मुले' },
  chooseRoom: { en: 'Choose a room', mr: 'खोली निवडा' },
  email: { en: 'Email (optional)', mr: 'ईमेल (ऐच्छिक)' },
  emailInvalid: {
    en: 'Enter a valid email or leave it blank.',
    mr: 'वैध ईमेल टाका किंवा रिकामा ठेवा.',
  },
  guestDetails: { en: 'Guest details', mr: 'पाहुण्यांची माहिती' },
  guests: { en: 'Guests', mr: 'पाहुणे' },
  idHint: { en: 'JPEG, PNG or PDF, up to 5 MB', mr: 'JPEG, PNG किंवा PDF, ५ MB पर्यंत' },
  idMissing: { en: 'A government photo ID is required.', mr: 'सरकारी फोटो ओळखपत्र आवश्यक आहे.' },
  idReplace: { en: 'Replace file', mr: 'फाइल बदला' },
  idTitle: { en: 'Government photo ID', mr: 'सरकारी फोटो ओळखपत्र' },
  idTooLarge: {
    en: 'ID proof must be 5 MB or smaller.',
    mr: 'ओळखपत्र ५ MB किंवा त्यापेक्षा कमी असावे.',
  },
  idUnsupported: { en: 'Choose a JPEG, PNG or PDF file.', mr: 'JPEG, PNG किंवा PDF फाइल निवडा.' },
  idUpload: { en: 'Upload ID', mr: 'ओळखपत्र अपलोड करा' },
  idUploading: { en: 'Uploading…', mr: 'अपलोड होत आहे…' },
  idWait: {
    en: 'Please wait for the ID to finish uploading.',
    mr: 'ओळखपत्र अपलोड होईपर्यंत थांबा.',
  },
  name: { en: 'Full name', mr: 'पूर्ण नाव' },
  nameInvalid: { en: 'Enter the guest name.', mr: 'पाहुण्याचे नाव टाका.' },
  night: { en: 'night', mr: 'रात्र' },
  nights: { en: 'nights', mr: 'रात्री' },
  noRoom: {
    en: 'This lodge has no bookable room right now.',
    mr: 'या निवासात सध्या बुक करण्यायोग्य खोली नाही.',
  },
  paidFailedHint: {
    en: 'If money was deducted, contact support with this payment reference:',
    mr: 'पैसे वजा झाले असल्यास, हा पेमेंट संदर्भ देऊन सहाय्याशी संपर्क करा:',
  },
  payAtLodge: { en: 'Pay at lodge', mr: 'निवासात पैसे भरा' },
  payAtLodgeHint: {
    en: 'The owner reviews your request before confirming.',
    mr: 'पुष्टीपूर्वी मालक तुमची विनंती तपासतील.',
  },
  payNow: { en: 'Pay', mr: 'भरा' },
  payOnline: { en: 'Pay online', mr: 'ऑनलाइन भरा' },
  payOnlineHint: {
    en: 'Confirmed instantly. No lodge approval needed.',
    mr: 'त्वरित पुष्टी. मालकाच्या मंजुरीची गरज नाही.',
  },
  payment: { en: 'Payment', mr: 'पेमेंट' },
  phone: { en: 'Mobile number', mr: 'मोबाइल क्रमांक' },
  phoneInvalid: {
    en: 'Enter a valid 10-digit mobile number.',
    mr: 'वैध १० अंकी मोबाइल क्रमांक टाका.',
  },
  preparing: { en: 'Preparing secure payment…', mr: 'सुरक्षित पेमेंट तयार होत आहे…' },
  request: { en: 'Special request (optional)', mr: 'विशेष विनंती (ऐच्छिक)' },
  roomFull: {
    en: 'This room just filled up. Try other dates or another room.',
    mr: 'ही खोली आत्ताच भरली. दुसऱ्या तारखा किंवा दुसरी खोली निवडा.',
  },
  roomsLeft: { en: 'left', mr: 'शिल्लक' },
  sendRequest: { en: 'Send booking request', mr: 'बुकिंग विनंती पाठवा' },
  soldOut: { en: 'Sold out', mr: 'संपले' },
  termsLabel: {
    en: 'I accept the lodge rules and cancellation terms',
    mr: 'मी निवासाचे नियम आणि रद्दीकरण अटी स्वीकारतो/स्वीकारते',
  },
  termsRequired: {
    en: 'Please accept the terms to continue.',
    mr: 'पुढे जाण्यासाठी अटी स्वीकारा.',
  },
  title: { en: 'Reserve your stay', mr: 'तुमचा मुक्काम निश्चित करा' },
  total: { en: 'Total', mr: 'एकूण' },
} as const satisfies Record<string, Bilingual>;
