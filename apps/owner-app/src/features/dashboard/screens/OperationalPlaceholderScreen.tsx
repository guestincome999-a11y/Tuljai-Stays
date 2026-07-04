import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, spacing } from '@tuljai/ui';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';

interface OperationalPlaceholderScreenProps {
  description: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
}

export function OperationalPlaceholderScreen({
  description,
  icon,
  title,
}: OperationalPlaceholderScreenProps) {
  const assignedLodges = useAssignedLodges();
  const theme = useTheme();
  const lodgeName = assignedLodges.selectedLodge?.name ?? 'No lodge selected';

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.content}>
          <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={40} />
          <Text variant="headlineSmall">{title}</Text>
          <Text variant="bodyMedium">{description}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            Active lodge: {lodgeName}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  content: {
    gap: spacing.md,
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
