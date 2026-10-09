'use client';

import type {
  BookingReportRow,
  CommissionSummary,
  LodgeCommissionFinanceReport,
} from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createLodgeCommissionSettlement,
  getLodgeCommissionFinanceReport,
  listBookingReport,
  listCommissionReport,
  listLodgeCommissionOverview,
  voidLodgeCommissionTransaction,
} from '../../../src/api/admin-bi-api';
import {
  buildLodgeRankings,
  groupRevenueByDate,
  sumCommission,
  sumRevenue,
  toCurrency,
} from '../../../src/business-intelligence/bi-utils';
import { FinanceStyles } from '../../../src/components/finance/FinanceStyles';
import {
  FinBanners,
  FinHeader,
  FinKpi,
  FinKv,
  FinPanel,
  LedgerTable,
  RuleSummary,
  SettlementForm,
  SettlementHistoryTable,
} from '../../../src/components/finance/FinanceUi';
import type { SettlementFormValues } from '../../../src/components/finance/FinanceUi';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminRevenuePage() {
  const [rows, setRows] = useState<BookingReportRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionSummary[]>([]);
  const [lodgeNames, setLodgeNames] = useState<Map<string, string>>(new Map());
  const [selectedLodgeId, setSelectedLodgeId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<LodgeCommissionFinanceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [bookingResponse, commissionResponse] = await Promise.all([
        listBookingReport({ limit: 300 }),
        listCommissionReport(),
      ]);
      setRows(bookingResponse.items);
      setCommissions(commissionResponse);
    } catch {
      setErrorMessage('Revenue data could not be loaded.');
    }
    // Lodge names are a display nicety; the report still works with ids if this fails.
    try {
      const overview = await listLodgeCommissionOverview();
      setLodgeNames(new Map(overview.map((row) => [row.lodgeId, row.lodgeName])));
    } catch {
      setLodgeNames(new Map());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rankings = useMemo(() => buildLodgeRankings(rows, commissions), [commissions, rows]);
  const revenueByDate = useMemo(() => groupRevenueByDate(rows), [rows]);
  const revenue = sumRevenue(rows);
  const commission = sumCommission(rows);
  const dailyRows = Object.entries(revenueByDate).slice(0, 12);
  const maxDaily = Math.max(...dailyRows.map(([, value]) => value), 1);
  const lodgeLabel = (lodgeId: string) => lodgeNames.get(lodgeId) ?? lodgeId;

  const openReport = async (lodgeId: string) => {
    setSelectedLodgeId(lodgeId);
    setSelectedReport(null);
    setReportLoading(true);
    setActionMessage(null);
    try {
      setSelectedReport(await getLodgeCommissionFinanceReport(lodgeId));
    } catch {
      setErrorMessage('The lodge finance report could not be loaded.');
    } finally {
      setReportLoading(false);
    }
  };

  const submitSettlement = async (values: SettlementFormValues): Promise<boolean> => {
    if (!selectedLodgeId) return false;
    setErrorMessage(null);
    setActionMessage(null);
    try {
      const updated = await createLodgeCommissionSettlement(selectedLodgeId, values);
      setSelectedReport(updated);
      setActionMessage('Settlement recorded and matching commission transactions were updated.');
      await load();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Settlement could not be recorded.');
      return false;
    }
  };

  const voidTransaction = async (ledgerId: string) => {
    if (!window.confirm('Void this outstanding commission transaction? This cannot be undone.'))
      return;
    try {
      await voidLodgeCommissionTransaction(ledgerId);
      if (selectedLodgeId)
        setSelectedReport(await getLodgeCommissionFinanceReport(selectedLodgeId));
      setActionMessage('Commission transaction marked as voided.');
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transaction could not be voided.');
    }
  };

  return (
    <PermissionGate permission="finance.view">
      <div className="fin-stack">
        <FinanceStyles />
        <FinHeader
          actions={<button className="fin-btn fin-btn-soft" onClick={() => void load()} type="button">Refresh</button>}
          description="Revenue estimates, commission estimates, and lodge-level receivable/payable views with detailed transaction and settlement accounting."
          eyebrow="Revenue Intelligence"
          title="Revenue dashboard"
        />
        <FinBanners error={errorMessage} message={actionMessage} />

        <section aria-label="Revenue totals" className="fin-kpis">
          <FinKpi icon="money" label="Revenue estimate" meta={`${rows.length} bookings in report`} tone="blue" value={toCurrency(revenue)} />
          <FinKpi icon="percent" label="Commission earned" meta="Estimated from bookings" tone="green" value={toCurrency(commission)} />
          <FinKpi icon="receipt" label="Average booking value" meta="Revenue per booking" tone="orange" value={toCurrency(rows.length ? revenue / rows.length : 0)} />
          <FinKpi icon="bank" label="Commission receivable" meta="Owed by lodges" tone="purple" value={toCurrency(commission)} />
        </section>

        <section className="fin-split">
          <FinPanel sub="Most recent days in the report" title="Daily revenue">
            {dailyRows.length === 0 ? (
              <p className="fin-empty">No revenue recorded yet.</p>
            ) : (
              <div className="fin-bars">
                {dailyRows.map(([date, value]) => (
                  <div className="fin-bar-row" key={date}>
                    <span>{date}</span>
                    <div className="fin-bar-track"><i style={{ width: `${Math.min((value / maxDaily) * 100, 100)}%` }} /></div>
                    <strong>{toCurrency(value)}</strong>
                  </div>
                ))}
              </div>
            )}
          </FinPanel>

          <FinPanel sub="Totals from the booking report" title="Revenue foundations">
            <FinKv
              rows={[
                { label: 'Revenue today', value: 'Daily endpoint required' },
                { label: 'Revenue yesterday', value: 'Daily endpoint required' },
                { label: 'Weekly revenue', value: toCurrency(revenue) },
                { label: 'Monthly revenue', value: toCurrency(revenue) },
                { label: 'Yearly estimate', value: 'Forecast endpoint required' },
                { label: 'Top revenue cities', value: 'Multi-city report required' },
              ]}
            />
          </FinPanel>
        </section>

        <FinPanel sub="Open a lodge to see booking revenue, commission rule, receivable, outstanding payable, settlements, and every ledger transaction." title="Lodge commission report">
          {rankings.length === 0 ? (
            <p className="fin-empty">No lodge revenue to report yet.</p>
          ) : (
            <div className="fin-scroll">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Lodge</th>
                    <th className="fin-num">Bookings</th>
                    <th className="fin-num">Revenue</th>
                    <th className="fin-num">Commission receivable</th>
                    <th className="fin-num">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.slice(0, 50).map((row) => (
                    <tr key={row.lodgeId}>
                      <td><b>{lodgeLabel(row.lodgeId)}</b></td>
                      <td className="fin-num">{row.bookings}</td>
                      <td className="fin-num">{toCurrency(row.revenue)}</td>
                      <td className="fin-num">{toCurrency(row.commission)}</td>
                      <td className="fin-num">
                        <button className="fin-btn fin-btn-sm fin-btn-soft" onClick={() => void openReport(row.lodgeId)} type="button">View report</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FinPanel>

        {selectedLodgeId ? (
          <section aria-label="Detailed lodge commission report" className="fin-stack">
            {reportLoading ? <div aria-label="Loading" className="fin-skeleton" /> : null}
            {selectedReport ? (
              <>
                <FinHeader
                  actions={<button className="fin-btn fin-btn-outline" onClick={() => setSelectedLodgeId(null)} type="button">Close</button>}
                  description={`Lodge ID: ${selectedReport.lodgeId}`}
                  eyebrow="Lodge Finance Report"
                  title={selectedReport.lodgeName}
                />

                <section aria-label="Lodge totals" className="fin-kpis">
                  <FinKpi icon="receipt" label="Booking revenue" tone="blue" value={toCurrency(Number(selectedReport.summary.bookingRevenue))} />
                  <FinKpi icon="percent" label="Commission earned" tone="green" value={toCurrency(Number(selectedReport.summary.commissionReceivable))} />
                  <FinKpi icon="clock" label="Outstanding / payable" tone="orange" value={toCurrency(Number(selectedReport.summary.outstanding))} />
                  <FinKpi icon="check" label="Settled" tone="purple" value={toCurrency(Number(selectedReport.summary.settled))} />
                </section>

                <section className="fin-split">
                  <FinPanel sub="Active accounting rule" title="Commission rule">
                    <RuleSummary setting={selectedReport.setting} />
                  </FinPanel>
                  <FinPanel sub="Allocated against the oldest outstanding commission first" title="Record settlement">
                    <SettlementForm onSubmit={submitSettlement} />
                  </FinPanel>
                </section>

                <FinPanel title="Commission ledger">
                  <LedgerTable onVoid={(id) => void voidTransaction(id)} transactions={selectedReport.transactions} />
                </FinPanel>

                <FinPanel title="Settlement history">
                  <SettlementHistoryTable settlements={selectedReport.settlements} />
                </FinPanel>
              </>
            ) : null}
          </section>
        ) : null}

        <FinPanel sub="Ranked by revenue score" title="Top revenue lodges">
          {rankings.length === 0 ? (
            <p className="fin-empty">No lodge revenue to report yet.</p>
          ) : (
            <div className="fin-scroll">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Lodge</th>
                    <th className="fin-num">Bookings</th>
                    <th className="fin-num">Revenue</th>
                    <th className="fin-num">Commission</th>
                    <th className="fin-num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.slice(0, 10).map((row) => (
                    <tr key={row.lodgeId}>
                      <td><b>{lodgeLabel(row.lodgeId)}</b></td>
                      <td className="fin-num">{row.bookings}</td>
                      <td className="fin-num">{toCurrency(row.revenue)}</td>
                      <td className="fin-num">{toCurrency(row.commission)}</td>
                      <td className="fin-num">{Math.round(row.score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FinPanel>
      </div>
    </PermissionGate>
  );
}
