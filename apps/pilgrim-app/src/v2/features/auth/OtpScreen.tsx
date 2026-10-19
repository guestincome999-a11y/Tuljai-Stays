import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestLoginOtp, useAuth } from '../../core/auth';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { authStrings } from '../../i18n/authStrings';
import { useLang } from '../../i18n/language';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

import { OTP_LENGTH, OtpInput } from './OtpInput';

const RESEND_SECONDS = 28;

function formatPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/gu, '').slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function OtpScreen({
  devOtp,
  onBack,
  onSignedIn,
  phoneNumber,
}: {
  devOtp: string;
  onBack: () => void;
  onSignedIn: (onboardingRequired: boolean) => void;
  phoneNumber: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const auth = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [preview, setPreview] = useState(devOtp);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function verify(code: string) {
    if (code.length !== OTP_LENGTH) {
      setError(t(authStrings.codeIncomplete));
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      onSignedIn(await auth.signInWithOtp(phoneNumber, code));
    } catch {
      setError(t(authStrings.verifyFailed));
      setOtp('');
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const response = await requestLoginOtp(phoneNumber);
      setPreview(response.otpForTesting ?? '');
      setSeconds(RESEND_SECONDS);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(authStrings.verifyFailed));
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + space.md },
      ]}
    >
      <PressableScale
        accessibilityLabel="Back"
        pressedScale={0.92}
        style={[styles.back, { backgroundColor: colors.surface }]}
        onPress={onBack}
      >
        <Icon name="arrow-left" size={20} />
      </PressableScale>

      <View style={styles.body}>
        <View style={styles.copy}>
          <Text variant="title">{t(authStrings.enterCode)}</Text>
          <Text color="inkMuted">
            {t(authStrings.codeSentTo)} {formatPhone(phoneNumber)}
          </Text>
        </View>
        <OtpInput
          value={otp}
          onChange={(value) => {
            setOtp(value);
            if (value.length === OTP_LENGTH) void verify(value);
          }}
        />
        {error ? (
          <Text color="danger" variant="label">
            {error}
          </Text>
        ) : null}
        {__DEV__ && preview.length > 0 ? (
          <Text color="inkMuted" variant="caption">
            Test code: {preview}
          </Text>
        ) : null}
        <Button
          label={t(authStrings.verify)}
          loading={verifying}
          onPress={() => void verify(otp)}
        />
        {seconds > 0 ? (
          <Text align="center" color="inkMuted" variant="label">
            {t(authStrings.resendIn)} 00:{String(seconds).padStart(2, '0')}
          </Text>
        ) : (
          <Button
            disabled={resending}
            label={t(authStrings.resend)}
            variant="ghost"
            onPress={() => void resend()}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    marginLeft: gutter,
    width: 44,
  },
  body: { gap: space.xl, padding: gutter },
  copy: { gap: space.sm },
  screen: { flex: 1 },
});
