import { AppScreen, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';

import { requestLoginOtp } from '../../src/auth/auth-api';
import { FormErrorBanner } from '../../src/components/FormErrorBanner';
import { useConnectivity } from '../../src/connectivity/connectivity-context';

function normalizeIndianMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '');

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { isOffline } = useConnectivity();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  async function handleRequestOtp() {
    const phoneNumber = normalizeIndianMobile(mobileNumber);

    if (!phoneNumber) {
      setError('Enter a valid 10 digit Indian mobile number.');
      return;
    }

    setError(null);
    setDevOtp(null);
    setIsSubmitting(true);

    try {
      const response = await requestLoginOtp(phoneNumber);
      setDevOtp(response.otpForTesting ?? null);
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { devOtp: response.otpForTesting ?? '', phoneNumber },
      });
    } catch {
      setError('Could not send OTP. Please check the number and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen scrollable style={styles.screen}>
      <View style={styles.header}>
        <Text style={{ color: theme.colors.primary }} variant="headlineLarge">
          Tuljai Stays
        </Text>
        <Text variant="bodyLarge">Sign in to plan your Tuljapur stay.</Text>
      </View>

      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.form}>
          <TextInput
            keyboardType="phone-pad"
            label="Mobile number"
            mode="outlined"
            placeholder="9876543210"
            value={mobileNumber}
            onChangeText={setMobileNumber}
          />
          <FormErrorBanner message={error} />
          {devOtp ? (
            <Text style={{ color: theme.colors.primary }} variant="bodyMedium">
              Development OTP: {devOtp}
            </Text>
          ) : null}
          <Button
            disabled={isSubmitting || isOffline}
            loading={isSubmitting}
            mode="contained"
            onPress={() => {
              void handleRequestOtp();
            }}
          >
            Send OTP
          </Button>
          {isOffline ? (
            <Text variant="bodySmall">Connect to the internet to request OTP.</Text>
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
  header: {
    gap: spacing.sm,
  },
  screen: {
    gap: spacing.xl,
    justifyContent: 'center',
  },
});
