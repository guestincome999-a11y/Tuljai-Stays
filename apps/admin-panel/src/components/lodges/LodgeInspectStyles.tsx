'use client';

/** Lodge Inspect extras. Layout, buttons, pills and tables come from FinanceStyles so the page matches the rest of the admin panel. */
export function LodgeInspectStyles() {
  return (
    <style jsx global>{`
      .li-head-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .li-back {
        align-items: center;
        color: var(--color-primary);
        display: inline-flex;
        font-size: 0.78rem;
        font-weight: 700;
        gap: 6px;
        margin-bottom: 8px;
        text-decoration: none;
      }
      .li-back:hover {
        text-decoration: underline;
      }
      .li-seg {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .li-seg .fin-btn {
        min-width: 0;
      }
      .fin-btn-active,
      .fin-btn-active:disabled {
        background: var(--color-navy);
        border-color: var(--color-navy);
        color: #fff;
        cursor: default;
        opacity: 1;
      }
      .fin-btn-green {
        background: #e3f6ec;
        border-color: #cdeedd;
        color: #0d7a54;
      }
      .fin-btn-green:hover:not(:disabled) {
        background: #16a368;
        border-color: #16a368;
        color: #fff;
      }
      .li-sub {
        color: var(--color-muted);
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 16px 0 8px;
        text-transform: uppercase;
      }
      .li-sub:first-child {
        margin-top: 0;
      }
      .li-ready {
        display: grid;
        gap: 8px;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .li-ready li {
        align-items: center;
        background: #fff5ea;
        border: 1px solid #fddfbd;
        border-radius: 10px;
        color: #8a4f06;
        display: flex;
        font-size: 0.8rem;
        font-weight: 600;
        gap: 10px;
        padding: 9px 12px;
      }
      .li-ready li::before {
        background: #f08a1c;
        border-radius: 50%;
        content: '';
        flex: 0 0 8px;
        height: 8px;
        width: 8px;
      }
      .li-ok {
        align-items: center;
        background: #ecf9f2;
        border: 1px solid #cdeedd;
        border-radius: 12px;
        color: #0d7a54;
        display: flex;
        font-size: 0.82rem;
        font-weight: 700;
        gap: 10px;
        padding: 12px 14px;
      }
      .li-amenities {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        max-height: 260px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .li-amenity {
        align-items: center;
        background: var(--color-surface-subtle);
        border: 1px solid var(--color-outline);
        border-radius: 10px;
        color: var(--color-primary-strong);
        cursor: pointer;
        display: flex;
        font-size: 0.78rem;
        font-weight: 600;
        gap: 8px;
        min-height: 38px;
        padding: 6px 10px;
      }
      .li-amenity input {
        accent-color: var(--color-primary);
        flex: 0 0 auto;
        height: 16px;
        width: 16px;
      }
      .li-amenity-on {
        background: #eaf1ff;
        border-color: #d3e1ff;
      }
      .li-select {
        background: #fff;
        border: 1px solid var(--color-outline);
        border-radius: 10px;
        color: var(--color-primary-strong);
        font-size: 0.78rem;
        font-weight: 600;
        min-height: 34px;
        padding: 0 10px;
      }
      .li-select:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        outline: none;
      }
      .li-photos {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      }
      .li-photo {
        background: #fff;
        border: 1px solid var(--color-outline);
        border-radius: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow: hidden;
        padding: 0 0 12px;
      }
      .li-photo img {
        aspect-ratio: 4 / 3;
        background: #eef2f8;
        display: block;
        object-fit: cover;
        width: 100%;
      }
      .li-photo-meta {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 6px 8px;
        justify-content: space-between;
        padding: 0 12px;
      }
      .li-photo-meta b {
        color: var(--color-primary-strong);
        font-size: 0.78rem;
        font-weight: 800;
      }
      .li-photo-actions {
        display: flex;
        gap: 8px;
        padding: 0 12px;
      }
      .li-photo-actions .fin-btn {
        flex: 1 1 0;
      }
      .li-photo-reason {
        color: var(--color-muted);
        font-size: 0.7rem;
        font-weight: 500;
        line-height: 1.4;
        padding: 0 12px;
      }
      .li-section-error {
        align-items: center;
        background: #fff0f0;
        border: 1px solid #f6d3d3;
        border-radius: 12px;
        color: #c8312f;
        display: flex;
        flex-wrap: wrap;
        font-size: 0.8rem;
        font-weight: 600;
        gap: 10px 14px;
        justify-content: space-between;
        padding: 12px 14px;
      }
      .li-link-row {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      @media (max-width: 640px) {
        .li-amenities {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `}</style>
  );
}
