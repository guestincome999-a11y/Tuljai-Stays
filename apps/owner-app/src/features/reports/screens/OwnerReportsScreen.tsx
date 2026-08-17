import type { BookingReportRow } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { memo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Chip, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useOwnerReports } from '../hooks/useOwnerReports';

export function OwnerReportsScreen() {
  const reports = useOwnerReports();
  const theme = useTheme();
  const commission = reports.summary.estimatedCommission;

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void reports.refresh();
          }}
          refreshing={reports.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="headlineSmall">Owner Reports</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {reports.selectedLodge?.name ?? 'Assigned lodges'} - lightweight operational reports
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Today's Bookings" value={reports.summary.todayBookings.toString()} />
        <SummaryCard label="This Week" value={reports.summary.thisWeekBookings.toString()} />
        <SummaryCard label="Occupancy" value={`${reports.summary.occupancyEstimate}%`} />
        <SummaryCard
          label="Estimated Revenue"
          value={`Rs. ${reports.summary.estimatedRevenue.toLocaleString('en-IN')}`}
        />
        <SummaryCard
          label="Commission Payable"
          value={`Rs. ${commission.toLocaleString('en-IN')}`}
        />
        <SummaryCard label="Completed" value={reports.summary.completedBookings.toString()} />
        <SummaryCard
          label="Cancelled/Rejected"
          value={reports.summary.cancelledOrRejectedBookings.toString()}
        />
        <SummaryCard label="Check-ins/outs" value={reports.summary.checkInsCheckouts} />
      </View>

      <Card mode="outlined" style={styles.commissionCard}>
        <Card.Content style={styles.commissionContent}>
          <View style={styles.commissionHeader}>
            <View style={styles.titleBlock}>
              <Text variant="titleLarge">Commission</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Amount currently recorded as payable to Tuljai Stays from your report period.
              </Text>
            </View>
            <Chip icon="cash-check">Rs. {commission.toLocaleString('en-IN')}</Chip>
          </View>
          <View style={styles.commissionGrid}>
            <CommissionDetail label="Payable to Tuljai Stays" value={`Rs. ${commission.toLocaleString('en-IN')}`} />
            <CommissionDetail label="Receivable by Tuljai Stays" value={`Rs. ${commission.toLocaleString('en-IN')}`} />
            <CommissionDetail label="Settlement" value="Not tracked yet" />
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Payable and receivable are the same commission amount. Settlement status will only be
            shown once settlement tracking is enabled.
          </Text>
        </Card.Content>
      </Card>

      <FormErrorBanner message={reports.errorMessage} />

      {reports.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!reports.isLoading && reports.bookingRows.length === 0 ? (
        <EmptyState
          title="No report rows"
          description="Booking and register report rows will appear here when available."
        />
      ) : null}

      <ReportTable title="Booking Report" rows={reports.bookingRows} />
      <ReportTable title="Register Report" rows={reports.registerRows} />
    </ScrollView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <Card mode="outlined" style={styles.summaryCard}>
      <Card.Content style={styles.summaryContent}>
        <Text style={{ color: theme.colors.primary }} variant="titleLarge">
          {value}
        </Text>
        <Text variant="bodySmall">{label}</Text>
      </Card.Content>
    </Card>
  );
}

function CommissionDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.commissionDetail}>
      <Text variant="labelMedium">{label}</Text>
      <Text variant="titleMedium">{value}</Text>
    </View>
  );
}

const ReportTable = memo(function ReportTable({
  rows,
  title,
}: {
  rows: BookingReportRow[];
  title: string;
}) {
  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <Text variant="titleMedium">{title}</Text>
        {rows.slice(0, 12).map((row) => (
          <View key={`${title}-${row.bookingCode}`} style={styles.row}>
            <View style={styles.titleBlock}>
              <Text variant="titleSmall">{row.bookingCode}</Text>
              <Text variant="bodySmall">{row.guestName}</Text>
              <Text variant="bodySmall">
                {row.checkInDate} to {row.checkOutDate}
              </Text>
            </View>
            <View style={styles.amountBlock}>
              <Chip compact>{row.status.replaceAll('_', ' ')}</Chip>
              <Text variant="bodySmall">Rs. {formatMoney(row.totalAmount)}</Text>
            </View>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
});

function formatMoney(value: string | null): string {
  if (!value) {
    return '0';
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-IN') : value;
}

const styles = StyleSheet.create({
  amountBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  commissionCard: {
    borderRadius: radius.sm,
  },
  commissionContent: {
    gap: spacing.md,
  },
  commissionDetail: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 120,
  },
  commissionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  commissionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  header: {
    gap: spacing.xs,
  },
  row: {
    borderBottomColor: '#D7DAD4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  summaryCard: {
    borderRadius: radius.sm,
    flexBasis: '47%',
    flexGrow: 1,
  },
  summaryContent: {
    gap: spacing.xs,
    minHeight: 88,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
