
import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { spacing } from '../owner-ui/theme';

interface FormErrorBannerProps {
  message: string | null;
}

export function FormErrorBanner({ message }: FormErrorBannerProps) {
  const theme = useTheme();

  if (!message) {
    return null;
  }

  return (
    <Text
      accessibilityRole="alert"
      style={[
        styles.banner,
        { backgroundColor: theme.colors.errorContainer, color: theme.colors.onErrorContainer },
      ]}
      variant="bodyMedium"
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 8,
    padding: spacing.md,
  },
});
