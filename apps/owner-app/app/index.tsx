import { AppScreen, spacing } from '@tuljai/ui';
import { Redirect } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../src/auth/auth-context';

export default function BootstrapScreen() {
  const { bootstrapComplete, isAuthenticated } = useAuth();
  const pulse = useRef(new Animated.Value(0.96)).current;
  const theme = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.in(Easing.quad),
          toValue: 0.96,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  if (bootstrapComplete) {
    return <Redirect href={isAuthenticated ? '/(app)/dashboard' : '/(auth)/login'} />;
  }

  return (
    <AppScreen style={styles.screen}>
      <Animated.View
        style={[
          styles.logo,
          { backgroundColor: theme.colors.primary, transform: [{ scale: pulse }] },
        ]}
      >
        <Text style={{ color: theme.colors.onPrimary }} variant="headlineMedium">
          TO
        </Text>
      </Animated.View>
      <View style={styles.brandMark}>
        <Text style={{ color: theme.colors.primary }} variant="displaySmall">
          Tuljai Stays Owner
        </Text>
        <Text style={styles.centerText} variant="titleMedium">
          लॉज व्यवस्थापनासाठी तुळजाई स्टेज
        </Text>
        <Text style={styles.centerText} variant="bodyLarge">
          Manage bookings, rooms and guest check-ins
        </Text>
      </View>
      <ActivityIndicator animating color={theme.colors.primary} size="large" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brandMark: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  logo: {
    alignItems: 'center',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  screen: {
    alignItems: 'center',
    gap: spacing.xl,
    justifyContent: 'center',
  },
});
