import { AppScreen, spacing } from '@tuljai/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';

import { useAuth } from '../../src/auth/auth-context';
import { FormErrorBanner } from '../../src/components/FormErrorBanner';
import { useConnectivity } from '../../src/connectivity/connectivity-context';

export default function VerifyOtpScreen() {
  const { phoneNumber, devOtp } = useLocalSearchParams<{ devOtp?: string; phoneNumber?: string }>();
  const auth = useAuth();
  const { isOffline } = useConnectivity();
  const theme = useTheme();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const verifiedPhoneNumber = typeof phoneNumber === 'string' ? phoneNumber : null;

  if (!verifiedPhoneNumber) {
    return <Redirect href="/(auth)/login" />;
  }

  async function handleVerify() {
    if (!verifiedPhoneNumber) {
      return;
    }

    const trimmedOtp = otp.trim();

    if (!/^\d{4,8}$/.test(trimmedOtp)) {
      setError('Enter the OTP code sent to your mobile number.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await auth.signInWithOtp(verifiedPhoneNumber, trimmedOtp);
    } catch {
      setError('OTP verification failed. Please check the code and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen scrollable style={styles.screen}>
      <Text style={{ color: theme.colors.primary }} variant="headlineMedium">
        Verify OTP
      </Text>
      <Text variant="bodyLarge">Enter the code sent to {verifiedPhoneNumber}.</Text>
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.form}>
          <TextInput
            accessibilityLabel="Owner OTP code"
            keyboardType="number-pad"
            label="OTP code"
            maxLength={8}
            mode="outlined"
            value={otp}
            onChangeText={setOtp}
          />
          <FormErrorBanner message={error} />
          {devOtp ? (
            <Text style={{ color: theme.colors.primary }} variant="bodyMedium">
              Development OTP: {devOtp}
            </Text>
          ) : null}
          <Button
            accessibilityLabel="Verify owner OTP and continue"
            disabled={isSubmitting || isOffline}
            loading={isSubmitting}
            mode="contained"
            onPress={() => {
              void handleVerify();
            }}
          >
            Verify and continue
          </Button>
          {isOffline ? (
            <Text variant="bodySmall">Connect to the internet to verify OTP.</Text>
          ) : null}
        </Card.Content>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
  },
  form: {
    gap: spacing.md,
  },
  screen: {
    gap: spacing.md,
    justifyContent: 'center',
  },
});
