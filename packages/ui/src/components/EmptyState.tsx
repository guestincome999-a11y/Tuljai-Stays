import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { spacing } from '../theme';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function EmptyState({ title, description, actionLabel, onActionPress }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text variant="titleMedium">{title}</Text>
      <Text style={styles.description} variant="bodyMedium">
        {description}
      </Text>
      {actionLabel && onActionPress ? (
        <Button mode="contained" onPress={onActionPress}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 240,
    padding: spacing.lg,
  },
  description: {
    textAlign: 'center',
  },
});
