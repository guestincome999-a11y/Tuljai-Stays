'use client';

/** Shared look for the booking views (same tokens and card style as the dashboard and finance pages). */
export function BookingViewsStyles() {
  return (
    <style jsx global>{`
      .bv-stack { display: grid; gap: 16px; }
      .bv-note { background: var(--color-primary-soft); border: 1px solid #d3e1ff; border-radius: 12px; color: var(--color-primary-strong); font-size: 0.78rem; font-weight: 600; padding: 10px 14px; }
      .bv-panel { background: #fff; border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: var(--shadow-soft); min-width: 0; padding: 18px 20px; }
      .bv-toolbar { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
      .bv-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .bv-filter { background: #fff; border: 1px solid var(--color-outline); border-radius: 999px; color: var(--color-primary-strong); cursor: pointer; font-size: 0.76rem; font-weight: 700; padding: 7px 13px; transition: background 140ms ease; }
      .bv-filter:hover { background: var(--color-surface-muted); }
      .bv-filter-active, .bv-filter-active:hover { background: var(--color-accent-soft); border-color: #ffd3b3; color: var(--color-accent); }
      .bv-date { background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 10px; font-size: 0.78rem; min-height: 36px; padding: 0 10px; }
      .bv-date-label { color: var(--color-muted); font-size: 0.74rem; font-weight: 700; }
      .bv-search { background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 12px; font-size: 0.82rem; margin-left: auto; min-height: 38px; min-width: 260px; padding: 0 12px; }
      .bv-search:focus, .bv-date:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); outline: none; }
      .bv-scroll { overflow-x: auto; }
      .bv-table { border-collapse: collapse; font-size: 0.8rem; width: 100%; }
      .bv-table th { color: var(--color-muted); font-size: 0.72rem; font-weight: 700; padding: 8px; text-align: left; white-space: nowrap; }
      .bv-table td { border-top: 1px solid var(--color-outline); padding: 12px 8px; white-space: nowrap; }
      .bv-table tr:hover td { background: var(--color-surface-subtle); }
      .bv-num { text-align: right !important; }
      .bv-link { color: var(--color-primary); font-weight: 700; }
      .bv-link:hover { text-decoration: underline; }
      .bv-sub { color: var(--color-muted); display: block; font-size: 0.72rem; font-weight: 500; margin-top: 2px; }
      .bv-pill { border-radius: 999px; display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 4px 11px; }
      .bv-pill-green { background: #e3f6ec; color: #0d7a54; }
      .bv-pill-blue { background: #e7efff; color: #1d4fd1; }
      .bv-pill-purple { background: #f0e9ff; color: #6a3fd0; }
      .bv-pill-red { background: #ffe9e9; color: #c8312f; }
      .bv-pill-orange { background: #fff0dd; color: #b86a0a; }
      .bv-btn { background: #eaf1ff; border: 0; border-radius: 10px; color: var(--color-primary); cursor: pointer; font-size: 0.76rem; font-weight: 700; padding: 8px 14px; }
      .bv-btn:hover { background: var(--color-primary); color: #fff; }
      .bv-btn:disabled { cursor: not-allowed; opacity: 0.5; }
      .bv-pager { align-items: center; display: flex; gap: 12px; justify-content: flex-end; margin-top: 14px; }
      .bv-pager span { color: var(--color-muted); font-size: 0.78rem; font-weight: 600; }
      .bv-empty { color: var(--color-muted); font-size: 0.86rem; padding: 22px 0; text-align: center; }
      .bv-skeleton { background: linear-gradient(90deg, #eef2f8, #f6f8fc, #eef2f8); border-radius: 12px; height: 180px; }
      .bv-conflicts { display: grid; gap: 12px; }
      .bv-conflict { border: 1px solid var(--color-outline); border-left: 4px solid #e5484d; border-radius: 14px; padding: 14px 16px; }
      .bv-conflict-warn { border-left-color: #f08a1c; }
      .bv-conflict h3 { color: var(--color-primary-strong); font-size: 0.9rem; margin: 0 0 4px; }
      .bv-conflict p { color: var(--color-muted); font-size: 0.78rem; font-weight: 500; margin: 0 0 10px; }
      .bv-conflict ul { display: grid; gap: 6px; list-style: none; margin: 0; padding: 0; }
      .bv-conflict li { align-items: center; display: flex; flex-wrap: wrap; font-size: 0.78rem; gap: 10px; }
      @media (max-width: 900px) { .bv-search { margin-left: 0; min-width: 0; width: 100%; } }
    `}</style>
  );
}
