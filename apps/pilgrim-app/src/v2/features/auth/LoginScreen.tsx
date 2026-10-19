import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizeIndianMobile, requestLoginOtp, useAuth } from '../../core/auth';
import { fontFamily } from '../../design/fonts';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { authStrings } from '../../i18n/authStrings';
import { useLang } from '../../i18n/language';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';
import { LanguageToggle } from '../home/LanguageToggle';

export interface LoginScreenProps {
  onOtpSent: (phoneNumber: string, devOtp: string) => void;
  onSignedIn: (onboardingRequired: boolean) => void;
}

export function LoginScreen({ onOtpSent, onSignedIn }: LoginScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const auth = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function sendCode() {
    const normalized = normalizeIndianMobile(phone);
    if (!normalized) {
      setError(t(authStrings.mobileInvalid));
      return;
    }
    setError(null);
    setSending(true);
    try {
      const response = await requestLoginOtp(normalized);
      onOtpSent(normalized, response.otpForTesting ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(authStrings.mobileInvalid));
    } finally {
      setSending(false);
    }
  }

  async function google() {
    setError(null);
    setGoogleBusy(true);
    try {
      const required = await auth.signInWithGoogle();
      if (required !== null) onSignedIn(required);
    } catch {
      setError(t(authStrings.googleFailed));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryPressed]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.hero, { paddingTop: insets.top + space.md }]}
        >
          <View style={styles.heroTop}>
            <LanguageToggle />
          </View>
          <View style={styles.heroCopy}>
            <Text color="onPrimary" variant="display">
              {t(authStrings.title)}
            </Text>
            <Text color="onPrimary" style={styles.subtitle}>
              {t(authStrings.subtitle)}
            </Text>
          </View>
        </LinearGradient>

        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {auth.sessionExpired ? (
            <Text color="danger" variant="label">
              {t(authStrings.sessionEnded)}
            </Text>
          ) : null}
          <View style={styles.field}>
            <Text color="inkMuted" variant="label">
              {t(authStrings.mobile)}
            </Text>
            <View
              style={[
                styles.phoneRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.danger : colors.line,
                },
              ]}
            >
              <Text variant="heading">+91</Text>
              <TextInput
                accessibilityLabel={t(authStrings.mobile)}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="98765 43210"
                placeholderTextColor={colors.inkFaint}
                selectionColor={colors.primary}
                style={[
                  styles.phoneInput,
                  { color: colors.ink, fontFamily: fontFamily.bodyMedium },
                ]}
                textContentType="telephoneNumber"
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/\D/gu, ''))}
              />
            </View>
            {error ? (
              <Text color="danger" variant="caption">
                {error}
              </Text>
            ) : null}
          </View>
          <Button
            label={t(authStrings.sendCode)}
            loading={sending}
            onPress={() => void sendCode()}
          />

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors.line }]} />
            <Text color="inkMuted" variant="caption">
              {t(authStrings.or)}
            </Text>
            <View style={[styles.line, { backgroundColor: colors.line }]} />
          </View>

          <PressableScale
            accessibilityLabel={t(authStrings.continueGoogle)}
            disabled={googleBusy}
            style={[styles.google, { backgroundColor: colors.surface, borderColor: colors.line }]}
            onPress={() => void google()}
          >
            <Icon name="mail" size={20} />
            <Text variant="label">{t(authStrings.continueGoogle)}</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  divider: { alignItems: 'center', flexDirection: 'row', gap: space.md },
  field: { gap: space.xs },
  google: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'center',
    minHeight: 52,
  },
  hero: {
    justifyContent: 'space-between',
    minHeight: 300,
    paddingBottom: space.huge + space.lg,
    paddingHorizontal: gutter,
  },
  heroCopy: { gap: space.sm },
  heroTop: { alignItems: 'flex-end' },
  line: { flex: 1, height: 1 },
  phoneInput: { flex: 1, fontSize: 18, paddingVertical: space.md },
  phoneRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    flex: 1,
    gap: space.xl,
    marginTop: -space.xxl,
    padding: gutter,
    paddingTop: space.xxl,
  },
  subtitle: { opacity: 0.9 },
});
