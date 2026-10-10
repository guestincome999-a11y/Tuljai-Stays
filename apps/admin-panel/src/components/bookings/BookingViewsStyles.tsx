'use client';

/**
 * Booking-only additions on top of the shared finance look (FinanceStyles).
 * Pages, tables, pills, buttons and forms all use the `fin-*` classes; this file only adds
 * what bookings need on top: the filter grid, row actions, conflict cards, and the booking
 * detail layout (two-column grid, contact rows, tool rows, activity timeline).
 */
export function BookingViewsStyles() {
  return (
    <style jsx global>{`
      /* Filters and toolbar */
      .bk-filters { display: grid; gap: 14px; grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr)); }
      .bk-date-label { align-items: center; color: var(--color-muted); display: inline-flex; font-size: 0.74rem; font-weight: 700; gap: 8px; }
      .bk-date { background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 10px; color: var(--color-primary-strong); font-size: 0.78rem; min-height: 38px; padding: 0 10px; }
      .bk-date:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); outline: none; }

      /* Table cells that need to wrap instead of stretching the row */
      .fin-table td.bk-wrap { min-width: 180px; white-space: normal; }
      .fin-table td.bk-actions-cell { min-width: 240px; white-space: normal; }
      .bk-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
      .bk-danger { color: var(--color-danger); font-weight: 700; }
      .fin-filter:disabled { cursor: not-allowed; opacity: 0.45; }

      /* Banner with a dismiss button */
      .bk-banner-row { align-items: center; display: flex; gap: 12px; justify-content: space-between; }

      /* Conflict cards */
      .bk-conflicts { display: grid; gap: 12px; }
      .bk-conflict { border: 1px solid var(--color-outline); border-left: 4px solid #e5484d; border-radius: 14px; padding: 14px 16px; }
      .bk-conflict-warn { border-left-color: #f08a1c; }
      .bk-conflict-head { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 4px; }
      .bk-conflict h3 { color: var(--color-primary-strong); font-size: 0.9rem; font-weight: 800; margin: 0; }
      .bk-conflict p { color: var(--color-muted); font-size: 0.78rem; font-weight: 500; line-height: 1.5; margin: 0 0 10px; }
      .bk-conflict ul { display: grid; gap: 6px; list-style: none; margin: 0; padding: 0; }
      .bk-conflict li { align-items: center; color: var(--color-primary-strong); display: flex; flex-wrap: wrap; font-size: 0.78rem; gap: 10px; }

      /* Booking detail: main column + sidebar */
      .bk-layout { align-items: start; display: grid; gap: 16px; grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); }
      .bk-col { display: grid; gap: 16px; min-width: 0; }
      .bk-foot { margin: 14px 0 0; }
      .bk-label-gap { margin-top: 16px; }
      .bk-label { color: var(--color-primary-strong); display: block; font-size: 0.74rem; font-weight: 700; margin: 16px 0 8px; }

      /* Contact rows */
      .bk-contact-row { align-items: center; border-top: 1px solid var(--color-outline); display: flex; gap: 12px; justify-content: space-between; padding: 12px 0; }
      .bk-contact-row:first-of-type { border-top: 0; padding-top: 0; }
      .bk-contact-row span { color: var(--color-muted); display: block; font-size: 0.72rem; font-weight: 600; }
      .bk-contact-row strong { color: var(--color-primary-strong); display: block; font-size: 0.86rem; font-weight: 800; margin-top: 2px; }
      .bk-contact-actions { display: flex; flex: none; gap: 6px; }

      /* Operations tool rows */
      .bk-tool { align-items: center; border-top: 1px solid var(--color-outline); display: flex; gap: 12px; justify-content: space-between; padding: 12px 0; scroll-margin-top: 90px; }
      .bk-tool:first-child { border-top: 0; padding-top: 0; }
      .bk-tool strong { color: var(--color-primary-strong); display: block; font-size: 0.84rem; font-weight: 800; }
      .bk-tool p { color: var(--color-muted); font-size: 0.76rem; font-weight: 500; line-height: 1.45; margin: 2px 0 0; }

      /* Activity timeline */
      .bk-timeline { display: grid; }
      .bk-tl-item { display: grid; gap: 14px; grid-template-columns: 12px minmax(0, 1fr); padding-bottom: 18px; position: relative; }
      .bk-tl-item::before { background: var(--color-outline); bottom: 0; content: ''; left: 5px; position: absolute; top: 16px; width: 2px; }
      .bk-tl-item:last-child { padding-bottom: 0; }
      .bk-tl-item:last-child::before { display: none; }
      .bk-tl-dot { background: #7c4ddb; border-radius: 50%; height: 12px; margin-top: 3px; width: 12px; }
      .bk-tl-item strong { color: var(--color-primary-strong); font-size: 0.84rem; font-weight: 800; }
      .bk-tl-item p { color: var(--color-muted); font-size: 0.78rem; font-weight: 500; margin: 2px 0 4px; }
      .bk-tl-item small { color: var(--color-muted); font-size: 0.72rem; font-weight: 600; }

      @media (max-width: 1100px) {
        .bk-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .bk-layout { grid-template-columns: minmax(0, 1fr); }
      }
      @media (max-width: 640px) {
        .bk-filters { grid-template-columns: minmax(0, 1fr); }
      }
    `}</style>
  );
}
