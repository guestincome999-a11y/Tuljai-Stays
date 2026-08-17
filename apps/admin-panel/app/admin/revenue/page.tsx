'use client';

import type { BookingReportRow, CommissionSummary, LodgeCommissionFinanceReport } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createLodgeCommissionSettlement,
  getLodgeCommissionFinanceReport,
  listBookingReport,
  listCommissionReport,
  voidLodgeCommissionTransaction,
} from '../../../src/api/admin-bi-api';
import {
  buildLodgeRankings,
  groupRevenueByDate,
  sumCommission,
  sumRevenue,
  toCurrency,
} from '../../../src/business-intelligence/bi-utils';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminRevenuePage() {
  const [rows, setRows] = useState<BookingReportRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionSummary[]>([]);
  const [selectedLodgeId, setSelectedLodgeId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<LodgeCommissionFinanceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rankings = useMemo(() => buildLodgeRankings(rows, commissions), [commissions, rows]);
  const revenueByDate = useMemo(() => groupRevenueByDate(rows), [rows]);
  const revenue = sumRevenue(rows);
  const commission = sumCommission(rows);

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

  const submitSettlement = async () => {
    if (!selectedLodgeId || !settlementAmount) return;
    const amount = Number(settlementAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Enter a valid settlement amount.');
      return;
    }

    setErrorMessage(null);
    setActionMessage(null);
    try {
      const updated = await createLodgeCommissionSettlement(selectedLodgeId, {
        amount,
        notes: settlementNotes || undefined,
        paymentMethod,
        reference: reference || undefined,
      });
      setSelectedReport(updated);
      setSettlementAmount('');
      setReference('');
      setSettlementNotes('');
      setActionMessage('Settlement recorded and matching commission transactions were updated.');
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Settlement could not be recorded.');
    }
  };

  const voidTransaction = async (ledgerId: string) => {
    if (!window.confirm('Void this outstanding commission transaction? This cannot be undone.')) return;
    try {
      await voidLodgeCommissionTransaction(ledgerId);
      if (selectedLodgeId) setSelectedReport(await getLodgeCommissionFinanceReport(selectedLodgeId));
      setActionMessage('Commission transaction marked as voided.');
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transaction could not be voided.');
    }
  };

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Revenue Intelligence</p>
            <h2>Revenue dashboard</h2>
            <p className="muted-copy">
              Revenue estimates, commission estimates, and lodge-level receivable/payable views with
              detailed transaction and settlement accounting.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {actionMessage ? <section className="success-banner">{actionMessage}</section> : null}

        <section className="grid grid-4">
          <Metric label="Revenue Estimate" value={toCurrency(revenue)} />
          <Metric label="Commission Earned" value={toCurrency(commission)} />
          <Metric label="Average Booking Value" value={toCurrency(rows.length ? revenue / rows.length : 0)} />
          <Metric label="Commission Receivable" value={toCurrency(commission)} />
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Daily Revenue</p>
            <div className="chart-bars">
              {Object.entries(revenueByDate).slice(0, 12).map(([date, value]) => (
                <div className="chart-row" key={date}>
                  <span>{date}</span>
                  <div><i style={{ width: `${Math.min((value / Math.max(revenue, 1)) * 100, 100)}%` }} /></div>
                  <strong>{toCurrency(value)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Revenue Foundations</p>
            <div className="feed-list">
              <Insight label="Revenue Today" value="Daily endpoint required" />
              <Insight label="Revenue Yesterday" value="Daily endpoint required" />
              <Insight label="Weekly Revenue" value={toCurrency(revenue)} />
              <Insight label="Monthly Revenue" value={toCurrency(revenue)} />
              <Insight label="Yearly Estimate" value="Forecast endpoint required" />
              <Insight label="Top Revenue Cities" value="Multi-city report required" />
            </div>
          </section>
        </section>

        <section className="table-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Lodge Commission Report</p>
              <p className="muted-copy">
                Open a lodge to see the complete finance report: booking revenue, commission rule,
                receivable, outstanding payable, settlements, and every ledger transaction.
              </p>
            </div>
          </div>
          <div className="admin-table bi-ranking-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span><span>Bookings</span><span>Revenue</span><span>Commission Receivable</span><span>Action</span>
            </div>
            {rankings.slice(0, 50).map((row) => (
              <div className="admin-table-row" key={row.lodgeId}>
                <span><strong>{row.lodgeId}</strong></span>
                <span>{row.bookings}</span>
                <span>{toCurrency(row.revenue)}</span>
                <span>{toCurrency(row.commission)}</span>
                <span>
                  <button className="button button-secondary" type="button" onClick={() => void openReport(row.lodgeId)}>
                    View report
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>

        {selectedLodgeId ? (
          <section className="panel" aria-label="Detailed lodge commission report">
            {reportLoading ? <p>Loading detailed finance report…</p> : null}
            {selectedReport ? (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Lodge Finance Report</p>
                    <h3>{selectedReport.lodgeName}</h3>
                    <p className="muted-copy">Lodge ID: {selectedReport.lodgeId}</p>
                  </div>
                  <button className="button button-secondary" type="button" onClick={() => setSelectedLodgeId(null)}>Close</button>
                </div>

                <div className="grid grid-4">
                  <Metric label="Booking Revenue" value={toCurrency(Number(selectedReport.summary.bookingRevenue))} />
                  <Metric label="Commission Earned" value={toCurrency(Number(selectedReport.summary.commissionReceivable))} />
                  <Metric label="Outstanding / Payable" value={toCurrency(Number(selectedReport.summary.outstanding))} />
                  <Metric label="Settled" value={toCurrency(Number(selectedReport.summary.settled))} />
                </div>

                <div className="grid grid-2">
                  <section className="panel">
                    <p className="eyebrow">Commission Rule</p>
                    <div className="feed-list">
                      <Insight label="Enabled" value={selectedReport.setting.commissionEnabled ? 'Yes' : 'No'} />
                      <Insight label="Type" value={selectedReport.setting.commissionType === 'FIXED_PER_BOOKING' ? 'Fixed per booking' : 'Percentage'} />
                      <Insight label="Rate" value={`${selectedReport.setting.commissionRatePercent}%`} />
                      <Insight label="Fixed amount" value={toCurrency(Number(selectedReport.setting.commissionFixedAmount))} />
                      <Insight label="Effective from" value={new Date(selectedReport.setting.effectiveFrom).toLocaleString('en-IN')} />
                    </div>
                  </section>

                  <section className="panel">
                    <p className="eyebrow">Record Settlement</p>
                    <div className="form-grid">
                      <label>Amount<input value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} inputMode="decimal" placeholder="0.00" /></label>
                      <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="BANK_TRANSFER">Bank transfer</option><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>
                      <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction / receipt reference" /></label>
                      <label>Notes<textarea value={settlementNotes} onChange={(event) => setSettlementNotes(event.target.value)} placeholder="Settlement notes" rows={3} /></label>
                    </div>
                    <button className="button button-primary" type="button" onClick={() => void submitSettlement()}>Record settlement</button>
                  </section>
                </div>

                <section className="table-panel">
                  <div className="section-heading"><p className="eyebrow">Commission Ledger</p></div>
                  <div className="admin-table">
                    <div className="admin-table-row admin-table-head"><span>Booking</span><span>Base</span><span>Rule</span><span>Commission</span><span>Status</span><span>Action</span></div>
                    {selectedReport.transactions.map((transaction) => (
                      <div className="admin-table-row" key={transaction.id}>
                        <span><strong>{transaction.bookingCode}</strong><small>{transaction.checkInDate} → {transaction.checkOutDate}</small></span>
                        <span>{toCurrency(Number(transaction.baseAmount))}</span>
                        <span>{transaction.commissionType === 'FIXED_PER_BOOKING' ? `Fixed ${toCurrency(Number(transaction.commissionFixedAmount))}` : `${transaction.commissionRatePercent}%`}</span>
                        <span>{toCurrency(Number(transaction.commissionAmount))}</span>
                        <span>{transaction.status}</span>
                        <span>{transaction.status === 'OUTSTANDING' ? <button className="button button-secondary" type="button" onClick={() => void voidTransaction(transaction.id)}>Void</button> : '—'}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="table-panel">
                  <div className="section-heading"><p className="eyebrow">Settlement History</p></div>
                  <div className="admin-table">
                    <div className="admin-table-row admin-table-head"><span>Date</span><span>Amount</span><span>Method</span><span>Reference</span><span>Notes</span></div>
                    {selectedReport.settlements.map((settlement) => (
                      <div className="admin-table-row" key={settlement.id}>
                        <span>{new Date(settlement.settledAt).toLocaleString('en-IN')}</span>
                        <span>{toCurrency(Number(settlement.amount))}</span>
                        <span>{settlement.paymentMethod}</span>
                        <span>{settlement.reference ?? '—'}</span>
                        <span>{settlement.notes ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="table-panel">
          <p className="eyebrow">Top Revenue Lodges</p>
          <div className="admin-table bi-ranking-table">
            <div className="admin-table-row admin-table-head"><span>Lodge</span><span>Bookings</span><span>Revenue</span><span>Commission</span><span>Score</span></div>
            {rankings.slice(0, 10).map((row) => (
              <div className="admin-table-row" key={row.lodgeId}>
                <span>{row.lodgeId}</span><span>{row.bookings}</span><span>{toCurrency(row.revenue)}</span><span>{toCurrency(row.commission)}</span><span>{Math.round(row.score)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="kpi-card"><span className="kpi-icon">INR</span><div><span className="kpi-label">{label}</span><strong>{value}</strong></div></div>;
}

function Insight({ label, value }: { label: string; value: string }) {
  return <article className="feed-item"><span>{label}</span><strong>{value}</strong></article>;
}
