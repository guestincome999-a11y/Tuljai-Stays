import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestLoginOtp, useMockExperience } from '../../auth/auth-api';
import { useAuth } from '../../auth/auth-context';
import { GoogleLoginCancelledError, startGoogleLogin } from '../../auth/google-auth';
import { AnimatedWelcomeSplash } from '../../components/AnimatedWelcomeSplash';
import { AppScreen, BrandMark, Field, LanguageToggle, PrimaryButton, ui } from '../components';
import { LegalDocument, type LegalDocumentKind } from '../legal-documents';
import { usePilgrimApp } from '../PilgrimAppProvider';

const OTP_LENGTH = 6;
const SUPPORT_EMAIL = 'tuljaistays@gmail.com';

function normalizeIndianMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function PilgrimLoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { t } = usePilgrimApp();
  const [phone, setPhone] = useState(useMockExperience() ? '9876543210' : '');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalKind, setLegalKind] = useState<LegalDocumentKind>('terms');

  function openLegal(kind: LegalDocumentKind) {
    setLegalKind(kind);
    setLegalOpen(true);
  }

  async function sendOtp() {
    if (!agreedToTerms) {
      setError(
        t(
          'Please agree to the Terms of Service and Privacy Policy to continue.',
          'पुढे जाण्यासाठी कृपया सेवा अटी आणि गोपनीयता धोरण मान्य करा.',
        ),
      );
      return;
    }
    const normalized = normalizeIndianMobile(phone);
    if (!normalized) {
      setError(t('Enter a valid 10-digit mobile number.', 'वैध १० अंकी मोबाइल क्रमांक टाका.'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await requestLoginOtp(normalized);
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { devOtp: response.otpForTesting ?? '', phoneNumber: normalized },
      });
    } catch {
      setError(
        t(
          'We could not send the OTP. Please try again.',
          'OTP पाठवता आला नाही. पुन्हा प्रयत्न करा.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    if (!agreedToTerms) {
      setError(
        t(
          'Please agree to the Terms of Service and Privacy Policy to continue.',
          'पुढे जाण्यासाठी कृपया सेवा अटी आणि गोपनीयता धोरण मान्य करा.',
        ),
      );
      return;
    }
    setError('');
    setGoogleLoading(true);
    try {
      const supabaseAccessToken = await startGoogleLogin();
      await auth.signInWithGoogle(supabaseAccessToken);
    } catch (loginError) {
      if (!(loginError instanceof GoogleLoginCancelledError)) {
        setError(
          t(
            'We could not sign you in with Google. Please try again.',
            'Google सह साइन इन करता आले नाही. कृपया पुन्हा प्रयत्न करा.',
          ),
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AppScreen className="gap-7 pt-3">
      <View className="flex-row items-center justify-between">
        <BrandMark compact />
        <LanguageToggle />
      </View>

      <View className="relative min-h-60 overflow-hidden rounded-3xl bg-maroon-700 p-6">
        <View className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-saffron-500/20" />
        <View className="absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-white/5" />
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
          <MaterialCommunityIcons color="#FFE8C8" name="temple-hindu" size={49} />
        </View>
        <Text className="mt-5 text-3xl font-extrabold leading-10 text-white">
          {t('A peaceful stay for your sacred journey', 'तुमच्या पवित्र यात्रेसाठी शांत निवास')}
        </Text>
        <Text className="mt-2 text-sm leading-6 text-orange-100">
          {t(
            'Verified lodges and Bhakt Niwas near Tulja Bhavani Temple.',
            'तुळजाभवानी मंदिराजवळील सत्यापित लॉज आणि भक्त निवास.',
          )}
        </Text>
      </View>

      <View>
        <Text className="text-2xl font-extrabold tracking-tight text-warm-900">
          {t('Welcome to Tuljai Stays', 'तुळजाई स्टेजमध्ये स्वागत')}
        </Text>
        <Text className="mt-2 text-sm leading-5 text-warm-500">
          {t(
            'Sign in securely with your mobile number or Google account.',
            'तुमच्या मोबाइल क्रमांकाने किंवा Google खात्याने सुरक्षितपणे साइन इन करा.',
          )}
        </Text>
      </View>

      {auth.sessionExpiredMessage ? (
        <View className="flex-row items-center gap-2 rounded-2xl bg-saffron-50 p-3">
          <MaterialCommunityIcons color={ui.saffronDeep} name="information-outline" size={19} />
          <Text className="flex-1 text-sm font-semibold text-warm-700">
            {auth.sessionExpiredMessage}
          </Text>
        </View>
      ) : null}

      <View>
        <Field
          icon="phone-outline"
          keyboardType="phone-pad"
          label={t('Mobile number', 'मोबाइल क्रमांक')}
          maxLength={10}
          onChangeText={(value) => {
            setPhone(value);
            setError('');
          }}
          placeholder="98765 43210"
          value={phone}
        />
        {error ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-danger-50 p-3">
            <MaterialCommunityIcons color={ui.danger} name="alert-circle-outline" size={19} />
            <Text className="flex-1 text-sm font-semibold text-danger-700">{error}</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel={t(
          'I agree to the Terms of Service and Privacy Policy',
          'मी सेवा अटी आणि गोपनीयता धोरण मान्य करतो',
        )}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreedToTerms }}
        className="flex-row items-start gap-3"
        hitSlop={4}
        onPress={() => {
          setAgreedToTerms((value) => !value);
          setError('');
        }}
      >
        <View
          className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${agreedToTerms ? 'border-maroon-700 bg-maroon-700' : 'border-warm-300 bg-white'}`}
        >
          {agreedToTerms ? (
            <MaterialCommunityIcons color="#FFFFFF" name="check-bold" size={15} />
          ) : null}
        </View>
        <Text className="flex-1 text-sm leading-5 text-warm-600">
          {t('I agree to the ', 'मी ')}
          <Text
            className="font-extrabold text-maroon-700"
            onPress={() => openLegal('terms')}
            suppressHighlighting
          >
            {t('Terms of Service', 'सेवा अटी')}
          </Text>
          {t(' and ', ' आणि ')}
          <Text
            className="font-extrabold text-maroon-700"
            onPress={() => openLegal('privacy')}
            suppressHighlighting
          >
            {t('Privacy Policy', 'गोपनीयता धोरण')}
          </Text>
          {t('.', '.')}
        </Text>
      </Pressable>

      <PrimaryButton
        disabled={googleLoading || !agreedToTerms}
        icon="arrow-right"
        loading={loading}
        onPress={() => void sendOtp()}
      >
        {t('Send OTP', 'OTP पाठवा')}
      </PrimaryButton>

      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-warm-200" />
        <Text className="text-xs font-bold uppercase tracking-widest text-warm-400">
          {t('or', 'किंवा')}
        </Text>
        <View className="h-px flex-1 bg-warm-200" />
      </View>

      <Pressable
        accessibilityLabel={t('Continue with Google', 'Google सह पुढे चला')}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading || googleLoading || !agreedToTerms }}
        className={`min-h-14 flex-row items-center justify-center gap-3 rounded-2xl border border-warm-200 bg-white px-5 ${loading || googleLoading || !agreedToTerms ? 'opacity-60' : 'active:bg-warm-50'}`}
        disabled={loading || googleLoading || !agreedToTerms}
        onPress={() => void continueWithGoogle()}
      >
        {googleLoading ? (
          <ActivityIndicator color={ui.maroon} />
        ) : (
          <MaterialCommunityIcons color="#4285F4" name="google" size={23} />
        )}
        <Text className="text-base font-extrabold text-warm-900">
          {t('Continue with Google', 'Google सह पुढे चला')}
        </Text>
      </Pressable>

      <View className="flex-row items-start gap-3 rounded-2xl bg-saffron-50 p-4">
        <MaterialCommunityIcons color={ui.saffronDeep} name="shield-lock-outline" size={22} />
        <Text className="flex-1 text-sm leading-5 text-warm-600">
          {t(
            'We use your number only for bookings, check-in and important travel updates.',
            'तुमचा क्रमांक फक्त बुकिंग, चेक-इन आणि महत्त्वाच्या प्रवास अपडेटसाठी वापरतो.',
          )}
        </Text>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setLegalOpen(false)}
        presentationStyle="pageSheet"
        visible={legalOpen}
      >
        <SafeAreaView className="flex-1 bg-warm-50" edges={['top', 'bottom']}>
          <View className="flex-row items-center justify-between border-b border-warm-100 bg-white px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-lg font-extrabold text-warm-900">
                {legalKind === 'privacy'
                  ? t('Privacy Policy', 'गोपनीयता धोरण')
                  : t('Terms & Conditions', 'अटी व शर्ती')}
              </Text>
              <Text className="mt-0.5 text-xs text-warm-500">Tuljai Stays · India</Text>
            </View>
            <Pressable
              accessibilityLabel={t('Close legal document', 'कायदेशीर दस्तऐवज बंद करा')}
              className="h-10 w-10 items-center justify-center rounded-full bg-warm-100"
              hitSlop={8}
              onPress={() => setLegalOpen(false)}
            >
              <MaterialCommunityIcons color={ui.maroon} name="close" size={22} />
            </Pressable>
          </View>
          <View className="flex-1 px-5 pt-5">
            <LegalDocument kind={legalKind} />
          </View>
          <View className="border-t border-warm-100 bg-white px-5 py-3">
            <Text className="text-center text-xs leading-5 text-warm-500">
              {t('Questions or privacy requests?', 'प्रश्न किंवा गोपनीयता विनंती?')} {SUPPORT_EMAIL}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </AppScreen>
  );
}

export function PilgrimVerifyOtpScreen() {
  const params = useLocalSearchParams<{ devOtp?: string; phoneNumber?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const { t } = usePilgrimApp();
  const inputRef = useRef<TextInput>(null);
  const [otp, setOtp] = useState(params.devOtp ?? '');
  const [loading, setLoading] = useState(false);
  const [previewOtp, setPreviewOtp] = useState(params.devOtp ?? '');
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(28);
  const phoneNumber = typeof params.phoneNumber === 'string' ? params.phoneNumber : null;

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  if (!phoneNumber) return <Redirect href="/(auth)/login" />;
  const verifiedPhoneNumber = phoneNumber;

  async function verify() {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert(t('Enter all 6 digits', 'सर्व ६ अंक टाका'));
      return;
    }
    setLoading(true);
    try {
      await auth.signInWithOtp(verifiedPhoneNumber, otp);
    } catch {
      Alert.alert(
        t('OTP did not match', 'OTP जुळला नाही'),
        t(
          'Check the code and try again, or request a new OTP.',
          'कोड तपासून पुन्हा प्रयत्न करा किंवा नवीन OTP मागवा.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const response = await requestLoginOtp(verifiedPhoneNumber);
      const nextPreviewOtp = response.otpForTesting ?? '';
      setOtp(nextPreviewOtp);
      setPreviewOtp(nextPreviewOtp);
      setSeconds(30);
    } catch {
      Alert.alert(
        t('Could not resend OTP', 'OTP पुन्हा पाठवता आला नाही'),
        t('Please try again in a moment.', 'कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'),
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <AppScreen className="gap-7 pt-3">
      <Pressable
        className="h-12 w-12 items-center justify-center rounded-2xl bg-warm-100"
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons color={ui.ink} name="chevron-left" size={27} />
      </Pressable>
      <View className="h-20 w-20 items-center justify-center rounded-3xl bg-saffron-100">
        <MaterialCommunityIcons color={ui.saffronDeep} name="message-lock-outline" size={39} />
      </View>
      <View>
        <Text className="text-3xl font-extrabold tracking-tight text-warm-900">
          {t('Verify your number', 'तुमचा क्रमांक सत्यापित करा')}
        </Text>
        <Text className="mt-2 text-sm leading-6 text-warm-500">
          {t(
            `Enter the 6-digit code sent to ${formatPhone(verifiedPhoneNumber)}`,
            `${formatPhone(verifiedPhoneNumber)} वर पाठवलेला ६ अंकी कोड टाका`,
          )}
        </Text>
      </View>

      <Pressable className="relative" onPress={() => inputRef.current?.focus()}>
        <View className="flex-row justify-between gap-3">
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <View
              className={`h-14 flex-1 items-center justify-center rounded-xl border-2 bg-white ${otp.length === index ? 'border-saffron-500' : otp[index] ? 'border-templeGreen-500' : 'border-warm-200'}`}
              key={index}
            >
              <Text className="text-xl font-extrabold text-warm-900">{otp[index] ?? ''}</Text>
            </View>
          ))}
        </View>
        <TextInput
          autoFocus
          caretHidden
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          onChangeText={(value) => setOtp(value.replace(/\D/g, ''))}
          ref={inputRef}
          style={{ height: 1, opacity: 0, position: 'absolute', width: 1 }}
          value={otp}
        />
      </Pressable>

      <View className="items-center">
        <Text className="text-sm text-warm-500">
          {seconds > 0
            ? t(
                `Resend code in 00:${seconds.toString().padStart(2, '0')}`,
                `कोड पुन्हा पाठवा 00:${seconds.toString().padStart(2, '0')}`,
              )
            : t("Didn't receive a code?", 'कोड मिळाला नाही?')}
        </Text>
        {seconds === 0 ? (
          <Pressable
            className="min-h-11 justify-center"
            disabled={resending}
            onPress={() => void resend()}
          >
            <Text className="font-extrabold text-saffron-700">
              {resending ? t('Sending…', 'पाठवत आहे…') : t('Resend OTP', 'OTP पुन्हा पाठवा')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <PrimaryButton icon="shield-check-outline" loading={loading} onPress={() => void verify()}>
        {t('Verify & continue', 'सत्यापित करा आणि पुढे चला')}
      </PrimaryButton>

      {previewOtp ? (
        <View className="items-center rounded-2xl bg-bell-50 p-4">
          <Text className="text-xs font-bold text-bell-700">
            {t('PREVIEW CODE', 'प्रीव्ह्यू कोड')}
          </Text>
          <Text className="mt-1 text-xl font-extrabold text-warm-900">{previewOtp}</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

export function PilgrimBootstrapScreen() {
  const { bootstrapComplete, isAuthenticated } = useAuth();
  const [minimumDisplayComplete, setMinimumDisplayComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumDisplayComplete(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  if (bootstrapComplete && minimumDisplayComplete) {
    return <Redirect href={isAuthenticated ? '/(app)/home' : '/(auth)/login'} />;
  }

  return <AnimatedWelcomeSplash />;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
