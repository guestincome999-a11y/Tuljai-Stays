import type { Bilingual } from './language';

export const extraStrings = {
  backToExit: { en: 'Press back again to exit', mr: 'बाहेर पडण्यासाठी पुन्हा मागे दाबा' },
  offline: { en: 'You are offline', mr: 'तुम्ही ऑफलाइन आहात' },
  pass: { en: 'Pass', mr: 'पास' },
  reviewComment: {
    en: 'Tell others about your stay (optional)',
    mr: 'तुमच्या मुक्कामाबद्दल सांगा (ऐच्छिक)',
  },
  reviewDone: { en: 'Thank you for your review.', mr: 'तुमच्या परीक्षणाबद्दल धन्यवाद.' },
  reviewSubmit: { en: 'Submit review', mr: 'परीक्षण पाठवा' },
  reviewTitle: { en: 'How was your stay?', mr: 'तुमचा मुक्काम कसा होता?' },
  savePass: { en: 'Save pass to photos', mr: 'पास फोटोमध्ये जतन करा' },
  savePassDenied: {
    en: 'Allow photo access in phone settings to save the pass.',
    mr: 'पास जतन करण्यासाठी फोन सेटिंग्जमध्ये फोटो परवानगी द्या.',
  },
  savePassDone: { en: 'Pass saved to your photos.', mr: 'पास तुमच्या फोटोमध्ये जतन झाला.' },
  somethingWrong: { en: 'Something went wrong', mr: 'काहीतरी चुकले' },
  somethingWrongBody: {
    en: 'Please try again. If it keeps happening, restart the app.',
    mr: 'कृपया पुन्हा प्रयत्न करा. असेच होत राहिल्यास ॲप पुन्हा सुरू करा.',
  },
  tabBookings: { en: 'Bookings', mr: 'बुकिंग' },
  tabExplore: { en: 'Explore', mr: 'शोधा' },
  tabHome: { en: 'Home', mr: 'मुख्य' },
  tabProfile: { en: 'Profile', mr: 'प्रोफाइल' },
} as const satisfies Record<string, Bilingual>;

export const realtimeMessages: Record<string, Bilingual> = {
  'announcement:new': { en: 'New announcement available.', mr: 'नवीन घोषणा उपलब्ध आहे.' },
  'booking:accepted': { en: 'Your booking has been accepted!', mr: 'तुमचे बुकिंग स्वीकारले गेले!' },
  'booking:cancelled': { en: 'Your booking was cancelled.', mr: 'तुमचे बुकिंग रद्द झाले.' },
  'booking:expired': {
    en: 'A booking request has expired.',
    mr: 'एका बुकिंग विनंतीची मुदत संपली.',
  },
  'booking:rejected': {
    en: 'Your booking was not accepted. You can browse other lodges.',
    mr: 'तुमचे बुकिंग स्वीकारले गेले नाही. तुम्ही इतर निवास पाहू शकता.',
  },
  'booking:updated': {
    en: 'Your booking details were updated by Tuljai Stays support.',
    mr: 'तुमच्या बुकिंगची माहिती तुळजाई स्टेज सहाय्याने अद्ययावत केली.',
  },
  'checkin:completed': { en: 'Check-in completed.', mr: 'चेक-इन पूर्ण झाले.' },
  'checkout:completed': { en: 'Checkout completed.', mr: 'चेक-आउट पूर्ण झाले.' },
  'notification:new': { en: 'New notification received.', mr: 'नवीन सूचना मिळाली.' },
  'qr:generated': { en: 'Your QR pass is ready.', mr: 'तुमचा QR पास तयार आहे.' },
};
