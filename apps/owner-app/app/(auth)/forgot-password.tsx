import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { ownerForgotPassword } from '../../src/auth/auth-api';
import { PrimaryButton, Screen, SecondaryButton } from '../../src/owner-ui/components';
import { useOwnerApp } from '../../src/owner-ui/OwnerAppProvider';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useOwnerApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    const trimmedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t('Enter a valid email address.', 'वैध ईमेल पत्ता टाका.'));
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await ownerForgotPassword(trimmedEmail);
      setMessage(response.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t(
              'Could not send the reset link. Please try again.',
              'रिसेट लिंक पाठवता आली नाही. पुन्हा प्रयत्न करा.',
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
      <Screen contentContainerClassName="min-h-full justify-center gap-6 px-5 pb-10 pt-16">
        <View className="gap-2">
          <Text className="font-heading text-3xl font-bold text-warm-900">
            {t('Reset your password', 'तुमचा पासवर्ड रिसेट करा')}
          </Text>
          <Text className="font-body text-base leading-6 text-warm-600">
            {t(
              "Enter the email on your owner account. We'll send you a link to reset your password.",
              'तुमच्या मालक खात्यावरील ईमेल टाका. आम्ही तुम्हाला पासवर्ड रिसेट करण्याची लिंक पाठवू.',
            )}
          </Text>
        </View>
        <View className="gap-5 rounded-2xl border border-warm-200 bg-white p-5">
          <View className="gap-2">
            <Text className="font-body text-sm font-bold text-warm-700">
              {t('Email', 'ईमेल')}
            </Text>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              className="min-h-14 rounded-xl border border-warm-300 bg-warm-50 px-4 font-body text-base text-warm-900"
              editable={!message}
              keyboardType="email-address"
              textContentType="username"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError('');
              }}
            />
          </View>
          {error ? <Text className="font-body text-sm text-danger-500">{error}</Text> : null}
          {message ? (
            <Text className="font-body text-sm leading-5 text-maroon-700">{message}</Text>
          ) : null}
          {message ? (
            <SecondaryButton
              label={t('Back to sign in', 'साइन इनकडे परत जा')}
              onPress={() => router.replace('/(auth)/login')}
            />
          ) : (
            <PrimaryButton
              disabled={isSubmitting}
              label={
                isSubmitting
                  ? t('Sending link...', 'लिंक पाठवत आहे...')
                  : t('Send reset link', 'रिसेट लिंक पाठवा')
              }
              onPress={() => void submit()}
            />
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
