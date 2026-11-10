'use client';

import { useState } from 'react';

import { cancelAdminBooking } from '../../api/refunds-api';
import { FinPanel } from '../finance/FinanceUi';

export function AdminCancellationPanel({
  bookingId,
  onCancelled,
}: {
  bookingId: string;
  onCancelled: () => Promise<void>;
}) {
  const [reason, setReason] = useState('Room Full');
  const [ticket, setTicket] = useState('');
  const [deduction, setDeduction] = useState('0');
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const support = reason === 'Pilgrim Support Request';
  async function cancel() {
    if (
      support &&
      (!ticket.trim() || !explanation.trim() || !/^\d+(\.\d{1,2})?$/.test(deduction))
    ) {
      setError('Enter the pilgrim support ticket, deduction amount and reason.');
      return;
    }
    if (
      !window.confirm(
        support
          ? `Cancel this booking with a ₹${deduction} deduction against the linked support ticket?`
          : 'Cancel this booking and automatically refund the full captured online payment?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await cancelAdminBooking(bookingId, {
        reason,
        ...(support
          ? {
              supportTicketId: ticket.trim(),
              deductionPaise: Math.round(Number(deduction) * 100),
              deductionReason: explanation.trim(),
            }
          : {}),
      });
      await onCancelled();
    } catch {
      setError(
        'Cancellation could not complete. Check the booking and support ticket before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <FinPanel title="Cancel and refund">
      <div className="fin-stack">
        <label>
          Cancellation reason
          <select className="fin-input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {[
              'Room Full',
              'Room Unavailable',
              'Lodge Unable to Accommodate',
              'Operational Issue',
              'Pilgrim Support Request',
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        {support ? (
          <>
            <label>
              Pilgrim support ticket ID
              <input
                className="fin-input"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
              />
            </label>
            <label>
              Deduction (₹)
              <input
                className="fin-input"
                inputMode="decimal"
                value={deduction}
                onChange={(e) => setDeduction(e.target.value)}
              />
            </label>
            <label>
              Deduction reason
              <textarea
                className="fin-input"
                maxLength={500}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </label>
          </>
        ) : (
          <p className="fin-note">
            No cancellation fee. The captured online payment is refunded to the original payment
            method. Pay-at-Lodge bookings do not call Razorpay.
          </p>
        )}
        {error ? <p role="alert">{error}</p> : null}
        <button className="fin-btn" disabled={busy} onClick={() => void cancel()}>
          {busy ? 'Cancelling…' : 'Confirm cancellation'}
        </button>
      </div>
    </FinPanel>
  );
}
