import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export function FormErrorBanner({ message }: { message: string | null }) {
  const theme = useTheme();

  if (!message) {
    return null;
  }

  return (
    <Text
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
    padding: 12,
  },
});
