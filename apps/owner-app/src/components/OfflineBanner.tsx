import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useConnectivity } from '../connectivity/connectivity-context';

export function OfflineBanner() {
  const { isOffline } = useConnectivity();
  const theme = useTheme();

  if (!isOffline) {
    return null;
  }

  return (
    <Text
      accessibilityRole="alert"
      style={[
        styles.banner,
        { backgroundColor: theme.colors.errorContainer, color: theme.colors.onErrorContainer },
      ]}
      variant="labelLarge"
    >
      You are offline
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
