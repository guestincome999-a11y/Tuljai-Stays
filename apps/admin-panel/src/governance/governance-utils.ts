import type {
  Lodge,
  LodgeDetails,
  LodgePhoto,
  LodgeStatus,
  PhotoApprovalStatus,
  Room,
  RoomStatus,
  RoomType,
  VerificationStatus,
} from '@tuljai/types';

export const lodgeStatuses: LodgeStatus[] = [
  'DRAFT',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'SUSPENDED',
  'REJECTED',
];

export const verificationStatuses: VerificationStatus[] = ['PENDING', 'VERIFIED', 'REJECTED'];

export const roomStatuses: RoomStatus[] = [
  'AVAILABLE',
  'RESERVED',
  'PENDING_APPROVAL',
  'CONFIRMED',
  'OCCUPIED',
  'CLEANING',
  'MAINTENANCE',
  'BLOCKED',
];

export const photoRejectReasons = [
  'Image is unclear or low quality',
  'Photo does not represent the lodge accurately',
  'Sensitive or private information is visible',
  'Duplicate or irrelevant photo',
];

export function formatGovernanceStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function getLodgeReadinessReasons(
  lodge: Lodge | LodgeDetails,
  roomTypes: RoomType[] = [],
  photos: LodgePhoto[] = [],
): string[] {
  const reasons: string[] = [];
  const details = isLodgeDetails(lodge) ? lodge : null;

  if (lodge.status !== 'VERIFIED') {
    reasons.push(`Lodge status is ${formatGovernanceStatus(lodge.status)}`);
  }

  if (lodge.verificationStatus !== 'VERIFIED') {
    reasons.push(`Verification is ${formatGovernanceStatus(lodge.verificationStatus)}`);
  }

  if (!lodge.isActive) {
    reasons.push('Lodge is inactive');
  }

  if (!details?.address) {
    reasons.push('Address is missing');
  }

  if (roomTypes.length === 0) {
    reasons.push('No room types configured');
  }

  if (!photos.some((photo) => photo.approvalStatus === 'APPROVED')) {
    reasons.push('No approved photos available');
  }

  return reasons;
}

export function getRoomTypeLabel(roomTypeId: string, roomTypes: RoomType[]): string {
  return roomTypes.find((roomType) => roomType.id === roomTypeId)?.name ?? 'Unmapped room type';
}

export function summarizeRooms(rooms: Room[]) {
  return {
    available: rooms.filter((room) => room.status === 'AVAILABLE').length,
    blocked: rooms.filter((room) => room.status === 'BLOCKED').length,
    maintenance: rooms.filter((room) => room.status === 'MAINTENANCE').length,
    occupied: rooms.filter((room) => room.status === 'OCCUPIED').length,
    total: rooms.length,
  };
}

export function summarizePhotos(photos: LodgePhoto[]) {
  return {
    approved: countPhotosByStatus(photos, 'APPROVED'),
    pending: countPhotosByStatus(photos, 'PENDING'),
    rejected: countPhotosByStatus(photos, 'REJECTED'),
    total: photos.length,
  };
}

function countPhotosByStatus(photos: LodgePhoto[], status: PhotoApprovalStatus): number {
  return photos.filter((photo) => photo.approvalStatus === status).length;
}

function isLodgeDetails(lodge: Lodge | LodgeDetails): lodge is LodgeDetails {
  return 'address' in lodge;
}
