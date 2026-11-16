import { reportPeriod } from '@tuljai/shared';
import type {
  CommissionPaymentDetail,
  CommissionPaymentRecord,
  FinanceBooking,
  OwnerFinancePage,
  RevenueSettlementDetail,
} from '@tuljai/types';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  ScrollView,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  Icon,
  IconButton,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { ownerColors as c } from '../../../owner-ui/theme';
import { useRealtime } from '../../../realtime/realtime-provider';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import {
  cancelCommissionCheckout,
  commissionDetail,
  commissionReceipt,
  createCommissionOrder,
  exportFinance,
  exportRevenueSettlement,
  revenueSettlement,
  loadOwnerFinance,
  loadCommissionHistory,
  reconcileCommission,
  verifyCommission,
} from '../api/owner-finance-api';
import { ReportDateField } from '../components/ReportDateField';
import { commissionAmountPaise } from '../utils/commission-amount';
import { financeLoadError, receivedAmount, showEmptyFinance } from '../utils/finance-presentation';
import { saveReportPdf } from '../utils/save-report-pdf';

const money = (v: string | number | undefined) =>
  `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (v: string) =>
  new Date(v.length === 10 ? `${v}T00:00:00+05:30` : v).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Kolkata',
  });
const datetime = (v: string) => new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

export function OwnerFinanceScreen({
  mode,
  onBack,
}: {
  mode: 'revenue' | 'commission';
  onBack?: () => void;
}) {
  const assigned = useAssignedLodges();
  const lodgeId = assigned.selectedLodge?.id;
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const router = useRouter();
  const [preset, setPreset] = useState('All');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [day, setDay] = useState<string>();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OwnerFinancePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionRunning = useRef(false);
  const revision = useRef(0);
  const [summary, setSummary] = useState<
    (OwnerFinancePage['balance'] & { mode: 'FULL' | 'PARTIAL'; resumeAmountPaise?: number }) | null
  >(null);
  const [customAmount, setCustomAmount] = useState('');
  const [history, setHistory] = useState<{
    items: CommissionPaymentRecord[];
    totalItems: number;
    page: number;
  } | null>(null);
  const [payment, setPayment] = useState<CommissionPaymentDetail | null>(null);
  const [settlement, setSettlement] = useState<RevenueSettlementDetail | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const load = useCallback(async () => {
    const rev = ++revision.current;
    if (!lodgeId || isOffline) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await loadOwnerFinance(lodgeId, { ...range, day, page });
      if (revision.current === rev) {
        setData(next);
        setHistory(null);
      }
    } catch (e) {
      if (revision.current === rev) {
        setData(null);
        setError(financeLoadError(e));
      }
    } finally {
      if (revision.current === rev) setLoading(false);
    }
  }, [lodgeId, isOffline, range, day, page]);
  useEffect(() => {
    void load();
    return () => {
      revision.current++;
    };
  }, [load]);
  useEffect(() => {
    if (realtime.connectionRevision) void load();
  }, [load, realtime.connectionRevision]);
  useEffect(() => {
    if (realtime.lastEvent) void load();
  }, [load, realtime.lastEvent]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);
  const back = useCallback(() => {
    if (payment) {
      setPayment(null);
      return;
    }
    if (settlement) {
      setSettlement(null);
      return;
    }
    if (day) {
      setDay(undefined);
      setPage(1);
      return;
    }
    if (onBack) onBack();
    else router.back();
  }, [payment, settlement, day, onBack, router]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => sub.remove();
    }, [back]),
  );
  // Reconcile abandoned checkout on launch/reconnect. Poll only while a visible transaction awaits verification.
  const pendingId = data?.payments.find((p) =>
    ['PENDING', 'FAILED', 'CANCELLED'].includes(p.status),
  )?.id;
  useFocusEffect(
    useCallback(() => {
      if (!pendingId || isOffline) return;
      let active = true;
      const check = async () => {
        try {
          const p = await reconcileCommission(pendingId);
          if (active && ['SUCCESSFUL', 'RECOVERY_REQUIRED'].includes(p.status)) {
            setPayment(p);
            await load();
          }
        } catch {
          /* Keep the pending state until the server can verify. */
        }
      };
      void check();
      const timer = setInterval(() => void check(), 15000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [pendingId, isOffline, load]),
  );
  async function run(action: () => Promise<void>) {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Action unavailable. Check your connection and retry.',
      );
    } finally {
      actionRunning.current = false;
      setBusy(false);
    }
  }
  async function prepare(paymentMode: 'FULL' | 'PARTIAL' = 'FULL') {
    if (!lodgeId) return;
    await run(async () => {
      let latest = await loadOwnerFinance(lodgeId);
      const active = latest.payments.find((p) =>
        ['PENDING', 'FAILED', 'CANCELLED', 'RECOVERY_REQUIRED'].includes(p.status),
      );
      if (active) {
        const checked = await reconcileCommission(active.id);
        if (checked.status === 'RECOVERY_REQUIRED') {
          setPayment(checked);
          await load();
          return;
        }
        if (checked.status !== 'SUCCESSFUL') {
          setSummary({
            ...latest.balance,
            mode: checked.paymentType,
            resumeAmountPaise: checked.amountPaise,
          });
          setCustomAmount((checked.amountPaise / 100).toFixed(2));
          return;
        }
        latest = await loadOwnerFinance(lodgeId);
      }
      setSummary({ ...latest.balance, mode: paymentMode });
      setCustomAmount(paymentMode === 'FULL' ? Number(latest.balance.payable).toFixed(2) : '');
    });
  }
  const payablePaise = summary ? Math.round(Number(summary.payable) * 100) : 0;
  const selectedPaise =
    summary?.resumeAmountPaise ??
    (summary?.mode === 'FULL' ? payablePaise : commissionAmountPaise(customAmount));
  const invalidAmount = !selectedPaise || selectedPaise > payablePaise;
  async function pay() {
    if (!lodgeId || !summary || invalidAmount || !selectedPaise) return;
    const expected = selectedPaise;
    const paymentMode = summary.mode;
    setSummary(null);
    await run(async () => {
      const order = await createCommissionOrder(lodgeId, expected, paymentMode);
      if (order.status === 'SUCCESSFUL') {
        setPayment(await commissionDetail(order.id));
        await load();
        return;
      }
      if (!order.orderId || !order.keyId || order.status !== 'PENDING') {
        setPayment(await commissionDetail(order.id));
        await load();
        return;
      }
      try {
        const checkout = (await import('react-native-razorpay')).default;
        const result = await checkout.open({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          order_id: order.orderId,
          name: 'Tuljai Stays',
          description: `Commission · ${order.lodgeName}`,
          theme: { color: c.primary },
        });
        setPayment(
          await verifyCommission(order.id, {
            orderId: result.razorpay_order_id,
            paymentId: result.razorpay_payment_id,
            signature: result.razorpay_signature,
          }),
        );
      } catch (checkoutError) {
        // Checkout dismissal, SDK errors and connectivity loss are not authoritative payment outcomes.
        setError(
          'Checkout closed or interrupted. Your payment will be checked securely; you can retry the same order.',
        );
        try {
          const code = (checkoutError as { code?: number } | null)?.code;
          setPayment(
            await (code === 0 || code === 2
              ? cancelCommissionCheckout(order.id)
              : reconcileCommission(order.id)),
          );
        } catch {
          setPayment(await commissionDetail(order.id));
        }
      }
      await load();
    });
  }
  async function exportReport(format: string) {
    setExportOpen(false);
    if (!lodgeId) return;
    await run(async () => {
      const report = settlement
        ? await exportRevenueSettlement(lodgeId, settlement.id, format)
        : await exportFinance(lodgeId, { ...range, day, kind: mode, format });
      await saveReportPdf(report);
    });
  }
  async function openPayment(id: string) {
    await run(async () => setPayment(await commissionDetail(id)));
  }
  const title =
    mode === 'commission'
      ? 'Commission Settlement'
      : day
        ? 'Revenue Settlement Details'
        : 'Revenue Settlement';
  const items: {
    key: string;
    booking: FinanceBooking | null;
    day: OwnerFinancePage['days'][number] | null;
  }[] = day
    ? (data?.bookings ?? []).map((b) => ({ key: b.id, booking: b, day: null }))
    : (data?.days ?? []).map((d) => ({ key: d.date, day: d, booking: null }));
  const hasPending = !!pendingId;
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <IconButton icon="arrow-left" iconColor="white" onPress={back} accessibilityLabel="Back" />
        <Text style={s.title}>{title}</Text>
        <Button
          compact
          textColor="white"
          icon="download"
          mode="outlined"
          onPress={() =>
            payment
              ? void run(async () => {
                  await saveReportPdf(await commissionReceipt(payment.id));
                })
              : setExportOpen(true)
          }
          disabled={busy || !data || (!!payment && payment.status !== 'SUCCESSFUL')}
          labelStyle={{ color: '#FFFFFF' }}
          style={{ borderColor: '#FFFFFF70', opacity: busy || !data || (!!payment && payment.status !== 'SUCCESSFUL') ? 0.5 : 1 }}
        >
          Export
        </Button>
      </View>
      <FlatList
        data={payment || settlement ? [] : items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={s.content}
        refreshing={loading}
        onRefresh={() => void load()}
        ListHeaderComponent={
          <>
            {isOffline ? (
              <Text accessibilityRole="alert" style={s.notice}>
                Connect to view current balances and verify payments.
              </Text>
            ) : null}
            {error ? (
              <View style={s.card}>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
                <Button
                  icon="refresh"
                  mode="outlined"
                  disabled={loading || busy || isOffline}
                  onPress={() => void load()}
                >
                  Try again
                </Button>
              </View>
            ) : null}
            {!assigned.isLoading && !lodgeId && !isOffline ? (
              <View style={s.card}>
                <Text>
                  No lodge is available for financial records. Refresh your assigned lodges or
                  contact support.
                </Text>
                <Button
                  icon="refresh"
                  disabled={assigned.isRefreshing}
                  onPress={() => void assigned.refresh()}
                >
                  Refresh lodges
                </Button>
              </View>
            ) : null}
            {busy ? <ActivityIndicator style={s.space} /> : null}
            {payment ? (
              <>
                <View style={[s.card, payment.status === 'SUCCESSFUL' ? s.success : s.pink]}>
                  <Icon
                    source={payment.status === 'SUCCESSFUL' ? 'check-circle' : 'clock-outline'}
                    size={40}
                    color={payment.status === 'SUCCESSFUL' ? c.success : c.primary}
                  />
                  <Text variant="titleLarge">
                    {payment.status === 'SUCCESSFUL'
                      ? 'Payment Successful'
                      : payment.status === 'RECOVERY_REQUIRED'
                        ? 'Payment under review'
                        : payment.status === 'FAILED'
                          ? 'Payment Failed'
                          : payment.status === 'CANCELLED'
                            ? 'Checkout Cancelled'
                            : 'Processing / Pending Verification'}
                  </Text>
                  <Text>
                    {payment.status === 'SUCCESSFUL'
                      ? 'Your commission payment has been received by Tuljai Stays.'
                      : 'The balance will update only after server verification.'}
                  </Text>
                </View>
                <View style={s.card}>
                  <Label label="Amount paid / payable" value={money(payment.amountPaise / 100)} />
                  <Label
                    label="Payment type"
                    value={payment.paymentType === 'PARTIAL' ? 'Partial' : 'Full'}
                  />
                  <Label
                    label="Outstanding when order created"
                    value={
                      payment.outstandingBeforePaise === null
                        ? 'Not recorded'
                        : money(payment.outstandingBeforePaise / 100)
                    }
                  />
                  <Label
                    label="Remaining after verified payment"
                    value={
                      payment.remainingAfterPaise === null
                        ? 'Awaiting verification'
                        : money(payment.remainingAfterPaise / 100)
                    }
                  />
                  <Label
                    label="Current outstanding commission"
                    value={money(payment.currentOutstandingPaise / 100)}
                  />
                  <Label
                    label="Payment date & time (IST)"
                    value={
                      payment.verifiedAt ? datetime(payment.verifiedAt) : 'Awaiting verification'
                    }
                  />
                  <Label label="Transaction ID" value={payment.id} />
                  <Label
                    label="Razorpay Payment ID"
                    value={payment.paymentId ?? 'Awaiting gateway confirmation'}
                  />
                  <Label
                    label="Razorpay Order ID"
                    value={payment.orderId ?? 'Order confirmation pending'}
                  />
                  {payment.status === 'SUCCESSFUL' ? (
                    <Button
                      mode="contained"
                      icon="download"
                      disabled={busy || isOffline}
                      onPress={() =>
                        void run(async () => {
                          await saveReportPdf(await commissionReceipt(payment.id));
                        })
                      }
                    >
                      Download Receipt
                    </Button>
                  ) : (
                    <Button
                      disabled={busy || isOffline}
                      onPress={() =>
                        void run(async () => {
                          setPayment(await reconcileCommission(payment.id));
                          await load();
                        })
                      }
                    >
                      Check verified status
                    </Button>
                  )}
                </View>
                {['PENDING', 'FAILED', 'CANCELLED'].includes(payment.status) ? (
                  <Button
                    mode="contained"
                    disabled={busy || isOffline}
                    onPress={() => void prepare()}
                  >
                    Review / Resume Payment
                  </Button>
                ) : null}
                <Text variant="titleMedium">Related bookings · {payment.bookings.length}</Text>
                {payment.bookings.map((b) => (
                  <View key={b.ledgerId} style={s.row}>
                    <View style={s.flex}>
                      <Text>{b.bookingCode}</Text>
                      <Text style={s.muted}>
                        Paid on this transaction: {money(b.amountPaise / 100)}
                        {'\n'}Total paid: {money(b.totalPaidPaise / 100)} · Remaining:{' '}
                        {money(b.remainingPaise / 100)}
                      </Text>
                      <Text style={s.muted}>
                        {b.remainingPaise === 0
                          ? 'Fully Paid'
                          : b.totalPaidPaise > 0
                            ? 'Partially Paid'
                            : 'Payment Pending'}
                      </Text>
                    </View>
                    <Text style={s.commission}>{money(b.amountPaise / 100)}</Text>
                    <IconButton
                      icon="chevron-right"
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/bookings/[id]',
                          params: { id: b.bookingId },
                        })
                      }
                    />
                  </View>
                ))}
              </>
            ) : settlement ? (
              <>
                <View style={[s.card, s.success]}>
                  <Icon source="check-circle" color={c.success} size={42} />
                  <Text variant="titleLarge">Settlement Completed</Text>
                  <Text style={s.receiptHero}>{receivedAmount(settlement.amount)}</Text>
                  <Text>Revenue transferred to your lodge.</Text>
                </View>
                <Text variant="titleMedium">Settlement Details</Text>
                <View style={s.card}>
                  <Label
                    label="Settlement date & time (IST)"
                    value={datetime(settlement.settledAt)}
                  />
                  <Label
                    label="Payment Reference ID"
                    value={settlement.reference ?? 'Not recorded'}
                  />
                  <Label
                    label="Amount transferred"
                    value={receivedAmount(settlement.amount)}
                    received
                  />
                  <Label label="Commission deducted" value={money(settlement.commissionDeducted)} />
                  <Label label="Payment method" value={settlement.paymentMethod} />
                  <Label
                    label="Bank account (masked)"
                    value={
                      settlement.accountLast4
                        ? `${settlement.bankName ?? 'Bank'} **** ${settlement.accountLast4}`
                        : 'Not recorded in this settlement'
                    }
                  />
                </View>
                <Text variant="titleMedium">
                  Related commission bookings · {settlement.totalItems}
                </Text>
                {settlement.bookings.map((b) => (
                  <Pressable
                    key={b.bookingId}
                    style={s.row}
                    onPress={() =>
                      router.push({ pathname: '/(app)/bookings/[id]', params: { id: b.bookingId } })
                    }
                  >
                    <Text style={s.flex}>{b.bookingCode}</Text>
                    <Text style={s.commission}>{money(b.commission)}</Text>
                    <Icon source="chevron-right" color={c.primary} size={20} />
                  </Pressable>
                ))}
                <Button
                  disabled={busy || !lodgeId}
                  onPress={() =>
                    void run(async () => {
                      setSettlement(await revenueSettlement(lodgeId!, settlement.id, 1, 30));
                    })
                  }
                >
                  View All
                </Button>
                {settlement.totalItems > 30 ? (
                  <View style={s.row}>
                    <Button
                      disabled={settlement.page === 1 || busy}
                      onPress={() =>
                        void run(async () =>
                          setSettlement(
                            await revenueSettlement(
                              lodgeId!,
                              settlement.id,
                              settlement.page - 1,
                              30,
                            ),
                          ),
                        )
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      disabled={settlement.page * 30 >= settlement.totalItems || busy}
                      onPress={() =>
                        void run(async () =>
                          setSettlement(
                            await revenueSettlement(
                              lodgeId!,
                              settlement.id,
                              settlement.page + 1,
                              30,
                            ),
                          ),
                        )
                      }
                    >
                      Next
                    </Button>
                  </View>
                ) : null}
                <Text style={s.muted}>
                  Bookings linked to commission deducted in this transfer. Older transfers may not
                  have booking allocations.
                </Text>
                <Text style={s.notice}>
                  Commission is deducted from your booking revenue and settled to you.
                </Text>
                <Text>
                  Owner payments to Tuljai Stays are shown separately in Commission Payment History.
                </Text>
              </>
            ) : (
              <>
                <View style={s.filters}>
                  {['All', 'This Month', 'Last Month', 'Custom'].map((label) => (
                    <Chip
                      key={label}
                      selected={preset === label}
                      showSelectedCheck={false}
                      selectedColor={c.primary}
                      onPress={() => {
                        setPreset(label);
                        setDay(undefined);
                        setPage(1);
                        if (label === 'All') setRange({});
                        else setRange(reportPeriod(label === 'Last Month' ? 'lastMonth' : 'month'));
                      }}
                    >
                      {label}
                    </Chip>
                  ))}
                </View>
                {preset === 'Custom' ? (
                  <View style={s.row}>
                    <ReportDateField
                      label="From"
                      value={range.startDate!}
                      onChange={(v) => {
                        setRange({ ...range, startDate: v });
                        setPage(1);
                      }}
                    />
                    <ReportDateField
                      label="To"
                      value={range.endDate!}
                      onChange={(v) => {
                        setRange({ ...range, endDate: v });
                        setPage(1);
                      }}
                    />
                  </View>
                ) : null}
                {day ? (
                  <View style={[s.row, s.pink]}>
                    <Icon source="calendar" color={c.primary} size={30} />
                    <View style={s.flex}>
                      <Text variant="titleMedium">{date(day)}</Text>
                      <Text>{data?.summary.bookings ?? '—'} Bookings</Text>
                    </View>
                    <Text style={s.amount}>{data ? money(data.summary.revenue) : '—'}</Text>
                  </View>
                ) : (
                  <View style={[s.row, s.pink]}>
                    <View style={s.flex}>
                      <Text>Total Revenue</Text>
                      <Text style={s.amount}>{data ? money(data.summary.revenue) : '—'}</Text>
                    </View>
                    <View style={s.flex}>
                      <Text>Total Bookings</Text>
                      <Text variant="titleLarge">{data?.summary.bookings ?? '—'}</Text>
                    </View>
                  </View>
                )}
                {data ? (
                  <Text style={s.muted}>
                    Eligible booking revenue · Booked dates in IST. Online received{' '}
                    <Text style={s.received}>{receivedAmount(data.summary.onlineReceived)}</Text> ·
                    Lodge collections{' '}
                    <Text style={s.received}>{receivedAmount(data.summary.offlineReceived)}</Text>.
                    Failed and cancelled amounts excluded.
                  </Text>
                ) : null}
                {mode === 'commission' && data && !day ? (
                  <>
                    <View style={[s.card, s.pink]}>
                      <Text variant="titleMedium">Total Outstanding Commission</Text>
                      <Text style={s.commissionLarge}>{money(data.balance.payable)}</Text>
                      <Text>
                        {data.balance.bookings} contributing bookings · {data.balance.period}
                      </Text>
                      <Text>Previous unpaid balance: {money(data.balance.previousBalance)}</Text>
                      <Text>Total Commission Already Paid: {money(data.balance.paid)}</Text>
                      {data.balance.lastPaymentAt ? (
                        <Text>Last Payment: {datetime(data.balance.lastPaymentAt)}</Text>
                      ) : null}
                      <Text>
                        Status:{' '}
                        {hasPending
                          ? 'Pending Verification'
                          : Number(data.balance.payable) > 0
                            ? Number(data.balance.paid) > 0
                              ? 'Partially Paid'
                              : 'Payment Pending'
                            : 'Fully Paid'}
                      </Text>
                      <Button
                        mode="contained"
                        disabled={busy || isOffline || Number(data.balance.payable) <= 0}
                        onPress={() => void prepare('PARTIAL')}
                      >
                        Pay Partial Amount
                      </Button>
                      <Button
                        mode="outlined"
                        disabled={busy || isOffline || Number(data.balance.payable) <= 0}
                        onPress={() => void prepare('FULL')}
                      >
                        Pay Full Commission
                      </Button>
                      <Text style={s.muted}>
                        {hasPending
                          ? 'The interrupted payment is reconciled before continuing. '
                          : ''}
                        Pay any amount toward lodge-collected commission. Online commission is
                        deducted from revenue settlements.
                      </Text>
                    </View>
                    <View style={s.card}>
                      <Label
                        label="Commission deducted from revenue"
                        value={money(data.balance.deducted)}
                      />
                      <Label label="Commission paid by owner" value={money(data.balance.paid)} />
                      <Label
                        label="Revenue received by owner"
                        value={receivedAmount(data.balance.ownerReceived)}
                        received
                      />
                      <Label
                        label="Net revenue payable to owner"
                        value={money(data.balance.ownerPayable)}
                      />
                    </View>
                    <Text variant="titleMedium">Commission Payment History</Text>
                    {(history?.items ?? data.payments).length ? (
                      (history?.items ?? data.payments).map((p) => (
                        <View key={p.id} style={s.row}>
                          <Pressable
                            style={s.flex}
                            accessibilityRole="button"
                            onPress={() => void openPayment(p.id)}
                          >
                            <Text>
                              {date(p.verifiedAt ?? p.createdAt)} ·{' '}
                              {p.paymentType === 'PARTIAL' ? 'Partial' : 'Full'}
                            </Text>
                            <Text style={s.muted}>{p.status.replace(/_/g, ' ')}</Text>
                            <Text numberOfLines={1}>{p.id}</Text>
                            {p.remainingAfterPaise !== null ? (
                              <Text style={s.muted}>
                                Remaining after payment: {money(p.remainingAfterPaise / 100)}
                              </Text>
                            ) : null}
                          </Pressable>
                          <Text style={s.commission}>{money(p.amountPaise / 100)}</Text>
                          {p.status === 'SUCCESSFUL' ? (
                            <IconButton
                              icon="download"
                              accessibilityLabel="Download payment receipt"
                              disabled={busy || isOffline}
                              onPress={() =>
                                void run(async () => saveReportPdf(await commissionReceipt(p.id)))
                              }
                            />
                          ) : null}
                        </View>
                      ))
                    ) : (
                      <Text>No commission payments yet.</Text>
                    )}
                    {data.paymentTotalItems > 30 ? (
                      <View style={s.row}>
                        <Button
                          disabled={busy || (history?.page ?? 1) === 1}
                          onPress={() =>
                            void run(async () => {
                              setHistory(
                                await loadCommissionHistory(lodgeId!, (history?.page ?? 1) - 1),
                              );
                            })
                          }
                        >
                          Previous payments
                        </Button>
                        <Text>Page {history?.page ?? 1}</Text>
                        <Button
                          disabled={
                            busy ||
                            (history?.page ?? 1) * 30 >=
                              (history?.totalItems ?? data.paymentTotalItems)
                          }
                          onPress={() =>
                            void run(async () => {
                              setHistory(
                                await loadCommissionHistory(lodgeId!, (history?.page ?? 1) + 1),
                              );
                            })
                          }
                        >
                          Next payments
                        </Button>
                      </View>
                    ) : null}
                  </>
                ) : null}
                {!day && data?.settlements.length ? (
                  <>
                    <Text variant="titleMedium">Revenue received</Text>
                    {data.settlements.map((p) => (
                      <Pressable
                        accessibilityRole="button"
                        key={p.id}
                        style={s.row}
                        onPress={() =>
                          void run(async () => {
                            setSettlement(await revenueSettlement(lodgeId!, p.id, 1, 3));
                          })
                        }
                      >
                        <View style={s.flex}>
                          <Text>{date(p.settledAt)}</Text>
                          <Text style={s.muted}>Settlement Completed</Text>
                        </View>
                        <Text style={s.receivedLarge}>{receivedAmount(p.amount)}</Text>
                        <Icon source="chevron-right" color={c.primary} size={20} />
                      </Pressable>
                    ))}
                  </>
                ) : null}
                <Text variant="titleMedium" style={s.space}>
                  {day
                    ? mode === 'commission'
                      ? 'Booking-wise Commission Details'
                      : 'Booking-wise Details'
                    : 'Date-wise Settlement'}
                </Text>
              </>
            )}
          </>
        }
        renderItem={({ item }) =>
          item.day ? (
            <Pressable
              style={s.row}
              accessibilityRole="button"
              accessibilityLabel={`View bookings for ${date(item.day.date)}`}
              onPress={() => {
                setDay(item.day!.date);
                setPage(1);
              }}
            >
              <View style={s.icon}>
                <Icon source="calendar" color={c.primary} size={24} />
              </View>
              <View style={s.flex}>
                <Text variant="titleSmall">{date(item.day.date)}</Text>
                <Text style={s.muted}>{item.day.bookings} Bookings</Text>
              </View>
              <View>
                <Text style={s.amount}>{money(item.day.revenue)}</Text>
                {mode === 'commission' ? (
                  <Text style={s.commission}>{money(item.day.commission)}</Text>
                ) : null}
              </View>
              <Icon source="chevron-right" color={c.primary} size={24} />
            </Pressable>
          ) : item.booking ? (
            <View style={s.row}>
              {item.booking.thumbnail ? (
                <Image source={{ uri: item.booking.thumbnail }} style={s.thumbnail} />
              ) : (
                <View style={[s.thumbnail, s.icon]}>
                  <Icon source="bed-outline" size={28} color={c.primary} />
                </View>
              )}
              <View style={s.flex}>
                <Text variant="titleSmall">{item.booking.bookingCode}</Text>
                <Text>{item.booking.guestName}</Text>
                <Text style={s.muted}>
                  Booked:{' '}
                  {new Date(item.booking.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Kolkata',
                  })}
                </Text>
                <Text style={s.muted}>{item.booking.status.replace(/_/g, ' ')}</Text>
              </View>
              <View style={s.right}>
                <Text
                  variant="titleMedium"
                  style={
                    mode === 'revenue' && Number(item.booking.receivedAmount ?? 0) > 0
                      ? s.received
                      : undefined
                  }
                >
                  {mode === 'revenue' && Number(item.booking.receivedAmount ?? 0) > 0
                    ? receivedAmount(item.booking.receivedAmount)
                    : money(item.booking.amount)}
                </Text>
                {mode === 'commission' ? (
                  <Text style={s.badge}>{money(item.booking.commission)}</Text>
                ) : (
                  <Chip
                    compact
                    selectedColor={
                      item.booking.paymentStatus === 'FULLY_PAID' ? c.success : c.warning
                    }
                  >
                    {item.booking.paymentStatus === 'FULLY_PAID'
                      ? 'Paid'
                      : item.booking.paymentStatus === 'PAY_AT_LODGE'
                        ? 'Pay at Lodge'
                        : item.booking.paymentStatus.replace(/_/g, ' ')}
                  </Chip>
                )}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          showEmptyFinance({
            loading: loading || assigned.isLoading,
            hasData: !!data,
            hasError: !!error,
          }) &&
          !payment &&
          !settlement ? (
            <Text style={s.notice}>
              {isOffline
                ? 'Financial records require a connection.'
                : 'No bookings for this period.'}
            </Text>
          ) : null
        }
        ListFooterComponent={
          !payment && !settlement ? (
            <>
              {loading || assigned.isLoading ? <ActivityIndicator style={s.space} /> : null}
              {data ? (
                <>
                  <View style={[s.row, s.pink]}>
                    <View style={s.flex}>
                      <Text>Total Bookings</Text>
                      <Text variant="titleLarge">{data.summary.bookings}</Text>
                    </View>
                    <View style={s.flex}>
                      <Text>Total Revenue</Text>
                      <Text style={s.amount}>{money(data.summary.revenue)}</Text>
                    </View>
                  </View>
                  {mode === 'commission' ? (
                    <Label label="Total Commission" value={money(data.summary.commission)} />
                  ) : null}
                  <View style={s.row}>
                    <Button disabled={page === 1 || loading} onPress={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <Text style={s.flex}>Page {page}</Text>
                    <Button
                      disabled={page * 30 >= data.totalItems || loading}
                      onPress={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </View>
                </>
              ) : null}
              <View style={s.temple}>
                <Icon source="temple-hindu" size={80} color="#ECC6A2" />
                <Text style={s.muted}>Tuljai Stays · Transparent settlements</Text>
              </View>
            </>
          ) : null
        }
      />
      <Portal>
        <Dialog visible={!!summary} onDismiss={() => setSummary(null)}>
          <Dialog.Title>
            {summary?.resumeAmountPaise
              ? 'Resume Commission Payment'
              : summary?.mode === 'PARTIAL'
                ? 'Pay Partial Commission'
                : 'Pay Full Commission'}
          </Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 420 }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: 12 }}
            >
              <Text>{data?.lodgeName}</Text>
              <Label label="Total Outstanding Commission" value={money(summary?.payable)} />
              <Label label="Amount Already Paid" value={money(summary?.paid)} />
              <Label label="Amount Remaining" value={money(summary?.payable)} />
              {summary?.mode === 'PARTIAL' && !summary.resumeAmountPaise ? (
                <>
                  <TextInput
                    mode="outlined"
                    label="Custom Amount (INR)"
                    keyboardType="decimal-pad"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    maxLength={16}
                    left={<TextInput.Affix text="₹" />}
                  />
                  <View style={s.filters}>
                    {[
                      ...new Set(
                        [0.25, 0.5, 0.75].map((f) => Math.max(1, Math.floor(payablePaise * f))),
                      ),
                    ]
                      .filter((p) => p <= payablePaise)
                      .map((p) => (
                        <Chip key={p} onPress={() => setCustomAmount((p / 100).toFixed(2))}>
                          {money(p / 100)}
                        </Chip>
                      ))}
                  </View>
                  {customAmount && invalidAmount ? (
                    <Text accessibilityRole="alert" style={s.error}>
                      Enter an amount greater than ₹0, with at most two decimal places, within your
                      outstanding balance.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {summary?.resumeAmountPaise ? (
                <Text style={s.notice}>
                  An interrupted payment must be verified or resumed at its original amount before
                  starting another payment.
                </Text>
              ) : null}
              <Label label="Pay now" value={money((selectedPaise ?? 0) / 100)} />
              <Label
                label="Remaining after verification"
                value={money(Math.max(payablePaise - (selectedPaise ?? 0), 0) / 100)}
              />
              <Text>
                {summary?.bookings} bookings · {summary?.period}
              </Text>
              <Text>Payable to Tuljai Stays. Your balance updates after secure verification.</Text>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSummary(null)}>Cancel</Button>
            <Button disabled={busy || isOffline || invalidAmount} onPress={() => void pay()}>
              Continue to Pay
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={exportOpen} onDismiss={() => setExportOpen(false)}>
          <Dialog.Title>
            Export {mode === 'commission' ? 'Commission' : 'Revenue'} Settlement
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              All matching bookings for{' '}
              {day ?? `${range.startDate ?? 'all dates'} – ${range.endDate ?? 'present'}`}, with
              totals.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => void exportReport('csv')}>CSV</Button>
            <Button onPress={() => void exportReport('pdf')}>PDF</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
function Label({
  label,
  value,
  received = false,
}: {
  label: string;
  value: string;
  received?: boolean;
}) {
  return (
    <View style={s.label}>
      <Text style={s.muted}>{label}</Text>
      <Text selectable variant="titleSmall" style={received ? s.received : undefined}>
        {value}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream },
  header: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingVertical: 10,
  },
  title: { flex: 1, color: 'white', fontSize: 17, fontWeight: '700' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E6E7',
    borderRadius: 16,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  card: {
    padding: 16,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  pink: { backgroundColor: '#FBE7E9' },
  success: { backgroundColor: c.successSoft },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', maxWidth: '35%', gap: 8 },
  amount: { color: c.success, fontSize: 18, fontWeight: '700' },
  received: { color: '#168342', fontWeight: '700' },
  receivedLarge: { color: '#168342', fontSize: 20, fontWeight: '700' },
  receiptHero: { color: '#168342', fontSize: 30, lineHeight: 38, fontWeight: '700' },
  commission: { color: c.primary, fontWeight: '700' },
  commissionLarge: { color: c.primary, fontSize: 28, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 12, lineHeight: 18 },
  icon: { backgroundColor: c.blush, borderRadius: 24, padding: 10 },
  thumbnail: {
    width: 58,
    height: 64,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    color: c.primary,
    backgroundColor: '#FCE3E5',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: '700',
  },
  label: { paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border, gap: 4 },
  notice: {
    padding: 14,
    backgroundColor: c.warningSoft,
    borderRadius: 12,
    color: c.deep,
    marginVertical: 8,
  },
  error: { color: c.error, padding: 10 },
  space: { marginVertical: 12 },
  temple: { alignItems: 'center', paddingTop: 16, opacity: 0.7 },
});
