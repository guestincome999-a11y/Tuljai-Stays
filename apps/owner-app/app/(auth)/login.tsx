import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestOwnerLoginOtp } from '../../src/auth/auth-api';
import { useAuth } from '../../src/auth/auth-context';
import { LanguagePill, PrimaryButton, Screen } from '../../src/owner-ui/components';
import { LegalDocument, type LegalDocumentKind } from '../../src/owner-ui/legal-documents';
import { useOwnerApp } from '../../src/owner-ui/OwnerAppProvider';

const SUPPORT_EMAIL = 'tuljaistays@gmail.com';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { t } = useOwnerApp();
  const [phone, setPhone] = useState(process.env.EXPO_PUBLIC_OWNER_PREVIEW_PHONE ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalKind, setLegalKind] = useState<LegalDocumentKind>('terms');

  function openLegal(kind: LegalDocumentKind) {
    setLegalKind(kind);
    setLegalOpen(true);
  }

  async function continueToOtp() {
    if (!agreedToTerms) {
      setError(
        t(
          'Please agree to the Terms of Service and Privacy Policy to continue.',
          'पुढे जाण्यासाठी कृपया सेवा अटी आणि गोपनीयता धोरण मान्य करा.',
        ),
      );
      return;
    }

    const digits = phone.replace(/\D/g, '');

    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t('Enter a valid 10-digit mobile number.', 'वैध १० अंकी मोबाईल नंबर टाका.'));
      return;
    }

    setIsSubmitting(true);
    setError('');
    const phoneNumber = `+91${digits}`;

    try {
      const response = await requestOwnerLoginOtp(phoneNumber);
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: phoneNumber,
          ...(response.otpForTesting ? { testingOtp: response.otpForTesting } : {}),
        },
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t(
              'OTP could not be sent. Please try again.',
              'OTP पाठवता आला नाही. पुन्हा प्रयत्न करा.',
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-warm-50"
    >
      <Screen contentContainerClassName="min-h-full justify-between gap-8 px-5 pb-10 pt-16">
        <View className="items-end">
          <LanguagePill />
        </View>
        <View className="items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-saffron-500">
            <MaterialCommunityIcons color="#7A1F2B" name="temple-hindu" size={42} />
          </View>
          <View className="items-center gap-1">
            <Text className="font-heading text-3xl font-bold text-maroon-700">Tuljai Stays</Text>
            <Text className="font-devanagari text-base text-warm-600">
              {t('Lodge Owner App', 'लॉज मालक अॅप')}
            </Text>
          </View>
        </View>

        <View className="gap-5 rounded-2xl border border-warm-200 bg-white p-5">
          <View className="gap-1">
            <Text className="font-heading text-2xl font-bold text-warm-900">
              {t('Welcome', 'नमस्कार')}
            </Text>
            <Text className="font-body text-base leading-6 text-warm-600">
              {t(
                'Enter your registered mobile number to manage your lodge.',
                'तुमचे लॉज व्यवस्थापित करण्यासाठी नोंदणीकृत मोबाईल नंबर टाका.',
              )}
            </Text>
          </View>
          <View className="gap-2">
            <Text className="font-body text-sm font-bold text-warm-700">
              {t('Mobile number', 'मोबाईल नंबर')}
            </Text>
            <View className="min-h-14 flex-row items-center rounded-xl border border-warm-300 bg-warm-50 px-4">
              <Text className="font-body text-base font-bold text-warm-700">+91</Text>
              <View className="mx-3 h-7 w-px bg-warm-300" />
              <TextInput
                accessibilityLabel="Mobile number"
                className="flex-1 font-body text-lg text-warm-900"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(value) => {
                  setPhone(value.replace(/\D/g, ''));
                  setError('');
                }}
              />
            </View>
            {error ? <Text className="font-body text-sm text-danger-500">{error}</Text> : null}
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
            <Text className="flex-1 font-body text-sm leading-5 text-warm-600">
              {t('I agree to the ', 'मी ')}
              <Text
                className="font-bold text-maroon-700"
                onPress={() => openLegal('terms')}
                suppressHighlighting
              >
                {t('Terms of Service', 'सेवा अटी')}
              </Text>
              {t(' and ', ' आणि ')}
              <Text
                className="font-bold text-maroon-700"
                onPress={() => openLegal('privacy')}
                suppressHighlighting
              >
                {t('Privacy Policy', 'गोपनीयता धोरण')}
              </Text>
              {t('.', '.')}
            </Text>
          </Pressable>

          <PrimaryButton
            disabled={isSubmitting || !agreedToTerms}
            icon="arrow-right"
            label={
              isSubmitting ? t('Sending OTP...', 'OTP पाठवत आहे...') : t('Get OTP', 'OTP मिळवा')
            }
            onPress={() => void continueToOtp()}
          />
          <Text className="text-center font-body text-xs leading-5 text-warm-500">
            {t(
              'Use the number registered with your approved owner account.',
              'तुमच्या मंजूर मालक खात्याशी नोंदणीकृत नंबर वापरा.',
            )}
          </Text>
          {auth.accessDeniedMessage ? (
            <Text className="text-center font-body text-sm text-danger-500">
              {auth.accessDeniedMessage}
            </Text>
          ) : null}
        </View>
      </Screen>

      <Modal
        animationType="slide"
        onRequestClose={() => setLegalOpen(false)}
        presentationStyle="pageSheet"
        visible={legalOpen}
      >
        <SafeAreaView className="flex-1 bg-warm-50" edges={['top', 'bottom']}>
          <View className="flex-row items-center justify-between border-b border-warm-100 bg-white px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="font-heading text-lg font-extrabold text-warm-900">
                {legalKind === 'privacy'
                  ? t('Privacy Policy', 'गोपनीयता धोरण')
                  : t('Terms & Conditions', 'अटी व शर्ती')}
              </Text>
              <Text className="mt-0.5 font-body text-xs text-warm-500">
                Tuljai Stays Owner App · India
              </Text>
            </View>
            <Pressable
              accessibilityLabel={t('Close legal document', 'कायदेशीर दस्तऐवज बंद करा')}
              className="h-10 w-10 items-center justify-center rounded-full bg-warm-100"
              hitSlop={8}
              onPress={() => setLegalOpen(false)}
            >
              <MaterialCommunityIcons color="#7A1F2B" name="close" size={22} />
            </Pressable>
          </View>
          <View className="flex-1 px-5 pt-5">
            <LegalDocument kind={legalKind} />
          </View>
          <View className="border-t border-warm-100 bg-white px-5 py-3">
            <Text className="text-center font-body text-xs leading-5 text-warm-500">
              {t('Questions or privacy requests?', 'प्रश्न किंवा गोपनीयता विनंती?')} {SUPPORT_EMAIL}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
