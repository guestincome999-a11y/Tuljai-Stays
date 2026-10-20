import type { Bilingual } from './language';

export const accountStrings = {
  announcements: { en: 'Announcements', mr: 'घोषणा' },
  announcementsBody: { en: 'Updates from Tuljai Stays', mr: 'तुळजाई स्टेजकडून अपडेट्स' },
  appLanguage: { en: 'App language', mr: 'ॲप भाषा' },
  appVersion: { en: 'App version', mr: 'ॲप आवृत्ती' },
  bookingAlerts: { en: 'Booking notifications', mr: 'बुकिंग सूचना' },
  bookingAlertsBody: {
    en: 'Confirmations, owner replies and check-in reminders',
    mr: 'पुष्टी, मालकाची उत्तरे आणि चेक-इन स्मरणे',
  },
  callSupport: { en: 'Call support', mr: 'सहाय्याला कॉल करा' },
  emailSupport: { en: 'Email support', mr: 'ईमेल सहाय्य' },
  enableNotifications: { en: 'Enable notifications', mr: 'सूचना सुरू करा' },
  legalPrivacy: { en: 'Privacy Policy', mr: 'गोपनीयता धोरण' },
  legalTerms: { en: 'Terms & Conditions', mr: 'अटी आणि शर्ती' },
  logout: { en: 'Log out', mr: 'लॉग आउट' },
  logoutBody: {
    en: 'You can sign in again any time.',
    mr: 'तुम्ही केव्हाही पुन्हा साइन इन करू शकता.',
  },
  markAllRead: { en: 'Mark all read', mr: 'सर्व वाचले' },
  noAnnouncements: { en: 'No announcements right now.', mr: 'सध्या कोणत्याही घोषणा नाहीत.' },
  noNotifications: { en: 'You are all caught up.', mr: 'सर्व सूचना वाचून झाल्या आहेत.' },
  notifications: { en: 'Notifications', mr: 'सूचना' },
  openSettings: { en: 'Open phone settings', mr: 'फोन सेटिंग्ज उघडा' },
  profile: { en: 'Profile', mr: 'प्रोफाइल' },
  saved: { en: 'Saved stays', mr: 'जतन केलेले निवास' },
  savedEmpty: {
    en: 'Tap the heart on a stay to save it.',
    mr: 'निवास जतन करण्यासाठी हृदयावर टॅप करा.',
  },
  savedFilter: { en: 'Saved', mr: 'जतन केलेले' },
  support: { en: 'Help & support', mr: 'मदत आणि सहाय्य' },
  legal: { en: 'Legal', mr: 'कायदेशीर' },
  updatedOn: { en: 'Effective date: 29 August 2026', mr: 'अंमलबजावणी तारीख: २९ ऑगस्ट २०२६' },
} as const satisfies Record<string, Bilingual>;

export const LEGAL_OPERATOR_LINE =
  'Tuljai Stays is operated by Shri Tuljabhavani Technologies, Tuljapur, Maharashtra, India';
export const SUPPORT_EMAIL = 'tuljaistays@gmail.com';
