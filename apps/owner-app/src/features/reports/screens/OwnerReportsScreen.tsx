import type { BookingReportRow, LodgeCommissionTransaction } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { memo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Chip, Divider, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useOwnerReports } from '../hooks/useOwnerReports';

export function OwnerReportsScreen() {
  const reports = useOwnerReports();
  const theme = useTheme();
  const commission = reports.summary.estimatedCommission;
  const finance = reports.commissionFinance;

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
          {reports.selectedLodge?.name ?? 'Assigned lodges'} - operational and finance reports
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
              <Text variant="titleLarge">Commission & Settlement</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                A transparent view of what is payable to Tuljai Stays, what has been settled, and
                which bookings generated the commission.
              </Text>
            </View>
            <Chip icon="cash-check">
              Rs. {formatMoney(finance?.summary.outstanding ?? String(commission))}
            </Chip>
          </View>

          <View style={styles.commissionGrid}>
            <CommissionDetail
              label="Total Commission"
              value={`Rs. ${formatMoney(finance?.summary.commissionReceivable)}`}
            />
            <CommissionDetail
              label="Outstanding / Payable"
              value={`Rs. ${formatMoney(finance?.summary.outstanding)}`}
            />
            <CommissionDetail
              label="Settled"
              value={`Rs. ${formatMoney(finance?.summary.settled)}`}
            />
            <CommissionDetail
              label="Recorded Settlements"
              value={`Rs. ${formatMoney(finance?.summary.totalSettlements)}`}
            />
          </View>

          {finance ? (
            <>
              <Divider />
              <Text variant="titleMedium">Commission transactions</Text>
              {finance.transactions.length === 0 ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  No commission transactions have been created yet.
                </Text>
              ) : (
                finance.transactions
                  .slice(0, 30)
                  .map((transaction) => (
                    <CommissionTransactionRow key={transaction.id} transaction={transaction} />
                  ))
              )}

              <Divider />
              <Text variant="titleMedium">Settlement history</Text>
              {finance.settlements.length === 0 ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  No settlements have been recorded yet.
                </Text>
              ) : (
                finance.settlements.slice(0, 20).map((settlement) => (
                  <View key={settlement.id} style={styles.settlementRow}>
                    <View style={styles.titleBlock}>
                      <Text variant="titleSmall">Rs. {formatMoney(settlement.amount)}</Text>
                      <Text variant="bodySmall">{settlement.paymentMethod}</Text>
                      <Text variant="bodySmall">
                        {settlement.reference ?? 'No reference provided'}
                      </Text>
                    </View>
                    <Text variant="bodySmall">{formatDate(settlement.settledAt)}</Text>
                  </View>
                ))
              )}
            </>
          ) : null}

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Settlement entries are recorded by Tuljai Stays. Owners can view the complete ledger and
            settlement history here but cannot alter accounting records.
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

function CommissionTransactionRow({ transaction }: { transaction: LodgeCommissionTransaction }) {
  return (
    <View style={styles.transactionRow}>
      <View style={styles.titleBlock}>
        <Text variant="titleSmall">{transaction.bookingCode}</Text>
        <Text variant="bodySmall">
          {transaction.commissionType === 'FIXED_PER_BOOKING'
            ? `Fixed Rs. ${formatMoney(transaction.commissionFixedAmount)}`
            : `${formatMoney(transaction.commissionRatePercent)}% commission`}
        </Text>
        <Text variant="bodySmall">
          Booking value Rs. {formatMoney(transaction.baseAmount)} - commission Rs.{' '}
          {formatMoney(transaction.commissionAmount)}
        </Text>
      </View>
      <View style={styles.amountBlock}>
        <Chip compact>{transaction.status}</Chip>
        <Text variant="bodySmall">{formatDate(transaction.eligibleAt)}</Text>
      </View>
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

function formatMoney(value: string | null | undefined): string {
  if (!value) return '0';
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    : value;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN');
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
  settlementRow: {
    alignItems: 'flex-start',
    borderBottomColor: '#D7DAD4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
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
  transactionRow: {
    borderBottomColor: '#D7DAD4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
});
