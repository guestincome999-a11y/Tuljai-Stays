'use client';

/** Shared look for every finance page. Same tokens and card language as the dashboard. */
export function FinanceStyles() {
  return (
    <style jsx global>{`
      .fin-stack { display: grid; gap: 16px; min-width: 0; }

      /* Page header */
      .fin-head { align-items: center; background: linear-gradient(135deg, #eef4ff 0%, #f6f1ff 100%); border: 1px solid var(--color-outline); border-radius: 16px; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; padding: 20px 24px; }
      .fin-head-text { min-width: 0; }
      .fin-eyebrow { color: var(--color-accent); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; margin: 0 0 4px; text-transform: uppercase; }
      .fin-head h2 { color: var(--color-primary-strong); font-size: 1.3rem; font-weight: 800; letter-spacing: -0.01em; margin: 0; }
      .fin-desc { color: var(--color-muted); font-size: 0.82rem; font-weight: 500; line-height: 1.5; margin: 6px 0 0; max-width: 720px; }
      .fin-head-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; }
      .fin-note { align-items: center; background: #f6f1ff; border: 1px solid #e1d5fb; border-radius: 14px; color: var(--color-primary-strong); display: flex; font-size: 0.8rem; font-weight: 600; gap: 10px; line-height: 1.5; padding: 12px 16px; }
      .fin-note::before { background: #7c4ddb; border-radius: 50%; content: ''; flex: 0 0 8px; height: 8px; width: 8px; }

      /* KPI tiles */
      .fin-kpis { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .fin-kpi { border: 1px solid; border-radius: 16px; display: grid; gap: 4px; min-width: 0; padding: 16px 18px; }
      .fin-kpi-blue { background: #eef4ff; border-color: #d3e1ff; }
      .fin-kpi-green { background: #ecf9f2; border-color: #cdeedd; }
      .fin-kpi-orange { background: #fff5ea; border-color: #fddfbd; }
      .fin-kpi-purple { background: #f4efff; border-color: #e1d5fb; }
      .fin-kpi-red { background: #fff0f0; border-color: #f6d3d3; }
      .fin-ico { align-items: center; border-radius: 50%; display: inline-flex; flex: 0 0 40px; height: 40px; justify-content: center; width: 40px; }
      .fin-kpi .fin-ico { margin-bottom: 6px; }
      .fin-kpi-blue .fin-ico, .fin-ico-blue { background: #dce8ff; color: #2563eb; }
      .fin-kpi-green .fin-ico, .fin-ico-green { background: #d2f0e0; color: #16a368; }
      .fin-kpi-orange .fin-ico, .fin-ico-orange { background: #ffe5c7; color: #f08a1c; }
      .fin-kpi-purple .fin-ico, .fin-ico-purple { background: #e6dbfb; color: #7c4ddb; }
      .fin-kpi-red .fin-ico, .fin-ico-red { background: #ffd9d9; color: #e5484d; }
      .fin-kpi-label { color: var(--color-primary-strong); font-size: 0.78rem; font-weight: 600; line-height: 1.25; }
      .fin-kpi-value { color: var(--color-primary-strong); font-size: 1.55rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; overflow-wrap: anywhere; }
      .fin-kpi-meta { color: var(--color-muted); font-size: 0.74rem; font-weight: 600; min-height: 1.1em; }

      /* Panels */
      .fin-panel { background: #fff; border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: var(--shadow-soft); display: flex; flex-direction: column; min-width: 0; padding: 18px 20px; }
      .fin-panel-head { align-items: center; display: flex; flex-wrap: wrap; gap: 10px 12px; justify-content: space-between; margin-bottom: 16px; min-height: 34px; }
      .fin-panel-title { flex: 1 1 auto; min-width: 0; }
      .fin-panel-title h2 { color: var(--color-primary-strong); font-size: 1rem; font-weight: 800; margin: 0; }
      .fin-panel-sub { color: var(--color-muted); display: block; font-size: 0.74rem; font-weight: 600; margin-top: 2px; }
      .fin-panel-body { flex: 1 1 auto; min-width: 0; }
      .fin-text { color: var(--color-muted); font-size: 0.8rem; font-weight: 500; line-height: 1.55; margin: 0 0 14px; }
      .fin-split { align-items: stretch; display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }

      /* Overview link cards */
      .fin-links { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .fin-linkcard { background: #fff; border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: var(--shadow-soft); display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 18px; }
      .fin-linkcard h3 { color: var(--color-primary-strong); font-size: 0.98rem; font-weight: 800; margin: 4px 0 0; }
      .fin-linkcard p { color: var(--color-muted); flex: 1 1 auto; font-size: 0.78rem; font-weight: 500; line-height: 1.5; margin: 0; }
      .fin-linkcard .fin-btn { align-self: flex-start; margin-top: 4px; }

      /* Key / value rows */
      .fin-kv { display: grid; margin: 0; }
      .fin-kv-row { align-items: center; border-top: 1px solid var(--color-outline); display: flex; gap: 16px; justify-content: space-between; min-height: 46px; padding: 10px 0; }
      .fin-kv-row:first-child { border-top: 0; padding-top: 0; }
      .fin-kv-row > span { color: var(--color-muted); font-size: 0.78rem; font-weight: 600; }
      .fin-kv-row > strong { color: var(--color-primary-strong); font-size: 0.82rem; font-weight: 800; text-align: right; }
      .fin-kv-2 { column-gap: 32px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .fin-kv-2 .fin-kv-row:nth-child(2) { border-top: 0; padding-top: 0; }

      /* Toolbar */
      .fin-toolbar { align-items: center; display: flex; flex-wrap: wrap; gap: 10px 12px; margin-bottom: 16px; }
      .fin-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .fin-filter { background: #fff; border: 1px solid var(--color-outline); border-radius: 999px; color: var(--color-primary-strong); cursor: pointer; font-size: 0.76rem; font-weight: 700; padding: 7px 13px; transition: background 140ms ease, border-color 140ms ease; }
      .fin-filter:hover { background: var(--color-surface-muted); }
      .fin-filter-active, .fin-filter-active:hover { background: var(--color-accent-soft); border-color: #ffd3b3; color: var(--color-accent); }
      .fin-filter b { margin-left: 6px; opacity: 0.8; }
      .fin-search { background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 10px; color: var(--color-primary-strong); font-size: 0.82rem; margin-left: auto; min-height: 38px; min-width: 280px; padding: 0 12px; }
      .fin-search:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); outline: none; }

      /* Tables: header and cells share one column grid, numbers right-aligned */
      .fin-scroll { overflow-x: auto; }
      .fin-table { border-collapse: collapse; font-size: 0.8rem; width: 100%; }
      .fin-table th { background: var(--color-surface-subtle); color: var(--color-muted); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; padding: 10px 12px; text-align: left; text-transform: uppercase; white-space: nowrap; }
      .fin-table th:first-child { border-radius: 10px 0 0 10px; }
      .fin-table th:last-child { border-radius: 0 10px 10px 0; }
      .fin-table td { border-top: 1px solid var(--color-outline); color: var(--color-primary-strong); padding: 13px 12px; vertical-align: middle; white-space: nowrap; }
      .fin-table thead + tbody tr:first-child td { border-top: 0; }
      .fin-table tbody tr:hover td { background: var(--color-surface-subtle); }
      .fin-num { font-variant-numeric: tabular-nums; text-align: right !important; }
      .fin-cell-sub { color: var(--color-muted); display: block; font-size: 0.7rem; font-weight: 500; margin-top: 2px; }
      .fin-link { color: var(--color-primary); font-weight: 700; }
      .fin-link:hover { text-decoration: underline; }
      .fin-mono { color: var(--color-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.74rem; }

      /* Pills */
      .fin-pill { border-radius: 999px; display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 4px 11px; white-space: nowrap; }
      .fin-pill-green { background: #e3f6ec; color: #0d7a54; }
      .fin-pill-orange { background: #fff0dd; color: #b86a0a; }
      .fin-pill-red { background: #ffe9e9; color: #c8312f; }
      .fin-pill-purple { background: #f0e9ff; color: #6a3fd0; }
      .fin-pill-gray { background: #eef2f8; color: #52627a; }
      .fin-pill-blue { background: #e7efff; color: #1d4fd1; }

      /* Buttons */
      .fin-btn { align-items: center; background: var(--color-navy); border: 1px solid transparent; border-radius: 10px; color: #fff; cursor: pointer; display: inline-flex; font-size: 0.78rem; font-weight: 700; gap: 6px; justify-content: center; line-height: 1; min-height: 36px; padding: 0 16px; text-decoration: none; transition: background 140ms ease, color 140ms ease, border-color 140ms ease; white-space: nowrap; }
      .fin-btn:hover:not(:disabled) { background: var(--gradient-primary-hover); }
      .fin-btn:disabled { cursor: not-allowed; opacity: 0.5; }
      .fin-btn-sm { font-size: 0.74rem; min-height: 32px; padding: 0 12px; }
      .fin-btn-soft { background: #eaf1ff; color: var(--color-primary); }
      .fin-btn-soft:hover:not(:disabled) { background: var(--color-primary); color: #fff; }
      .fin-btn-violet { background: #f0e9ff; border-color: #e1d5fb; color: #6a3fd0; }
      .fin-btn-violet:hover:not(:disabled) { background: #7c4ddb; border-color: #7c4ddb; color: #fff; }
      .fin-btn-outline { background: #fff; border-color: var(--color-outline); color: var(--color-primary-strong); }
      .fin-btn-outline:hover:not(:disabled) { background: var(--color-surface-muted); }
      .fin-btn-danger { background: #ffe9e9; color: #c8312f; }
      .fin-btn-danger:hover:not(:disabled) { background: #c8312f; color: #fff; }
      .fin-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
      .fin-actions-end { justify-content: flex-end; }

      /* Forms */
      .fin-form { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .fin-field { display: grid; gap: 6px; min-width: 0; }
      .fin-field > span { color: var(--color-primary-strong); font-size: 0.74rem; font-weight: 700; }
      .fin-field input, .fin-field select, .fin-field textarea { background: #fff; border: 1px solid var(--color-outline); border-radius: 10px; color: var(--color-primary-strong); font-size: 0.82rem; min-height: 40px; padding: 0 12px; width: 100%; }
      .fin-field textarea { min-height: 84px; padding: 10px 12px; resize: vertical; }
      .fin-field input:focus, .fin-field select:focus, .fin-field textarea:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); outline: none; }
      .fin-field-wide { grid-column: 1 / -1; }
      .fin-field-error { color: var(--color-danger); font-size: 0.76rem; font-weight: 700; grid-column: 1 / -1; margin: 0; }

      /* Daily revenue bars */
      .fin-bars { display: grid; gap: 12px; }
      .fin-bar-row { align-items: center; display: grid; font-size: 0.78rem; gap: 12px; grid-template-columns: 84px minmax(0, 1fr) 112px; }
      .fin-bar-row > span { color: var(--color-muted); font-weight: 600; }
      .fin-bar-row > strong { color: var(--color-primary-strong); font-variant-numeric: tabular-nums; text-align: right; }
      .fin-bar-track { background: #eef2f8; border-radius: 999px; height: 10px; overflow: hidden; }
      .fin-bar-track i { background: var(--color-primary); border-radius: 999px; display: block; height: 100%; }

      /* Pager, empty, skeleton */
      .fin-pager { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 16px; }
      .fin-pager > span { color: var(--color-muted); font-size: 0.78rem; font-weight: 600; margin-right: auto; }
      .fin-empty { color: var(--color-muted); font-size: 0.86rem; margin: 0; padding: 22px 0; text-align: center; }
      .fin-skeleton { background: linear-gradient(90deg, #eef2f8, #f6f8fc, #eef2f8); border-radius: 12px; height: 180px; }

      @media (max-width: 1100px) {
        .fin-kpis, .fin-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .fin-split { grid-template-columns: minmax(0, 1fr); }
        .fin-search { margin-left: 0; min-width: 0; width: 100%; }
      }
      @media (max-width: 640px) {
        .fin-kpis, .fin-links, .fin-form, .fin-kv-2 { grid-template-columns: minmax(0, 1fr); }
        .fin-kv-2 .fin-kv-row:nth-child(2) { border-top: 1px solid var(--color-outline); padding-top: 10px; }
        .fin-head { padding: 16px; }
        .fin-bar-row { grid-template-columns: 64px minmax(0, 1fr) 92px; }
      }
    `}</style>
  );
}
