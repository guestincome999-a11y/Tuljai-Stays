import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { ownerResetPassword } from '../../src/auth/auth-api';
import { PrimaryButton, Screen, SecondaryButton } from '../../src/owner-ui/components';
import { useOwnerApp } from '../../src/owner-ui/OwnerAppProvider';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { t } = useOwnerApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function submit() {
    if (!token) {
      setError(
        t(
          'This reset link is missing information. Please request a new one.',
          'या रिसेट लिंकमध्ये माहिती गहाळ आहे. कृपया नवीन विनंती करा.',
        ),
      );
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(password)) {
      setError(
        t(
          'Password must be at least 8 characters and include a letter and a number.',
          'पासवर्ड कमीत कमी ८ अक्षरांचा असावा आणि त्यात एक अक्षर व एक अंक असावा.',
        ),
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(t('Passwords do not match.', 'पासवर्ड जुळत नाहीत.'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await ownerResetPassword(token, password);
      setIsDone(true);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : t(
              'Could not reset your password. Please try again.',
              'पासवर्ड रिसेट करता आला नाही. पुन्हा प्रयत्न करा.',
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDone) {
    return (
      <Screen contentContainerClassName="min-h-full justify-center gap-6 px-5 pb-10 pt-16">
        <View className="items-center gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-saffron-100">
            <MaterialCommunityIcons color="#7A1F2B" name="check-circle-outline" size={36} />
          </View>
          <Text className="text-center font-heading text-2xl font-bold text-warm-900">
            {t('Password reset', 'पासवर्ड रिसेट झाला')}
          </Text>
          <Text className="text-center font-body text-base leading-6 text-warm-600">
            {t(
              'Your password has been reset. Please sign in with your new password.',
              'तुमचा पासवर्ड रिसेट झाला आहे. कृपया नवीन पासवर्डने साइन इन करा.',
            )}
          </Text>
        </View>
        <PrimaryButton
          label={t('Go to sign in', 'साइन इनकडे जा')}
          onPress={() => router.replace('/(auth)/login')}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-warm-50"
    >
      <Screen contentContainerClassName="min-h-full justify-center gap-6 px-5 pb-10 pt-16">
        <View className="gap-2">
          <Text className="font-heading text-3xl font-bold text-warm-900">
            {t('Choose a new password', 'नवीन पासवर्ड निवडा')}
          </Text>
        </View>
        <View className="gap-5 rounded-2xl border border-warm-200 bg-white p-5">
          <View className="gap-2">
            <Text className="font-body text-sm font-bold text-warm-700">
              {t('New password', 'नवीन पासवर्ड')}
            </Text>
            <View className="min-h-14 flex-row items-center rounded-xl border border-warm-300 bg-warm-50 px-4">
              <TextInput
                accessibilityLabel="New password"
                autoCapitalize="none"
                className="flex-1 font-body text-base text-warm-900"
                secureTextEntry={!isPasswordVisible}
                textContentType="newPassword"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError('');
                }}
              />
              <Pressable
                accessibilityLabel={
                  isPasswordVisible
                    ? t('Hide password', 'पासवर्ड लपवा')
                    : t('Show password', 'पासवर्ड दाखवा')
                }
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsPasswordVisible((value) => !value)}
              >
                <MaterialCommunityIcons
                  color="#8A7B6C"
                  name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                />
              </Pressable>
            </View>
            <Text className="font-body text-xs leading-5 text-warm-500">
              {t(
                'At least 8 characters, with a letter and a number.',
                'कमीत कमी ८ अक्षरे, एक अक्षर व एक अंक असावा.',
              )}
            </Text>
          </View>
          <View className="gap-2">
            <Text className="font-body text-sm font-bold text-warm-700">
              {t('Confirm new password', 'नवीन पासवर्डची पुष्टी करा')}
            </Text>
            <TextInput
              accessibilityLabel="Confirm new password"
              autoCapitalize="none"
              className="min-h-14 rounded-xl border border-warm-300 bg-warm-50 px-4 font-body text-base text-warm-900"
              secureTextEntry={!isPasswordVisible}
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setError('');
              }}
            />
          </View>
          {error ? <Text className="font-body text-sm text-danger-500">{error}</Text> : null}
          <PrimaryButton
            disabled={isSubmitting}
            label={
              isSubmitting
                ? t('Resetting...', 'रिसेट करत आहे...')
                : t('Reset password', 'पासवर्ड रिसेट करा')
            }
            onPress={() => void submit()}
          />
          <SecondaryButton
            label={t('Back to sign in', 'साइन इनकडे परत जा')}
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
