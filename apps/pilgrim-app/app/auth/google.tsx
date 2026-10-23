import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../../src/v2/core/auth';
import { useColors } from '../../src/v2/design/theme';
import { space } from '../../src/v2/design/tokens';
import { useGo } from '../../src/v2/shell/navigation';
import { Text } from '../../src/v2/ui/Text';

/** Landing screen for the Google sign-in redirect. It simply waits for the session, then moves on. */
export default function GoogleCallbackRoute() {
  const colors = useColors();
  const auth = useAuth();
  const { replace } = useGo();

  useEffect(() => {
    if (auth.ready && auth.signedIn) replace('/');
  }, [auth.ready, auth.signedIn, replace]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text align="center" variant="heading">
        Completing Google sign-in…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', flex: 1, gap: space.lg, justifyContent: 'center' },
});
