import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectivity } from '../connectivity/connectivity-context';

export function OfflineBanner() {
  const { isOffline } = useConnectivity();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!isOffline) {
    return null;
  }

  return (
    <Text
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.errorContainer,
          color: theme.colors.onErrorContainer,
          paddingTop: insets.top + 8,
        },
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
