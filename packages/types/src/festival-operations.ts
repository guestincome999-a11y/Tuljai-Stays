export interface FestivalLodgeOperation {
  id: string;
  name: string;
  isActive: boolean;
  status: string;
  verificationStatus: string;
  operationsReason: string | null;
  updatedAt: string;
  availableRooms: number;
}

export interface FestivalTelemetry {
  scope: string;
  windowSeconds: number;
  requests: number;
  errors: number;
  averageLatencyMs: number | null;
  activeBookingRequests: number;
  failedBookingRequests: number;
  memoryMb: number;
  endpoints: Array<{ route: string; requests: number; errors: number; averageLatencyMs: number }>;
  recentErrors: Array<{ route: string; status: number; at: string }>;
}

export interface FestivalOperationsSnapshot {
  checkedAt: string;
  checkInDate: string;
  checkOutDate: string;
  mode: {
    enabled: boolean;
    name: string;
    startDate: string;
    endDate: string;
    updatedAt: string | null;
    activatedBy: string | null;
    lastChangedBy: string | null;
  };
  kpis: {
    activeLodges: number;
    eligibleLodges: number;
    disabledLodges: number;
    fullyBookedLodges: number;
    availableRooms: number;
    activeBookings: number;
    pendingPayments: number;
    stuckOperations: number;
    activeStays: number;
  };
  lodges: { items: FestivalLodgeOperation[]; total: number; page: number; pageSize: number };
  alerts: Array<{
    id: string;
    severity: 'warning' | 'critical';
    at: string;
    entity: string;
    detail: string;
    action: string;
    href: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    actor: string;
    entityId: string | null;
    at: string;
    metadata: unknown;
  }>;
  payments: Array<{
    id: string;
    orderId: string;
    status: string;
    bookingId: string | null;
    updatedAt: string;
    attempts: number;
  }>;
  diagnostics: {
    database: 'healthy';
    databaseLatencyMs: number;
    oldestPendingPaymentAt: string | null;
    onlineConnections: number;
    synchronization: {
      ready: boolean;
      lastPublishedAt: string | null;
      failures: Array<{ event: string; at: string }>;
    };
    failedNotifications: number;
    qrFailures: number;
    telemetry: FestivalTelemetry;
  };
}
