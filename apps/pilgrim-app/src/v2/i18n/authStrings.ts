import type { Bilingual } from './language';

export const authStrings = {
  codeIncomplete: { en: 'Enter all 6 digits.', mr: 'सर्व ६ अंक टाका.' },
  codeSentTo: { en: 'We sent a 6-digit code to', mr: 'आम्ही ६ अंकी कोड पाठवला:' },
  continueGoogle: { en: 'Continue with Google', mr: 'Google ने पुढे जा' },
  enterCode: { en: 'Enter the code', mr: 'कोड टाका' },
  googleFailed: {
    en: 'Google sign-in did not work. Please try again.',
    mr: 'Google साइन-इन झाले नाही. कृपया पुन्हा प्रयत्न करा.',
  },
  mobile: { en: 'Mobile number', mr: 'मोबाइल क्रमांक' },
  mobileInvalid: {
    en: 'Enter a valid 10-digit Indian mobile number.',
    mr: 'वैध १० अंकी भारतीय मोबाइल क्रमांक टाका.',
  },
  nameBody: {
    en: 'This name is shown on your bookings.',
    mr: 'हे नाव तुमच्या बुकिंगवर दिसेल.',
  },
  nameInvalid: { en: 'Enter at least 2 letters.', mr: 'किमान २ अक्षरे टाका.' },
  nameLabel: { en: 'Your name', mr: 'तुमचे नाव' },
  nameSave: { en: 'Continue', mr: 'पुढे जा' },
  nameTitle: { en: 'What should we call you?', mr: 'तुम्हाला काय म्हणू?' },
  or: { en: 'or', mr: 'किंवा' },
  resend: { en: 'Resend code', mr: 'कोड पुन्हा पाठवा' },
  resendIn: { en: 'Resend code in', mr: 'कोड पुन्हा पाठवा' },
  sendCode: { en: 'Send code', mr: 'कोड पाठवा' },
  sessionEnded: {
    en: 'Your session has ended. Please sign in again.',
    mr: 'तुमचे सत्र संपले आहे. कृपया पुन्हा साइन इन करा.',
  },
  subtitle: {
    en: 'Sign in to book stays and see your passes.',
    mr: 'निवास बुक करण्यासाठी आणि तुमचे पास पाहण्यासाठी साइन इन करा.',
  },
  title: { en: 'Welcome, pilgrim', mr: 'स्वागत आहे, भाविका' },
  verify: { en: 'Verify and continue', mr: 'तपासा आणि पुढे जा' },
  verifyFailed: {
    en: 'That code did not work. Check it and try again.',
    mr: 'तो कोड चालला नाही. तपासून पुन्हा प्रयत्न करा.',
  },
} as const satisfies Record<string, Bilingual>;
