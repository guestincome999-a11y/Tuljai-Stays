'use client';

export function RefundStyles() {
  return (
    <style jsx global>{`
      .refund-records {
        min-width: 0;
      }
      .refund-details .fin-kv strong {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .refund-kpis {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
      .refund-records .fin-panel {
        padding: 22px;
      }
      .refund-record-count {
        background: var(--color-primary-soft);
        color: var(--color-primary);
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 0.75rem;
        font-weight: 750;
      }
      .refund-controls {
        background: var(--color-surface-subtle);
        border: 1px solid var(--color-outline);
        border-radius: 14px;
        padding: 16px;
      }
      .refund-search-row,
      .refund-filter-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .refund-search-row {
        margin-bottom: 15px;
      }
      .refund-search {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1 1 350px;
        min-width: 0;
        border: 1px solid var(--color-outline);
        border-radius: 10px;
        padding: 0 12px;
        background: #fff;
        box-shadow: 0 1px 3px rgba(15, 31, 61, 0.03);
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .refund-search:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-primary-soft);
      }
      .refund-search input {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--color-text);
        font: inherit;
        font-size: 0.82rem;
        box-shadow: none;
        padding: 0;
      }
      .refund-search input:focus-visible {
        outline: none;
      }
      .refund-search input::placeholder {
        color: var(--color-muted);
      }
      .refund-search-icon {
        display: flex;
        flex: 0 0 18px;
        color: var(--color-muted);
      }
      .refund-search-icon svg {
        width: 18px;
        height: 18px;
      }
      .refund-live-note {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--color-muted);
        font-size: 0.72rem;
        font-weight: 550;
      }
      .refund-live-note > span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-success-strong);
      }
      .refund-filter-label {
        color: var(--color-muted);
        font-size: 0.7rem;
        font-weight: 750;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .refund-filter-row .fin-filter {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
      }
      .refund-status-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex: 0 0 6px;
      }
      .refund-dot-orange {
        background: #e39a34;
      }
      .refund-dot-blue {
        background: #4b83e8;
      }
      .refund-dot-green {
        background: #18a46c;
      }
      .refund-dot-red {
        background: #e15b62;
      }
      .refund-dot-gray {
        background: #91a0b7;
      }
      .refund-clear {
        margin-left: auto;
        border: 0;
        background: transparent;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 6px 0;
      }
      .refund-results-meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 2px 12px;
        color: var(--color-muted);
        font-size: 0.73rem;
      }
      .refund-results-meta > span:first-child {
        color: var(--color-primary-strong);
        font-weight: 650;
      }
      .refund-table {
        min-width: 1120px;
      }
      .refund-table th {
        padding: 12px 14px;
      }
      .refund-table td {
        padding: 17px 14px;
        vertical-align: top;
      }
      .refund-booking-link {
        font-variant-numeric: tabular-nums;
        font-size: 0.82rem;
      }
      .refund-guest {
        margin-top: 6px;
      }
      .refund-booking-state {
        display: block;
        margin-top: 5px;
        color: var(--color-muted);
        font-size: 0.65rem;
      }
      .refund-lodge {
        display: block;
        font-size: 0.78rem;
        font-weight: 650;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .refund-reason {
        overflow-wrap: anywhere;
        max-width: 190px;
        white-space: normal;
        line-height: 1.5;
        margin-top: 5px;
      }
      .refund-reference {
        display: block;
        max-width: 170px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.65rem;
        margin-top: 7px;
      }
      .refund-amount {
        display: block;
        font-size: 0.92rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .refund-table .fin-num .fin-cell-sub {
        font-size: 0.65rem;
        margin-top: 6px;
      }
      .refund-activity > span {
        display: block;
        font-size: 0.69rem;
        margin-bottom: 5px;
      }
      .refund-activity small {
        display: inline-block;
        width: 56px;
        color: var(--color-muted);
        font-size: 0.62rem;
      }
      .refund-open {
        gap: 8px;
      }
      .refund-pager {
        padding-top: 18px;
        margin-top: 8px;
        border-top: 1px solid var(--color-outline);
      }
      .refund-bank-note {
        color: var(--color-muted);
        background: var(--color-surface-subtle);
        border-radius: 9px;
        font-size: 0.69rem;
        line-height: 1.6;
        padding: 10px 12px;
        margin: 16px 0 0;
      }
      .refund-empty {
        display: grid;
        justify-items: center;
        gap: 12px;
        padding: 48px 16px;
        text-align: center;
      }
      .refund-empty > span {
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 18px;
        background: var(--color-primary-soft);
        color: var(--color-primary);
        font-size: 1.75rem;
      }
      .refund-empty h3 {
        color: var(--color-primary-strong);
        font-size: 0.95rem;
        margin: 0;
      }
      .refund-empty p {
        color: var(--color-muted);
        font-size: 0.8rem;
        margin: 0 0 4px;
      }
      .refund-detail-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        background: var(--color-surface-subtle);
        border: 1px solid var(--color-outline);
        border-radius: 12px;
        padding: 18px;
        margin-bottom: 20px;
      }
      .refund-detail-summary strong {
        display: block;
        font-size: 1.5rem;
        color: var(--color-primary-strong);
        margin-top: 8px;
      }
      .refund-detail-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 18px 0;
      }
      .refund-detail-heading {
        font-size: 0.78rem;
        margin: 24px 0 12px;
        color: var(--color-primary-strong);
      }
      .refund-history-item {
        padding: 12px 14px;
        background: var(--color-surface-subtle);
        border-radius: 10px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        font-size: 0.75rem;
        color: var(--color-primary-strong);
      }
      .refund-history-item time {
        color: var(--color-muted);
        font-size: 0.7rem;
        margin-left: auto;
      }
      .refund-history-item code {
        font-size: 0.68rem;
        overflow-wrap: anywhere;
      }
      .refund-history-item p {
        width: 100%;
        margin: 0;
        color: var(--color-danger);
      }
      .refund-audit-item {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 0;
        border-bottom: 1px solid var(--color-outline);
        font-size: 0.73rem;
        color: var(--color-primary-strong);
      }
      .refund-audit-item time,
      .refund-audit-item small {
        color: var(--color-muted);
        font-size: 0.7rem;
      }
      .refund-visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @media (max-width: 1440px) {
        .refund-kpis {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (max-width: 760px) {
        .refund-records .fin-panel {
          padding: 16px;
        }
        .refund-controls {
          padding: 12px;
        }
        .refund-filter-label {
          width: 100%;
        }
        .refund-clear {
          margin-left: 0;
        }
        .refund-live-note {
          display: none;
        }
        .refund-results-meta > span:last-child {
          display: none;
        }
        .refund-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .refund-page-range {
          display: none;
        }
      }
      @media (max-width: 480px) {
        .refund-kpis {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
