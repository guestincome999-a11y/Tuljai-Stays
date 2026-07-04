import type { QrScanLogEntry } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useScanHistory } from '../hooks/useScanHistory';

type HistoryFilter = 'TODAY' | 'WEEK' | 'SUCCESS' | 'FAILED';

const filters: Array<{ label: string; value: HistoryFilter }> = [
  { label: 'Today', value: 'TODAY' },
  { label: 'This Week', value: 'WEEK' },
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Failed', value: 'FAILED' },
];

export function ScanHistoryScreen() {
  const [filter, setFilter] = useState<HistoryFilter>('TODAY');
  const history = useScanHistory(filter);
  const theme = useTheme();
  const visibleData =
    filter === 'FAILED' ? history.data.filter((item) => item.result !== 'SUCCESS') : history.data;

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void history.refresh();
          }}
          refreshing={history.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="headlineSmall">Scan History</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          QR scan attempts for this lodge
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filters}>
          {filters.map((item) => (
            <Button
              key={item.value}
              mode={filter === item.value ? 'contained' : 'outlined'}
              onPress={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </View>
      </ScrollView>

      <FormErrorBanner message={history.errorMessage} />
      {history.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!history.isLoading && visibleData.length === 0 ? (
        <EmptyState
          title="No scan history"
          description="Scan attempts matching this filter will appear here."
          actionLabel="Refresh"
          onActionPress={() => {
            void history.refresh();
          }}
        />
      ) : null}

      <View style={styles.list}>
        {visibleData.map((item) => (
          <ScanHistoryCard item={item} key={item.id} />
        ))}
      </View>
    </ScrollView>
  );
}

function ScanHistoryCard({ item }: { item: QrScanLogEntry }) {
  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text variant="titleMedium">{item.bookingCode ?? 'Unknown booking'}</Text>
            <Text variant="bodyMedium">{item.guestName ?? 'Guest details unavailable'}</Text>
          </View>
          <Chip>{formatStatus(item.result)}</Chip>
        </View>
        <Text variant="bodySmall">{new Date(item.createdAt).toLocaleString('en-IN')}</Text>
        {item.failureReason ? <Text variant="bodySmall">{item.failureReason}</Text> : null}
      </Card.Content>
    </Card>
  );
}

function formatStatus(status: string): string {
  if (status === 'SUCCESS') {
    return 'Success';
  }

  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  header: {
    gap: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
