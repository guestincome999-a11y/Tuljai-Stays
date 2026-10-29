'use client';

import type {
  Amenity,
  LodgeDetails,
  LodgePhoto,
  LodgeStatus,
  Room,
  RoomStatus,
  RoomType,
  VerificationStatus,
} from '@tuljai/types';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import {
  assignGovernanceAmenities,
  getGovernanceLodge,
  listGovernanceAmenities,
  listGovernanceLodgePhotos,
  listGovernanceRooms,
  listGovernanceRoomTypes,
  updateGovernanceLodge,
  updateGovernanceLodgeStatus,
  updateGovernancePhotoApproval,
  updateGovernanceRoomStatus,
  verifyGovernanceLodge,
} from '../../../../src/api/admin-governance-api';
import { useAdminAuth } from '../../../../src/auth/AdminAuthProvider';
import { FinanceStyles } from '../../../../src/components/finance/FinanceStyles';
import {
  FinBanners,
  FinHeader,
  FinKpi,
  FinKv,
  FinPanel,
  FinPill,
} from '../../../../src/components/finance/FinanceUi';
import type { FinTone } from '../../../../src/components/finance/FinanceUi';
import { LodgeInspectStyles } from '../../../../src/components/lodges/LodgeInspectStyles';
import { PermissionGate } from '../../../../src/components/PermissionGate';
import {
  formatGovernanceStatus,
  getLodgeReadinessReasons,
  getRoomTypeLabel,
  lodgeStatuses,
  photoRejectReasons,
  roomStatuses,
  summarizePhotos,
  summarizeRooms,
  verificationStatuses,
} from '../../../../src/governance/governance-utils';
import { hasPermission } from '../../../../src/permissions/permissions';

interface Part<T> {
  data: T;
  error: string | null;
}

const emptyPart = <T,>(): Part<T[]> => ({ data: [], error: null });

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? `${fallback} ${error.message}` : fallback;
}

function settleList<T>(
  result: PromiseSettledResult<T[]>,
  fallback: string,
  previous: T[],
): Part<T[]> {
  if (result.status === 'fulfilled') return { data: result.value, error: null };
  return { data: previous, error: describeError(result.reason, fallback) };
}

function lodgeStatusTone(status: LodgeStatus): FinTone {
  if (status === 'VERIFIED') return 'green';
  if (status === 'PENDING_VERIFICATION') return 'orange';
  if (status === 'SUSPENDED' || status === 'REJECTED') return 'red';
  return 'gray';
}

function verificationTone(status: VerificationStatus): FinTone {
  if (status === 'VERIFIED') return 'green';
  if (status === 'REJECTED') return 'red';
  return 'orange';
}

function roomTone(status: RoomStatus): FinTone {
  if (status === 'AVAILABLE') return 'green';
  if (status === 'MAINTENANCE' || status === 'BLOCKED') return 'red';
  if (status === 'PENDING_APPROVAL' || status === 'CLEANING') return 'orange';
  return 'blue';
}

function photoTone(status: LodgePhoto['approvalStatus']): FinTone {
  if (status === 'APPROVED') return 'green';
  if (status === 'REJECTED') return 'red';
  return 'orange';
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="li-section-error" role="alert">
      <span>{message}</span>
      <button className="fin-btn fin-btn-sm" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export default function AdminLodgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lodgeId } = use(params);
  const auth = useAdminAuth();
  const canManageLodges = hasPermission(auth.permissions, 'lodges.manage');
  const canManageRooms = hasPermission(auth.permissions, 'rooms.manage');
  const canReviewPhotos = hasPermission(auth.permissions, 'photos.review');

  const [lodge, setLodge] = useState<LodgeDetails | null>(null);
  const [lodgeError, setLodgeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomTypes, setRoomTypes] = useState<Part<RoomType[]>>(emptyPart<RoomType>());
  const [rooms, setRooms] = useState<Part<Room[]>>(emptyPart<Room>());
  const [photos, setPhotos] = useState<Part<LodgePhoto[]>>(emptyPart<LodgePhoto>());
  const [amenities, setAmenities] = useState<Part<Amenity[]>>(emptyPart<Amenity>());

  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [pendingStatus, setPendingStatus] = useState<LodgeStatus | null>(null);
  const [pendingVerification, setPendingVerification] = useState<VerificationStatus | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [googleMapsLinkDraft, setGoogleMapsLinkDraft] = useState('');
  const [rejectReason, setRejectReason] = useState(photoRejectReasons[0] ?? '');
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(
    async ({ resetDrafts, showSkeleton }: { resetDrafts: boolean; showSkeleton: boolean }) => {
      if (showSkeleton) setIsLoading(true);
      setLodgeError(null);

      // Each request settles on its own so one failing section never blanks the page.
      const [lodgeResult, typesResult, roomsResult, photosResult, amenitiesResult] =
        await Promise.allSettled([
          getGovernanceLodge(lodgeId),
          listGovernanceRoomTypes(lodgeId),
          listGovernanceRooms(lodgeId),
          listGovernanceLodgePhotos(lodgeId),
          listGovernanceAmenities(),
        ]);

      if (lodgeResult.status === 'fulfilled') {
        setLodge(lodgeResult.value);
        if (resetDrafts) {
          setSelectedAmenityIds(lodgeResult.value.amenities.map((amenity) => amenity.id));
          setGoogleMapsLinkDraft(lodgeResult.value.googleMapsLink ?? '');
        }
      } else {
        setLodgeError(describeError(lodgeResult.reason, 'Lodge details could not be loaded.'));
      }

      setRoomTypes((previous) =>
        settleList(typesResult, 'Room types could not be loaded.', previous.data),
      );
      setRooms((previous) => settleList(roomsResult, 'Rooms could not be loaded.', previous.data));
      setPhotos((previous) =>
        settleList(photosResult, 'Photos could not be loaded.', previous.data),
      );
      setAmenities((previous) =>
        settleList(amenitiesResult, 'Amenities could not be loaded.', previous.data),
      );
      setIsLoading(false);
    },
    [lodgeId],
  );

  useEffect(() => {
    void load({ resetDrafts: true, showSkeleton: true });
  }, [load]);

  const roomSummary = useMemo(() => summarizeRooms(rooms.data), [rooms.data]);
  const photoSummary = useMemo(() => summarizePhotos(photos.data), [photos.data]);
  const coverPhoto = useMemo(
    () => photos.data.find((photo) => photo.approvalStatus === 'APPROVED') ?? photos.data[0],
    [photos.data],
  );
  const readinessReasons = useMemo(
    () => (lodge ? getLodgeReadinessReasons(lodge, roomTypes.data, photos.data) : []),
    [lodge, photos.data, roomTypes.data],
  );

  async function runAction(
    action: () => Promise<unknown>,
    message: string,
    resetDrafts = false,
  ): Promise<void> {
    setActionError(null);
    setSuccessMessage(null);
    setIsBusy(true);
    try {
      await action();
      await load({ resetDrafts, showSkeleton: false });
      setSuccessMessage(message);
    } catch (error) {
      setActionError(describeError(error, 'Action failed. Please verify permissions and retry.'));
    } finally {
      setIsBusy(false);
    }
  }

  const retry = () => void load({ resetDrafts: false, showSkeleton: false });

  function toggleAmenity(amenityId: string, checked: boolean) {
    setSelectedAmenityIds((current) =>
      checked ? [...current, amenityId] : current.filter((id) => id !== amenityId),
    );
  }

  if (isLoading) {
    return (
      <PermissionGate permission="lodges.view">
        <div className="fin-stack">
          <FinanceStyles />
          <FinHeader
            description="Loading lodge governance detail."
            eyebrow="Lodge Governance Detail"
            title="Lodge"
          />
          <div className="fin-skeleton" />
          <div className="fin-skeleton" />
        </div>
      </PermissionGate>
    );
  }

  if (!lodge) {
    return (
      <PermissionGate permission="lodges.view">
        <div className="fin-stack">
          <FinanceStyles />
          <LodgeInspectStyles />
          <FinHeader
            actions={
              <Link className="fin-btn fin-btn-outline" href="/admin/lodges">
                Back to lodges
              </Link>
            }
            description="The lodge record could not be opened."
            eyebrow="Lodge Governance Detail"
            title="Lodge unavailable"
          />
          <FinPanel sub="Could not load" title="Lodge could not be opened">
            <SectionError
              message={lodgeError ?? 'Lodge details could not be loaded.'}
              onRetry={() => void load({ resetDrafts: true, showSkeleton: true })}
            />
          </FinPanel>
        </div>
      </PermissionGate>
    );
  }

  const selectedStatus = pendingStatus ?? lodge.status;
  const selectedVerification = pendingVerification ?? lodge.verificationStatus;

  const addressText = lodge.address
    ? [
        lodge.address.addressLine1,
        lodge.address.addressLine2,
        lodge.address.landmark,
        lodge.address.city,
        lodge.address.district,
        lodge.address.state,
        lodge.address.pincode,
      ]
        .filter((part): part is string => Boolean(part))
        .join(', ')
    : 'Address pending';

  return (
    <PermissionGate permission="lodges.view">
      <div className="fin-stack">
        <FinanceStyles />
        <LodgeInspectStyles />

        <FinHeader
          actions={
            <div className="li-head-actions">
              <FinPill tone={lodgeStatusTone(lodge.status)}>
                {formatGovernanceStatus(lodge.status)}
              </FinPill>
              <FinPill tone={verificationTone(lodge.verificationStatus)}>
                {formatGovernanceStatus(lodge.verificationStatus)}
              </FinPill>
              <button
                className="fin-btn fin-btn-soft"
                type="button"
                onClick={() => void load({ resetDrafts: true, showSkeleton: false })}
              >
                Refresh
              </button>
              <Link className="fin-btn fin-btn-outline" href="/admin/lodges">
                Back to lodges
              </Link>
            </div>
          }
          description={addressText}
          eyebrow="Lodge Governance Detail"
          title={lodge.name}
        />

        <FinBanners error={actionError} message={successMessage} />

        <section aria-label="Lodge summary" className="fin-kpis">
          <FinKpi
            icon="receipt"
            label="Room types"
            meta={roomTypes.error ? 'Could not load' : 'Configured'}
            tone="blue"
            value={roomTypes.data.length}
          />
          <FinKpi
            icon="lodge"
            label="Rooms"
            meta={rooms.error ? 'Could not load' : 'In this lodge'}
            tone="purple"
            value={roomSummary.total}
          />
          <FinKpi
            icon="check"
            label="Available"
            meta={`${roomSummary.occupied} occupied`}
            tone="green"
            value={roomSummary.available}
          />
          <FinKpi
            icon="clock"
            label="Pending photos"
            meta={`${photoSummary.approved} approved`}
            tone="orange"
            value={photoSummary.pending}
          />
        </section>

        <div className="li-layout">
          <div className="li-col">
            <FinPanel sub={addressText} title="Lodge details">
              {coverPhoto ? (
                <img
                  alt={`${lodge.name} cover`}
                  className="li-cover"
                  src={coverPhoto.thumbnailUrl ?? coverPhoto.fileUrl}
                />
              ) : null}
              <FinKv
                twoColumns
                rows={[
                  { label: 'Property type', value: formatGovernanceStatus(lodge.propertyType) },
                  {
                    label: 'Distance from temple',
                    value: lodge.distanceFromTempleMeters
                      ? `${lodge.distanceFromTempleMeters} m`
                      : 'Not set',
                  },
                  {
                    label: 'Check-in / check-out',
                    value: `${lodge.checkInTime ?? '—'} / ${lodge.checkOutTime ?? '—'}`,
                  },
                  {
                    label: 'Rating',
                    value:
                      lodge.averageRating === null
                        ? 'No reviews yet'
                        : `${lodge.averageRating} (${lodge.reviewCount})`,
                  },
                  { label: 'Primary phone', value: lodge.primaryPhone || '—' },
                  { label: 'WhatsApp', value: lodge.whatsappNumber ?? '—' },
                  { label: 'Email', value: lodge.email ?? '—' },
                ]}
              />
            </FinPanel>

            <FinPanel
              action={
                <Link
                  className="fin-btn fin-btn-sm fin-btn-soft"
                  href={`/admin/rooms?lodgeId=${lodgeId}`}
                >
                  Manage rooms &amp; room types
                </Link>
              }
              sub={`${roomSummary.total} rooms · ${roomSummary.available} available`}
              title="Room status"
            >
              {rooms.error ? (
                <SectionError message={rooms.error} onRetry={retry} />
              ) : rooms.data.length === 0 ? (
                <p className="fin-empty">No rooms have been added to this lodge yet.</p>
              ) : (
                <div className="fin-scroll">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Type</th>
                        <th>Floor</th>
                        <th>Status</th>
                        <th className="fin-num">Change status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.data.map((room) => (
                        <tr key={room.id}>
                          <td>
                            <b>{room.roomNumber}</b>
                          </td>
                          <td>{getRoomTypeLabel(room.roomTypeId, roomTypes.data)}</td>
                          <td>{room.floor ?? 'Not set'}</td>
                          <td>
                            <FinPill tone={roomTone(room.status)}>
                              {formatGovernanceStatus(room.status)}
                            </FinPill>
                          </td>
                          <td className="fin-num">
                            <select
                              aria-label={`Status for room ${room.roomNumber}`}
                              className="li-select"
                              disabled={!canManageRooms || isBusy}
                              value={room.status}
                              onChange={(event) => {
                                const status = event.target.value as RoomStatus;
                                void runAction(
                                  () => updateGovernanceRoomStatus(room.id, { status }),
                                  `Room ${room.roomNumber} status updated.`,
                                );
                              }}
                            >
                              {roomStatuses.map((roomStatus) => (
                                <option key={roomStatus} value={roomStatus}>
                                  {formatGovernanceStatus(roomStatus)}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </FinPanel>

            <FinPanel
              action={
                <Link className="fin-btn fin-btn-sm fin-btn-soft" href="/admin/photos">
                  Review pending photos
                </Link>
              }
              sub={`${photoSummary.total} photos · ${photoSummary.pending} pending`}
              title="Photos"
            >
              {photos.error ? (
                <SectionError message={photos.error} onRetry={retry} />
              ) : photos.data.length === 0 ? (
                <p className="fin-empty">No photos have been uploaded for this lodge yet.</p>
              ) : (
                <>
                  <label className="fin-field li-reject">
                    <span>Rejection reason (used when you reject a photo)</span>
                    <select
                      disabled={!canReviewPhotos || isBusy}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                    >
                      {photoRejectReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="li-photos">
                    {photos.data.map((photo) => (
                      <article className="li-photo" key={photo.id}>
                        <img
                          alt={`${lodge.name} ${photo.category}`}
                          src={photo.thumbnailUrl ?? photo.fileUrl}
                        />
                        <div className="li-photo-meta">
                          <b>{formatGovernanceStatus(photo.category)}</b>
                          <FinPill tone={photoTone(photo.approvalStatus)}>
                            {formatGovernanceStatus(photo.approvalStatus)}
                          </FinPill>
                        </div>
                        {photo.approvalStatus === 'REJECTED' && photo.rejectionReason ? (
                          <p className="li-photo-reason">{photo.rejectionReason}</p>
                        ) : null}
                        <div className="li-photo-actions">
                          <button
                            className="fin-btn fin-btn-sm fin-btn-green"
                            disabled={
                              !canReviewPhotos || isBusy || photo.approvalStatus === 'APPROVED'
                            }
                            type="button"
                            onClick={() =>
                              void runAction(
                                () => updateGovernancePhotoApproval(photo.id, 'APPROVED'),
                                'Photo approved.',
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="fin-btn fin-btn-sm fin-btn-danger"
                            disabled={
                              !canReviewPhotos || isBusy || photo.approvalStatus === 'REJECTED'
                            }
                            type="button"
                            onClick={() =>
                              void runAction(
                                () =>
                                  updateGovernancePhotoApproval(photo.id, 'REJECTED', {
                                    rejectionReason: rejectReason || 'Photo rejected by admin',
                                  }),
                                'Photo rejected.',
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </FinPanel>
          </div>

          <div className="li-col">
            <FinPanel
              sub={readinessReasons.length ? 'Needs attention' : 'All checks passed'}
              title="Publication readiness"
            >
              {readinessReasons.length ? (
                <ul className="li-ready">
                  {readinessReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="li-ok">
                  Ready for discovery. Status, verification, rooms, address, and photos are ready.
                </p>
              )}
            </FinPanel>

            <FinPanel sub="Recorded in the audit trail" title="Status & verification">
              <p className="li-sub">Lodge status</p>
              <div aria-label="Lodge status" className="fin-chip-row" role="group">
                {lodgeStatuses.map((status) => (
                  <button
                    aria-pressed={selectedStatus === status}
                    className={
                      selectedStatus === status ? 'fin-filter fin-filter-active' : 'fin-filter'
                    }
                    disabled={!canManageLodges || isBusy}
                    key={status}
                    type="button"
                    onClick={() => setPendingStatus(status)}
                  >
                    {formatGovernanceStatus(status)}
                  </button>
                ))}
              </div>
              <div className="fin-actions li-confirm">
                <button
                  className="fin-btn"
                  disabled={!canManageLodges || isBusy || selectedStatus === lodge.status}
                  type="button"
                  onClick={() =>
                    void runAction(
                      () => updateGovernanceLodgeStatus(lodgeId, { status: selectedStatus }),
                      `Lodge status changed to ${formatGovernanceStatus(selectedStatus)}.`,
                    ).then(() => setPendingStatus(null))
                  }
                >
                  {isBusy
                    ? 'Updating…'
                    : `Confirm · ${formatGovernanceStatus(selectedStatus)}`}
                </button>
              </div>

              <p className="li-sub">Verification</p>
              <div aria-label="Verification" className="fin-chip-row" role="group">
                {verificationStatuses.map((verificationStatus) => (
                  <button
                    aria-pressed={selectedVerification === verificationStatus}
                    className={
                      selectedVerification === verificationStatus
                        ? 'fin-filter fin-filter-active'
                        : 'fin-filter'
                    }
                    disabled={!canManageLodges || isBusy}
                    key={verificationStatus}
                    type="button"
                    onClick={() => setPendingVerification(verificationStatus)}
                  >
                    {formatGovernanceStatus(verificationStatus)}
                  </button>
                ))}
              </div>
              <label className="fin-field li-notes">
                <span>Verification notes</span>
                <textarea
                  disabled={!canManageLodges || isBusy}
                  placeholder="Optional note saved with the decision"
                  value={verificationNotes}
                  onChange={(event) => setVerificationNotes(event.target.value)}
                />
              </label>
              <div className="fin-actions li-confirm">
                <button
                  className="fin-btn"
                  disabled={
                    !canManageLodges || isBusy || selectedVerification === lodge.verificationStatus
                  }
                  type="button"
                  onClick={() =>
                    void runAction(
                      () =>
                        verifyGovernanceLodge(lodgeId, {
                          notes: verificationNotes || undefined,
                          verificationStatus: selectedVerification,
                        }),
                      `Verification changed to ${formatGovernanceStatus(selectedVerification)}.`,
                    ).then(() => {
                      setPendingVerification(null);
                      setVerificationNotes('');
                    })
                  }
                >
                  {isBusy
                    ? 'Updating…'
                    : `Confirm · ${formatGovernanceStatus(selectedVerification)}`}
                </button>
              </div>
              <p className="fin-text li-foot">
                {canManageLodges
                  ? 'Backend validation still applies. Every update is recorded in the audit log.'
                  : 'You have view-only access to this lodge.'}
              </p>
            </FinPanel>

            <FinPanel sub="Pilgrim directions" title="Google Maps link">
              <p className="fin-text">
                Open the lodge pin in Google Maps, tap Share, and paste the link. Pilgrims get an
                &quot;Open directions&quot; button that uses it.
              </p>
              <label className="fin-field li-notes">
                <span>Google Maps link</span>
                <input
                  disabled={!canManageLodges || isBusy}
                  placeholder="https://maps.app.goo.gl/..."
                  type="url"
                  value={googleMapsLinkDraft}
                  onChange={(event) => setGoogleMapsLinkDraft(event.target.value)}
                />
              </label>
              <div className="fin-actions li-confirm">
                <button
                  className="fin-btn"
                  disabled={!canManageLodges || isBusy}
                  type="button"
                  onClick={() =>
                    void runAction(
                      () =>
                        updateGovernanceLodge(lodgeId, {
                          googleMapsLink: googleMapsLinkDraft.trim() || undefined,
                        }),
                      'Google Maps link updated.',
                      true,
                    )
                  }
                >
                  Save link
                </button>
                {lodge.googleMapsLink ? (
                  <a
                    className="fin-btn fin-btn-outline"
                    href={lodge.googleMapsLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open current
                  </a>
                ) : null}
              </div>
            </FinPanel>

            <FinPanel
              action={
                <button
                  className="fin-btn fin-btn-sm"
                  disabled={!canManageLodges || isBusy || amenities.error !== null}
                  type="button"
                  onClick={() =>
                    void runAction(
                      () => assignGovernanceAmenities(lodgeId, { amenityIds: selectedAmenityIds }),
                      'Amenities updated.',
                      true,
                    )
                  }
                >
                  Save amenities
                </button>
              }
              sub={`${selectedAmenityIds.length} selected`}
              title="Amenities"
            >
              {amenities.error ? (
                <SectionError message={amenities.error} onRetry={retry} />
              ) : amenities.data.length === 0 ? (
                <p className="fin-empty">No amenities are available to assign.</p>
              ) : (
                <div className="li-amenities">
                  {amenities.data.map((amenity) => {
                    const checked = selectedAmenityIds.includes(amenity.id);
                    return (
                      <label
                        className={checked ? 'li-amenity li-amenity-on' : 'li-amenity'}
                        key={amenity.id}
                      >
                        <input
                          checked={checked}
                          disabled={!canManageLodges || isBusy}
                          type="checkbox"
                          onChange={(event) => toggleAmenity(amenity.id, event.target.checked)}
                        />
                        <span>{amenity.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </FinPanel>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
