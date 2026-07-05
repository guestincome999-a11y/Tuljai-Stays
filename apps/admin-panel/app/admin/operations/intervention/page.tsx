'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { listAdminBookings } from '../../../../src/api/admin-bookings-api';
import { listQrScanLogs } from '../../../../src/api/live-operations-api';
import { buildInterventionItems, formatStatus } from '../../../../src/bookings/booking-operations';
import { PermissionGate } from '../../../../src/components/PermissionGate';

type QueueState =
  | { errorMessage: null; isLoading: true; items: ReturnType<typeof buildInterventionItems> }
  | {
      errorMessage: string | null;
      isLoading: false;
      items: ReturnType<typeof buildInterventionItems>;
    };

export default function AdminInterventionQueuePage() {
  const [state, setState] = useState<QueueState>({
    errorMessage: null,
    isLoading: true,
    items: [],
  });

  async function load() {
    setState((current) => ({ ...current, errorMessage: null, isLoading: true }));

    try {
      const [bookings, qrScans] = await Promise.all([
        listAdminBookings({ limit: 100 }),
        listQrScanLogs(),
      ]);
      setState({
        errorMessage: null,
        isLoading: false,
        items: buildInterventionItems(bookings.items, qrScans.items),
      });
    } catch {
      setState({
        errorMessage: 'Intervention queue could not be loaded. Please retry.',
        isLoading: false,
        items: [],
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(
    () => ({
      CRITICAL: state.items.filter((item) => item.priority === 'CRITICAL'),
      HIGH: state.items.filter((item) => item.priority === 'HIGH'),
      MEDIUM: state.items.filter((item) => item.priority === 'MEDIUM'),
      NORMAL: state.items.filter((item) => item.priority === 'NORMAL'),
    }),
    [state.items],
  );

  return (
    <PermissionGate permission="operations.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Operations Intervention</p>
            <h2>Manual intervention queue</h2>
            <p>
              Owner delays, overdue bookings, expired bookings, and QR failures sorted by priority.
            </p>
          </div>
          <button
            className="button button-primary"
            disabled={state.isLoading}
            type="button"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </section>

        {state.errorMessage ? (
          <section className="error-banner">{state.errorMessage}</section>
        ) : null}

        <section className="grid grid-4">
          {Object.entries(grouped).map(([priority, items]) => (
            <div className="panel" key={priority}>
              <p className="eyebrow">{formatStatus(priority)}</p>
              <h3>{items.length}</h3>
              <p className="muted-copy">Open items</p>
            </div>
          ))}
        </section>

        <section className="table-panel">
          <div className="admin-table intervention-table">
            <div className="admin-table-row admin-table-head">
              <span>Priority</span>
              <span>Reason</span>
              <span>Booking</span>
              <span>Lodge</span>
              <span>Guest</span>
              <span>Waiting</span>
              <span>Suggested Action</span>
              <span>Actions</span>
            </div>
            {state.items.length === 0 && !state.isLoading ? (
              <div className="empty-table">No intervention items detected.</div>
            ) : null}
            {state.items.map((item) => (
              <div className="admin-table-row" key={item.id}>
                <span className={`priority priority-${item.priority.toLowerCase()}`}>
                  {item.priority}
                </span>
                <span>{item.reason}</span>
                <span>{item.bookingCode}</span>
                <span>{item.lodgeName}</span>
                <span>{item.guestName}</span>
                <span>{item.waitingTime}</span>
                <span>{item.suggestedAction}</span>
                <span className="row-actions">
                  {item.bookingId ? (
                    <Link className="ghost-control" href={`/admin/bookings/${item.bookingId}`}>
                      Open Booking
                    </Link>
                  ) : null}
                  <button className="ghost-control" type="button">
                    Call Owner
                  </button>
                  <button className="ghost-control" type="button">
                    Call Pilgrim
                  </button>
                  <button className="ghost-control" type="button">
                    Add Note
                  </button>
                  <button className="ghost-control" type="button">
                    Escalate
                  </button>
                  <button className="ghost-control" type="button">
                    Transfer
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
