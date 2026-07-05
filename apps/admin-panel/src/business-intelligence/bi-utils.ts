import type {
  AdminDashboardSummary,
  BookingReportRow,
  CommissionSummary,
  NotificationMetrics,
  QrScanLogEntry,
} from '@tuljai/types';

export interface ExecutiveKpi {
  comparison: string;
  label: string;
  lastUpdated: string;
  trend: 'up' | 'down' | 'flat';
  value: string;
}

export interface RankingRow {
  bookings: number;
  commission: number;
  lodgeId: string;
  revenue: number;
  score: number;
}

export function toCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function toPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function sumRevenue(rows: BookingReportRow[]): number {
  return rows.reduce((total, row) => total + Number(row.totalAmount ?? 0), 0);
}

export function sumCommission(rows: BookingReportRow[]): number {
  return rows.reduce((total, row) => total + Number(row.commissionAmount ?? 0), 0);
}

export function getAcceptanceRate(summary: AdminDashboardSummary): number {
  const decided = summary.acceptedBookings + summary.cancelledBookings + summary.completedBookings;

  if (decided === 0) {
    return 0;
  }

  return (summary.acceptedBookings / decided) * 100;
}

export function getCancellationRate(summary: AdminDashboardSummary): number {
  if (summary.totalBookings === 0) {
    return 0;
  }

  return (summary.cancelledBookings / summary.totalBookings) * 100;
}

export function getOccupancyRate(summary: AdminDashboardSummary): number {
  const roomTotal = summary.availableRooms + summary.occupiedRooms;

  if (roomTotal === 0) {
    return 0;
  }

  return (summary.occupiedRooms / roomTotal) * 100;
}

export function getQrSuccessRate(logs: QrScanLogEntry[]): number {
  if (logs.length === 0) {
    return 0;
  }

  return (logs.filter((log) => log.result === 'SUCCESS').length / logs.length) * 100;
}

export function getNotificationDeliveryRate(metrics: NotificationMetrics | null): number {
  if (!metrics || metrics.sentCount === 0) {
    return 0;
  }

  return (metrics.deliveredCount / metrics.sentCount) * 100;
}

export function buildExecutiveKpis(
  summary: AdminDashboardSummary,
  rows: BookingReportRow[],
  qrLogs: QrScanLogEntry[],
  notificationMetrics: NotificationMetrics | null,
): ExecutiveKpi[] {
  const lastUpdated = new Date().toLocaleString('en-IN');
  const revenue = sumRevenue(rows);

  return [
    kpi("Today's Bookings", String(summary.todayBookings), 'Live summary', 'flat', lastUpdated),
    kpi('Weekly Bookings', String(rows.length), 'Report window', 'up', lastUpdated),
    kpi(
      'Monthly Bookings',
      String(summary.totalBookings),
      'All-time fallback',
      'flat',
      lastUpdated,
    ),
    kpi('Total Revenue Estimate', toCurrency(revenue), 'Report total', 'up', lastUpdated),
    kpi(
      'Total Commission Estimate',
      toCurrency(summary.totalCommissionEstimate),
      'Dashboard aggregate',
      'up',
      lastUpdated,
    ),
    kpi(
      'Occupancy Rate',
      toPercent(getOccupancyRate(summary)),
      'Available vs occupied',
      'flat',
      lastUpdated,
    ),
    kpi('Owner Response Rate', 'Backend metric required', 'Foundation', 'flat', lastUpdated),
    kpi(
      'QR Success Rate',
      toPercent(getQrSuccessRate(qrLogs)),
      'Recent QR scans',
      'up',
      lastUpdated,
    ),
    kpi(
      'Booking Acceptance Rate',
      toPercent(getAcceptanceRate(summary)),
      'Accepted vs decided',
      'up',
      lastUpdated,
    ),
    kpi(
      'Cancellation Rate',
      toPercent(getCancellationRate(summary)),
      'Lower is better',
      'down',
      lastUpdated,
    ),
    kpi('Average Rating', 'Review aggregate required', 'Foundation', 'flat', lastUpdated),
    kpi('Active Lodges', String(summary.verifiedLodges), 'Verified lodges', 'up', lastUpdated),
    kpi('Active Owners', String(summary.totalOwners), 'Owner accounts', 'up', lastUpdated),
    kpi('Active Pilgrims', String(summary.totalPilgrims), 'Pilgrim accounts', 'up', lastUpdated),
    kpi(
      'Notification Delivery',
      toPercent(getNotificationDeliveryRate(notificationMetrics)),
      'Delivered vs sent',
      'up',
      lastUpdated,
    ),
  ];
}

export function buildLodgeRankings(
  rows: BookingReportRow[],
  commissions: CommissionSummary[],
): RankingRow[] {
  const byLodge = new Map<string, RankingRow>();
  const commissionByLodge = new Map(
    commissions.map((item) => [item.lodgeId ?? 'unassigned', Number(item.commissionTotal)]),
  );

  for (const row of rows) {
    const current = byLodge.get(row.lodgeId) ?? {
      bookings: 0,
      commission: 0,
      lodgeId: row.lodgeId,
      revenue: 0,
      score: 0,
    };
    current.bookings += 1;
    current.revenue += Number(row.totalAmount ?? 0);
    current.commission = commissionByLodge.get(row.lodgeId) ?? current.commission;
    current.score = current.bookings * 10 + current.revenue / 1000 + current.commission / 500;
    byLodge.set(row.lodgeId, current);
  }

  return [...byLodge.values()].sort((a, b) => b.score - a.score);
}

export function groupBookingsByStatus(rows: BookingReportRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});
}

export function groupRevenueByDate(rows: BookingReportRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.checkInDate] = (counts[row.checkInDate] ?? 0) + Number(row.totalAmount ?? 0);
    return counts;
  }, {});
}

export function getBusinessScore(
  value: number,
): 'Excellent' | 'Good' | 'Average' | 'Needs Attention' | 'Critical' {
  if (value >= 85) {
    return 'Excellent';
  }

  if (value >= 70) {
    return 'Good';
  }

  if (value >= 50) {
    return 'Average';
  }

  if (value >= 30) {
    return 'Needs Attention';
  }

  return 'Critical';
}

export function getOwnerBadge(rate: number): 'Gold' | 'Silver' | 'Bronze' | 'Needs Improvement' {
  if (rate >= 90) {
    return 'Gold';
  }

  if (rate >= 75) {
    return 'Silver';
  }

  if (rate >= 60) {
    return 'Bronze';
  }

  return 'Needs Improvement';
}

function kpi(
  label: string,
  value: string,
  comparison: string,
  trend: ExecutiveKpi['trend'],
  lastUpdated: string,
): ExecutiveKpi {
  return {
    comparison,
    label,
    lastUpdated,
    trend,
    value,
  };
}
