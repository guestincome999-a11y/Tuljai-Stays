import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';

import { spacing } from '../theme';

export interface AppScreenProps extends PropsWithChildren {
  scrollable?: boolean;
  style?: ViewStyle;
}

export function AppScreen({ children, scrollable = false, style }: AppScreenProps) {
  const theme = useTheme();
  const contentStyle = [styles.container, { backgroundColor: theme.colors.background }, style];

  if (scrollable) {
    return (
      <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    );
  }

  return <View style={contentStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
  },
});
