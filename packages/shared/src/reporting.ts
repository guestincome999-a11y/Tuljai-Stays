import type { PaginatedResponse } from '@tuljai/types';

export interface ReportDateRange {
  startDate: string;
  endDate: string;
}
export type ReportPeriod = 'today' | 'week' | 'month' | 'lastMonth';

export function indiaDate(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function reportPeriod(period: ReportPeriod, now = new Date()): ReportDateRange {
  const endDate = indiaDate(now);
  const end = new Date(`${endDate}T00:00:00Z`);
  const start = new Date(end);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - 6);
  if (period === 'month') start.setUTCDate(1);
  if (period === 'lastMonth') {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 1);
    end.setUTCDate(0);
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function validReportRange(range: ReportDateRange): boolean {
  return (
    [range.startDate, range.endDate].every((value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }) && range.startDate <= range.endDate
  );
}

export async function allReportPages<T>(
  load: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const first = await load(1);
  const rows = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    rows.push(...(await load(page)).items);
  }
  return rows;
}
