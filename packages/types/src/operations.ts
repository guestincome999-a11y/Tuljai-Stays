import type { BookingStatus } from './booking';
import type { ISODateTime, UUID } from './common';
import type { NotificationType } from './notifications';

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REJECTED' | 'REPORTED';
export type ReviewReportReason = 'FAKE' | 'ABUSIVE' | 'MISLEADING' | 'SPAM' | 'OTHER';
export type ReviewReportStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN';

export interface Review {
  cleanlinessRating: number | null;
  comment: string | null;
  createdAt: ISODateTime;
  id: UUID;
  isVerifiedStay: boolean;
  locationRating: number | null;
  lodgeId: UUID;
  pilgrimUserId: UUID;
  rating: number;
  roomTypeId: UUID | null;
  serviceRating: number | null;
  status: ReviewStatus;
  title: string | null;
  valueRating: number | null;
}

export interface ReviewReport {
  createdAt: ISODateTime;
  description: string | null;
  id: UUID;
  reason: ReviewReportReason;
  reviewId: UUID;
  status: ReviewReportStatus;
}

export interface AdminDashboardSummary {
  acceptedBookings: number;
  availableRooms: number;
  cancelledBookings: number;
  checkedInBookings: number;
  checkedOutBookings: number;
  completedBookings: number;
  failedNotifications: number;
  liveOwnersOnline: number;
  occupiedRooms: number;
  pendingBookings: number;
  pendingLodgeApprovals: number;
  pendingPhotoApprovals: number;
  todayBookings: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  totalBookings: number;
  totalCommissionEstimate: string;
  totalLodges: number;
  totalOwners: number;
  totalPilgrims: number;
  totalUsers: number;
  unreadSupportTickets: number;
  verifiedLodges: number;
}

export interface OwnerDashboardSummary {
  acceptedBookings: number;
  availableRooms: number;
  averageRating: number | null;
  checkedInGuests: number;
  estimatedCommission: string;
  estimatedRevenue: string;
  lodgesManaged: number;
  occupiedRooms: number;
  pendingBookings: number;
  pendingPhotoApprovals: number;
  recentNotifications: unknown[];
  roomsUnderMaintenance: number;
  todayBookings: number;
  todayCheckOuts: number;
}

export interface PilgrimProfileSummary {
  cancelledBookings: number;
  completedBookings: number;
  reviewsSubmitted: number;
  unreadAnnouncements: number;
  unreadNotifications: number;
  upcomingBookings: number;
}

export interface BookingReportRow {
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  commissionAmount: string | null;
  guestName: string;
  lodgeId: UUID;
  status: BookingStatus;
  totalAmount: string | null;
}

export interface CommissionSummary {
  bookingCount: number;
  commissionTotal: string;
  lodgeId: UUID | null;
}

export interface SystemSetting {
  createdAt?: string;
  description: string | null;
  isPublic: boolean;
  key: string;
  updatedAt?: string;
  value: unknown;
}

export interface FeatureFlag {
  createdAt?: string;
  description: string | null;
  enabled: boolean;
  key: string;
  rolloutPercentage: number | null;
  updatedAt?: string;
}

export interface NotificationMetrics {
  deliveredCount: number;
  failedCount: number;
  failureRate: number;
  invalidDeviceTokens: number;
  readCount: number;
  recentFailures: Array<{ failureReason: string | null; notificationId: UUID }>;
  sentCount: number;
  totalNotifications: number;
}

export interface PresenceSummary {
  onlineAdmins: number;
  onlineOwners: number;
  onlinePilgrims: number;
  totalOnline: number;
}

export interface NotificationPreference {
  inAppEnabled: boolean;
  notificationType: NotificationType;
  pushEnabled: boolean;
}
