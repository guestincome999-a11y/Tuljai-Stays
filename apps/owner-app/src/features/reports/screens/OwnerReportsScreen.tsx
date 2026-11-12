import { reportPeriod, validReportRange } from '@tuljai/shared';
import type { BookingReportRow, LodgeCommissionTransaction } from '@tuljai/types';
import { EmptyState } from '@tuljai/ui';
import { useLocalSearchParams } from 'expo-router';
import { memo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { radius, spacing } from '../../../owner-ui/theme';
import { exportOwnerBookingReportPdf } from '../api/owner-reports-api';
import { ReportDateField } from '../components/ReportDateField';
import { useOwnerReports } from '../hooks/useOwnerReports';
import { saveReportPdf } from '../utils/save-report-pdf';

type ReportFilters = { startDate: string; endDate: string; reportType: 'all' | 'completed' };

export function OwnerReportsScreen() {
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    ...reportPeriod('month'),
    reportType: 'completed',
  }));
  const [applied, setApplied] = useState(filters);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [tab, setTab] = useState('bookings');
  const reports = useOwnerReports(applied, applied.reportType);
  const theme = useTheme();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const revenueOnly = view === 'revenue-settlements';
  const settlementsOnly = view === 'settlements' || revenueOnly;
  const commission = reports.summary.estimatedCommission;
  const finance = reports.commissionFinance;
  const dirty = JSON.stringify(filters) !== JSON.stringify(applied);
  const valid = validReportRange(filters);
  async function exportPdf() {
    if (!reports.selectedLodge) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const pdf = await exportOwnerBookingReportPdf({
        ...applied,
        lodgeId: reports.selectedLodge.id,
      });
      await saveReportPdf(pdf);
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : 'PDF export failed. Please try again.',
      );
    } finally {
      setExporting(false);
    }
  }

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
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Icon source="chart-box-outline" size={32} color={theme.colors.onPrimary} />
        <Text variant="headlineSmall" style={{ color: theme.colors.onPrimary }}>
          {revenueOnly
            ? 'Revenue settlements'
            : settlementsOnly
              ? 'Commission payment history'
              : 'Reports & insights'}
        </Text>
        <Text style={{ color: theme.colors.onPrimary, opacity: 0.85 }} variant="bodyMedium">
          {revenueOnly
            ? 'Online revenue paid to your lodge by Tuljai Stays'
            : settlementsOnly
              ? 'Payments recorded as settled by Tuljai Stays'
              : `${reports.selectedLodge?.name ?? 'Your lodge'} · Your business, clearly in view.`}
        </Text>
      </View>

      {!settlementsOnly ? (
        <>
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium">Choose a reporting period</Text>
              <View style={styles.presetRow}>
                {(
                  [
                    ['today', 'Today'],
                    ['week', 'Last 7 days'],
                    ['month', 'This month'],
                    ['lastMonth', 'Last month'],
                  ] as const
                ).map(([period, label]) => {
                  const range = reportPeriod(period);
                  return (
                    <Chip
                      key={period}
                      selected={
                        filters.startDate === range.startDate && filters.endDate === range.endDate
                      }
                      onPress={() => setFilters({ ...filters, ...range })}
                    >
                      {label}
                    </Chip>
                  );
                })}
              </View>
              <View style={styles.dateRow}>
                <ReportDateField
                  label="From date"
                  value={filters.startDate}
                  onChange={(startDate) => setFilters({ ...filters, startDate })}
                />
                <ReportDateField
                  label="To date"
                  value={filters.endDate}
                  onChange={(endDate) => setFilters({ ...filters, endDate })}
                />
              </View>
              <SegmentedButtons
                value={filters.reportType}
                onValueChange={(reportType) => setFilters({ ...filters, reportType: reportType })}
                buttons={[
                  { value: 'completed', label: 'Completed stays' },
                  { value: 'all', label: 'All bookings' },
                ]}
              />
              <Text
                variant="bodySmall"
                style={{ color: valid ? theme.colors.onSurfaceVariant : theme.colors.error }}
              >
                {!valid
                  ? 'Start date must be on or before end date.'
                  : dirty
                    ? 'Apply your changes to update the report and PDF.'
                    : 'Booking creation dates · Both dates included · India Standard Time'}
              </Text>
              <Button
                icon="filter-check-outline"
                mode="contained"
                disabled={!valid || exporting}
                onPress={() => {
                  setApplied({ ...filters });
                  setExportMessage(null);
                }}
                style={styles.action}
                contentStyle={styles.actionContent}
              >
                Apply dates
              </Button>
            </Card.Content>
          </Card>
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Total bookings"
              value={reports.isLoading ? '—' : reports.summary.totalBookings.toString()}
            />
            <SummaryCard
              label="Booking amount"
              value={
                reports.isLoading
                  ? '—'
                  : `₹${reports.summary.estimatedRevenue.toLocaleString('en-IN')}`
              }
            />
            <SummaryCard
              label="Booking commission"
              value={reports.isLoading ? '—' : `₹${commission.toLocaleString('en-IN')}`}
            />
            <SummaryCard
              label="Completed stays"
              value={reports.isLoading ? '—' : reports.summary.completedBookings.toString()}
            />
          </View>
          <Card mode="outlined" style={[styles.card, { borderColor: theme.colors.primary }]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.exportHeading}>
                <Icon source="file-pdf-box" size={38} color={theme.colors.primary} />
                <View style={styles.titleBlock}>
                  <Text variant="titleMedium">Bookings & commission PDF</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Your Tuljai Stays template, ready to save and share.
                  </Text>
                </View>
              </View>
              <Text variant="bodySmall">
                {formatDate(applied.startDate)} – {formatDate(applied.endDate)} ·{' '}
                {applied.reportType === 'completed' ? 'Completed stays' : 'All bookings'}
              </Text>
              <Button
                icon="download"
                mode="contained"
                loading={exporting}
                disabled={
                  exporting ||
                  reports.isLoading ||
                  reports.isRefreshing ||
                  reports.isOffline ||
                  !!reports.errorMessage ||
                  dirty ||
                  reports.bookingRows.length === 0
                }
                onPress={() => void exportPdf()}
                style={styles.action}
                contentStyle={styles.actionContent}
              >
                {exporting ? 'Preparing PDF…' : 'Save or share PDF'}
              </Button>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Includes all {reports.bookingRows.length} matching bookings, with totals, branding,
                and page numbers.
              </Text>
              {exportMessage ? (
                <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>
                  {exportMessage}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
          <SegmentedButtons
            value={tab}
            onValueChange={setTab}
            buttons={[
              { value: 'bookings', label: 'Bookings', icon: 'calendar-check-outline' },
              { value: 'finance', label: 'Commission', icon: 'cash-check' },
            ]}
          />
        </>
      ) : null}

      {revenueOnly || (!settlementsOnly && tab === 'finance') ? (
        <Card mode="outlined" style={styles.commissionCard}>
          <Card.Content style={styles.commissionContent}>
            <Text variant="titleLarge">Revenue settlements</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Payments from Tuljai Stays to your lodge after deducting unpaid commission from online
              payments.
            </Text>
            {finance?.revenue ? (
              <View style={styles.commissionGrid}>
                <CommissionDetail
                  label="Balance Pay to Lodge"
                  value={`Rs. ${formatMoney(finance.revenue.balancePayable)}`}
                />
                <CommissionDetail
                  label="Revenue paid to lodge"
                  value={`Rs. ${formatMoney(finance.revenue.revenueSettled)}`}
                />
              </View>
            ) : null}
            {finance?.revenueSettlements ? (
              finance.revenueSettlements.length === 0 ? (
                <Text variant="bodySmall">No revenue settlements have been recorded yet.</Text>
              ) : (
                finance.revenueSettlements.map((settlement) => (
                  <View key={settlement.id} style={styles.settlementRow}>
                    <View style={styles.titleBlock}>
                      <Text variant="titleSmall">Rs. {formatMoney(settlement.amount)}</Text>
                      <Text variant="bodySmall">{settlement.paymentMethod.replace(/_/g, ' ')}</Text>
                      <Text variant="bodySmall">
                        {settlement.reference ?? 'No reference provided'}
                      </Text>
                      {settlement.notes ? (
                        <Text variant="bodySmall">{settlement.notes}</Text>
                      ) : null}
                    </View>
                    <Text variant="bodySmall">{formatDate(settlement.settledAt)}</Text>
                  </View>
                ))
              )
            ) : (
              <Text variant="bodySmall">
                {reports.isLoading
                  ? 'Loading revenue settlements…'
                  : 'Revenue settlements are unavailable. Pull down to retry.'}
              </Text>
            )}
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Settlement entries are recorded by Tuljai Stays and are read-only.
            </Text>
            <FormErrorBanner message={reports.financeError} />
          </Card.Content>
        </Card>
      ) : null}

      {!revenueOnly && (settlementsOnly || tab === 'finance') ? (
        <>
          <Card mode="outlined" style={styles.commissionCard}>
            <Card.Content style={styles.commissionContent}>
              <View style={styles.commissionHeader}>
                <View style={styles.titleBlock}>
                  <Text variant="titleLarge">
                    {settlementsOnly ? 'Settled commission payments' : 'Commission & Settlement'}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {settlementsOnly
                      ? 'This is a read-only record of commission payments marked settled by Tuljai Stays.'
                      : 'A transparent view of what is payable to Tuljai Stays, what has been settled, and which bookings generated the commission.'}
                  </Text>
                </View>
                <Chip icon="cash-check">₹{formatMoney(finance?.summary.outstanding)}</Chip>
              </View>

              {!settlementsOnly ? (
                <>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    All-time ledger · Independent of the booking date filters above.
                  </Text>
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
                </>
              ) : null}

              {finance ? (
                <>
                  {!settlementsOnly ? (
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
                            <CommissionTransactionRow
                              key={transaction.id}
                              transaction={transaction}
                            />
                          ))
                      )}
                    </>
                  ) : null}

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
                Settlement entries are recorded by Tuljai Stays. Owners can view the complete ledger
                and settlement history here but cannot alter accounting records.
              </Text>
            </Card.Content>
          </Card>
          <FormErrorBanner message={reports.financeError} />
        </>
      ) : null}

      <FormErrorBanner message={reports.errorMessage} />

      {reports.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!settlementsOnly &&
      tab === 'bookings' &&
      !reports.isLoading &&
      reports.bookingRows.length === 0 ? (
        <EmptyState
          title="No bookings in this period"
          description="Choose another date range or select all bookings to see more stays."
        />
      ) : null}

      {!settlementsOnly &&
      tab === 'bookings' &&
      !reports.isLoading &&
      !reports.errorMessage &&
      reports.bookingRows.length > 0 ? (
        <>
          <ReportTable title="Booking details" rows={reports.bookingRows} />
        </>
      ) : null}
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const filtered = rows.filter((row) =>
    `${row.bookingCode} ${row.guestName} ${row.lodgeName ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <Text variant="titleMedium">{title}</Text>
        <TextInput
          mode="outlined"
          label="Search bookings or guests"
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setPage(1);
          }}
          left={<TextInput.Icon icon="magnify" />}
        />
        {filtered.slice((currentPage - 1) * 12, currentPage * 12).map((row) => (
          <View key={`${title}-${row.bookingCode}`} style={styles.row}>
            <View style={styles.titleBlock}>
              <Text variant="titleSmall">{row.bookingCode}</Text>
              <Text variant="bodySmall">{row.guestName}</Text>
              <Text variant="bodySmall">{row.roomTypeName ?? row.lodgeName}</Text>
              <Text variant="bodySmall">
                {formatDate(row.checkInDate)} to {formatDate(row.checkOutDate)}
              </Text>
            </View>
            <View style={styles.amountBlock}>
              <Chip compact>{row.status.replaceAll('_', ' ')}</Chip>
              <Text variant="bodySmall">Rs. {formatMoney(row.totalAmount)}</Text>
            </View>
          </View>
        ))}
        {filtered.length === 0 ? (
          <Text variant="bodyMedium">No matching bookings.</Text>
        ) : (
          <View style={styles.pagination}>
            <Button
              mode="outlined"
              disabled={currentPage === 1}
              onPress={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Text>
              {currentPage} / {pages}
            </Text>
            <Button
              mode="outlined"
              disabled={currentPage === pages}
              onPress={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </View>
        )}
        <Text variant="bodySmall">
          {filtered.length} records · PDF includes the full applied report.
        </Text>
      </Card.Content>
    </Card>
  );
});

function formatMoney(value: string | null | undefined): string {
  if (value == null) return '—';
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    : value;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

const styles = StyleSheet.create({
  action: { borderRadius: 12 },
  actionContent: { minHeight: 50 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  exportHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
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
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  row: {
    borderBottomColor: '#D7DAD4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
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
