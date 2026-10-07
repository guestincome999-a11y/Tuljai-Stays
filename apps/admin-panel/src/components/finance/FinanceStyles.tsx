'use client';

/** Shared look for the finance pages (same tokens and card style as the dashboard). */
export function FinanceStyles() {
  return (
    <style jsx global>{`
      .fin-stack { display: grid; gap: 16px; }
      .fin-note { background: var(--color-primary-soft); border: 1px solid #d3e1ff; border-radius: 12px; color: var(--color-primary-strong); font-size: 0.78rem; font-weight: 600; padding: 10px 14px; }
      .fin-cards { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .fin-card { background: #fff; border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: var(--shadow-soft); min-width: 0; padding: 16px 18px; }
      .fin-card span { color: var(--color-muted); display: block; font-size: 0.74rem; font-weight: 700; }
      .fin-card strong { color: var(--color-primary-strong); display: block; font-size: 1.35rem; letter-spacing: -0.02em; margin-top: 4px; }
      .fin-card small { color: var(--color-muted); display: block; font-size: 0.72rem; font-weight: 600; margin-top: 2px; }
      .fin-card-green { background: #ecf9f2; border-color: #cdeedd; }
      .fin-card-orange { background: #fff5ea; border-color: #fddfbd; }
      .fin-card-red { background: #fff0f0; border-color: #f6d3d3; }
      .fin-card-purple { background: #f4efff; border-color: #e1d5fb; }
      .fin-panel { background: #fff; border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: var(--shadow-soft); min-width: 0; padding: 18px 20px; }
      .fin-panel-head { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; margin-bottom: 14px; }
      .fin-panel-head h2 { color: var(--color-primary-strong); font-size: 1rem; font-weight: 800; margin: 0; }
      .fin-toolbar { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
      .fin-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .fin-filter { background: #fff; border: 1px solid var(--color-outline); border-radius: 999px; color: var(--color-primary-strong); cursor: pointer; font-size: 0.76rem; font-weight: 700; padding: 7px 13px; transition: background 140ms ease, border-color 140ms ease; }
      .fin-filter:hover { background: var(--color-surface-muted); }
      .fin-filter-active, .fin-filter-active:hover { background: var(--color-accent-soft); border-color: #ffd3b3; color: var(--color-accent); }
      .fin-filter b { margin-left: 6px; opacity: 0.8; }
      .fin-search { background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 12px; font-size: 0.82rem; margin-left: auto; min-height: 38px; min-width: 280px; padding: 0 12px; }
      .fin-search:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); outline: none; }
      .fin-scroll { overflow-x: auto; }
      .fin-table { border-collapse: collapse; font-size: 0.8rem; width: 100%; }
      .fin-table th { color: var(--color-muted); font-size: 0.72rem; font-weight: 700; padding: 8px; text-align: left; white-space: nowrap; }
      .fin-table td { border-top: 1px solid var(--color-outline); padding: 12px 8px; white-space: nowrap; }
      .fin-table tr:hover td { background: var(--color-surface-subtle); }
      .fin-num { text-align: right !important; }
      .fin-link { color: var(--color-primary); font-weight: 700; }
      .fin-link:hover { text-decoration: underline; }
      .fin-mono { color: var(--color-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.74rem; }
      .fin-pill { border-radius: 999px; display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 4px 11px; }
      .fin-pill-green { background: #e3f6ec; color: #0d7a54; }
      .fin-pill-orange { background: #fff0dd; color: #b86a0a; }
      .fin-pill-red { background: #ffe9e9; color: #c8312f; }
      .fin-pill-purple { background: #f0e9ff; color: #6a3fd0; }
      .fin-pill-gray { background: #eef2f8; color: #52627a; }
      .fin-pill-blue { background: #e7efff; color: #1d4fd1; }
      .fin-btn { background: var(--color-navy); border: 0; border-radius: 10px; color: #fff; cursor: pointer; font-size: 0.76rem; font-weight: 700; padding: 8px 14px; }
      .fin-btn:hover { background: var(--gradient-primary-hover); }
      .fin-btn:disabled { cursor: not-allowed; opacity: 0.5; }
      .fin-btn-soft { background: #eaf1ff; color: var(--color-primary); }
      .fin-btn-soft:hover { background: var(--color-primary); color: #fff; }
      .fin-pager { align-items: center; display: flex; gap: 12px; justify-content: flex-end; margin-top: 14px; }
      .fin-pager span { color: var(--color-muted); font-size: 0.78rem; font-weight: 600; }
      .fin-empty { color: var(--color-muted); font-size: 0.86rem; padding: 22px 0; text-align: center; }
      .fin-skeleton { background: linear-gradient(90deg, #eef2f8, #f6f8fc, #eef2f8); border-radius: 12px; height: 180px; }
      @media (max-width: 1000px) { .fin-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .fin-search { margin-left: 0; min-width: 0; width: 100%; } }
      @media (max-width: 560px) { .fin-cards { grid-template-columns: minmax(0, 1fr); } }
    `}</style>
  );
}
