import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { requestOwnerLoginOtp } from '../../src/auth/auth-api';
import { useAuth } from '../../src/auth/auth-context';
import { PrimaryButton, Screen, SecondaryButton } from '../../src/owner-ui/components';
import { useOwnerApp } from '../../src/owner-ui/OwnerAppProvider';

export default function VerifyOtpScreen() {
  const { phone, testingOtp } = useLocalSearchParams<{ phone?: string; testingOtp?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const { t } = useOwnerApp();
  const [otp, setOtp] = useState(testingOtp ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function verify() {
    if (!phone) {
      setError(t('Mobile number is missing. Request a new OTP.', 'मोबाईल नंबर उपलब्ध नाही. नवीन OTP मागवा.'));
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError(t('Enter the 6-digit OTP.', '६ अंकी OTP टाका.'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await auth.signInWithOtp(phone, otp);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : t('OTP verification failed. Please try again.', 'OTP पडताळणी अयशस्वी. पुन्हा प्रयत्न करा.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendOtp() {
    if (!phone) {
      router.replace('/(auth)/login');
      return;
    }

    setIsResending(true);
    setError('');

    try {
      const response = await requestOwnerLoginOtp(phone);
      setOtp(response.otpForTesting ?? '');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('OTP could not be resent.', 'OTP पुन्हा पाठवता आला नाही.'),
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Screen contentContainerClassName="min-h-full justify-center gap-6 px-5 pb-10 pt-16">
      <View className="gap-2">
        <Text className="font-heading text-3xl font-bold text-warm-900">
          {t('Enter OTP', 'OTP टाका')}
        </Text>
        <Text className="font-body text-base leading-6 text-warm-600">
          {t(
            `We sent a code to ${phone ?? 'your mobile number'}.`,
            `${phone ?? 'तुमच्या मोबाईल नंबरवर'} कोड पाठवला आहे.`,
          )}
        </Text>
      </View>
      <View className="gap-5 rounded-2xl border border-warm-200 bg-white p-5">
        <TextInput
          accessibilityLabel="OTP"
          className="min-h-16 rounded-xl border border-warm-300 bg-warm-50 px-4 text-center font-heading text-2xl tracking-[10px] text-warm-900"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={(value) => {
            setOtp(value.replace(/\D/g, ''));
            setError('');
          }}
        />
        {error ? <Text className="font-body text-sm text-danger-500">{error}</Text> : null}
        <PrimaryButton
          disabled={isSubmitting}
          label={
            isSubmitting
              ? t('Verifying...', 'पडताळत आहे...')
              : t('Verify & continue', 'पडताळा आणि पुढे जा')
          }
          onPress={() => void verify()}
        />
        <SecondaryButton
          disabled={isResending}
          label={
            isResending
              ? t('Sending again...', 'पुन्हा पाठवत आहे...')
              : t('Send OTP again', 'OTP पुन्हा पाठवा')
          }
          onPress={() => void resendOtp()}
        />
        {testingOtp ? (
          <Text className="text-center font-body text-xs text-warm-500">
            {t('Development OTP is pre-filled.', 'डेव्हलपमेंट OTP आधीच भरलेला आहे.')}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
