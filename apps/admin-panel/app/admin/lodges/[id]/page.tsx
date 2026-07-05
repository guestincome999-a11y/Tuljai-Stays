'use client';

import type { Amenity, LodgeDetails, LodgePhoto, Room, RoomStatus, RoomType } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  assignGovernanceAmenities,
  getGovernanceLodge,
  listGovernanceAmenities,
  listGovernanceLodgePhotos,
  listGovernanceRooms,
  listGovernanceRoomTypes,
  updateGovernanceLodgeStatus,
  updateGovernancePhotoApproval,
  updateGovernanceRoomStatus,
  verifyGovernanceLodge,
} from '../../../../src/api/admin-governance-api';
import { useAdminAuth } from '../../../../src/auth/AdminAuthProvider';
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

interface LodgeDetailState {
  amenities: Amenity[];
  errorMessage: string | null;
  isLoading: boolean;
  lodge: LodgeDetails | null;
  photos: LodgePhoto[];
  rooms: Room[];
  roomTypes: RoomType[];
  successMessage: string | null;
}

export default function AdminLodgeDetailPage({ params }: { params: { id: string } }) {
  const auth = useAdminAuth();
  const canManageLodges = hasPermission(auth.permissions, 'lodges.manage');
  const canManageRooms = hasPermission(auth.permissions, 'rooms.manage');
  const canReviewPhotos = hasPermission(auth.permissions, 'photos.review');
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [state, setState] = useState<LodgeDetailState>({
    amenities: [],
    errorMessage: null,
    isLoading: true,
    lodge: null,
    photos: [],
    rooms: [],
    roomTypes: [],
    successMessage: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, errorMessage: null, isLoading: true }));
    try {
      const [lodge, roomTypes, rooms, photos, amenities] = await Promise.all([
        getGovernanceLodge(params.id),
        listGovernanceRoomTypes(params.id),
        listGovernanceRooms(params.id),
        listGovernanceLodgePhotos(params.id),
        listGovernanceAmenities(),
      ]);
      setState({
        amenities,
        errorMessage: null,
        isLoading: false,
        lodge,
        photos,
        rooms,
        roomTypes,
        successMessage: null,
      });
      setSelectedAmenityIds(lodge.amenities.map((amenity) => amenity.id));
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'Lodge governance detail could not be loaded.',
        isLoading: false,
      }));
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const roomSummary = useMemo(() => summarizeRooms(state.rooms), [state.rooms]);
  const photoSummary = useMemo(() => summarizePhotos(state.photos), [state.photos]);
  const readinessReasons = useMemo(
    () =>
      state.lodge
        ? getLodgeReadinessReasons(state.lodge, state.roomTypes, state.photos)
        : ['Lodge detail unavailable'],
    [state.lodge, state.photos, state.roomTypes],
  );

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setState((current) => ({ ...current, errorMessage: null, successMessage: null }));
    try {
      await action();
      await load();
      setState((current) => ({ ...current, successMessage }));
    } catch {
      setState((current) => ({
        ...current,
        errorMessage: 'Action failed. Please verify permissions and retry.',
      }));
    }
  }

  if (state.isLoading) {
    return (
      <PermissionGate permission="lodges.view">
        <section className="panel">
          <p className="eyebrow">Loading</p>
          <h2>Loading lodge governance detail</h2>
        </section>
      </PermissionGate>
    );
  }

  if (!state.lodge) {
    return (
      <PermissionGate permission="lodges.view">
        <section className="panel">
          <p className="eyebrow">Unavailable</p>
          <h2>Lodge could not be opened</h2>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Retry
          </button>
        </section>
      </PermissionGate>
    );
  }

  return (
    <PermissionGate permission="lodges.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Lodge Governance Detail</p>
            <h2>{state.lodge.name}</h2>
            <p className="muted-copy">
              {state.lodge.address
                ? `${state.lodge.address.addressLine1}, ${state.lodge.address.city}`
                : 'Address pending'}
            </p>
          </div>
          <div className="hero-actions">
            <span className="status-card">{formatGovernanceStatus(state.lodge.status)}</span>
            <span className="status-card">
              {formatGovernanceStatus(state.lodge.verificationStatus)}
            </span>
            <Link className="button button-secondary" href="/admin/lodges">
              Back to lodges
            </Link>
          </div>
        </section>

        {state.errorMessage ? (
          <section className="error-banner">{state.errorMessage}</section>
        ) : null}
        {state.successMessage ? (
          <section className="success-banner">
            {state.successMessage}
            <button
              className="ghost-control"
              type="button"
              onClick={() => setState((current) => ({ ...current, successMessage: null }))}
            >
              Dismiss
            </button>
          </section>
        ) : null}

        <section className="grid grid-4">
          <MetricCard label="Room types" value={state.roomTypes.length} />
          <MetricCard label="Rooms" value={roomSummary.total} />
          <MetricCard label="Available" value={roomSummary.available} />
          <MetricCard label="Pending photos" value={photoSummary.pending} />
        </section>

        <section className={readinessReasons.length ? 'panel warning-panel' : 'panel'}>
          <p className="eyebrow">Publication Readiness</p>
          <h3>{readinessReasons.length ? 'Needs attention' : 'Ready for discovery'}</h3>
          {readinessReasons.length ? (
            <ul className="governance-list">
              {readinessReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">
              Status, verification, rooms, address, and photos are ready.
            </p>
          )}
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Verification</p>
            <h3>Moderation controls</h3>
            <div className="quick-actions">
              {lodgeStatuses.map((status) => (
                <button
                  className="button button-secondary"
                  disabled={!canManageLodges || state.lodge?.status === status}
                  key={status}
                  type="button"
                  onClick={() =>
                    void runAction(
                      () => updateGovernanceLodgeStatus(params.id, { status }),
                      `Lodge status changed to ${formatGovernanceStatus(status)}.`,
                    )
                  }
                >
                  {formatGovernanceStatus(status)}
                </button>
              ))}
            </div>
            <label className="form-field">
              <span>Verification notes</span>
              <textarea
                disabled={!canManageLodges}
                value={verificationNotes}
                onChange={(event) => setVerificationNotes(event.target.value)}
              />
            </label>
            <div className="quick-actions">
              {verificationStatuses.map((verificationStatus) => (
                <button
                  className="button button-primary"
                  disabled={!canManageLodges}
                  key={verificationStatus}
                  type="button"
                  onClick={() =>
                    void runAction(
                      () =>
                        verifyGovernanceLodge(params.id, {
                          notes: verificationNotes || undefined,
                          verificationStatus,
                        }),
                      `Verification changed to ${formatGovernanceStatus(verificationStatus)}.`,
                    )
                  }
                >
                  {formatGovernanceStatus(verificationStatus)}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Amenity Governance</p>
            <h3>Assigned amenities</h3>
            <div className="amenity-checklist">
              {state.amenities.map((amenity) => (
                <label key={amenity.id}>
                  <input
                    checked={selectedAmenityIds.includes(amenity.id)}
                    disabled={!canManageLodges}
                    type="checkbox"
                    onChange={(event) => {
                      setSelectedAmenityIds((current) =>
                        event.target.checked
                          ? [...current, amenity.id]
                          : current.filter((id) => id !== amenity.id),
                      );
                    }}
                  />
                  <span>{amenity.name}</span>
                </label>
              ))}
            </div>
            <button
              className="button button-primary"
              disabled={!canManageLodges}
              type="button"
              onClick={() =>
                void runAction(
                  () => assignGovernanceAmenities(params.id, { amenityIds: selectedAmenityIds }),
                  'Amenities updated.',
                )
              }
            >
              Save Amenities
            </button>
          </section>
        </section>

        <section className="table-panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Rooms</p>
              <h3>Room status governance</h3>
            </div>
            <Link className="ghost-control" href={`/admin/rooms?lodgeId=${params.id}`}>
              Open Rooms Center
            </Link>
          </div>
          <div className="admin-table governance-room-table">
            <div className="admin-table-row admin-table-head">
              <span>Room</span>
              <span>Type</span>
              <span>Floor</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {state.rooms.map((room) => (
              <div className="admin-table-row" key={room.id}>
                <span>{room.roomNumber}</span>
                <span>{getRoomTypeLabel(room.roomTypeId, state.roomTypes)}</span>
                <span>{room.floor ?? 'Not set'}</span>
                <span className="status-card">{formatGovernanceStatus(room.status)}</span>
                <span>
                  <RoomStatusSelect
                    disabled={!canManageRooms}
                    status={room.status}
                    onChange={(status) =>
                      void runAction(
                        () => updateGovernanceRoomStatus(room.id, { status }),
                        'Room status updated.',
                      )
                    }
                  />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="table-panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Photos</p>
              <h3>Photo governance</h3>
            </div>
            <Link className="ghost-control" href="/admin/photos">
              Review Pending Photos
            </Link>
          </div>
          <div className="photo-grid">
            {state.photos.map((photo) => (
              <article className="photo-card" key={photo.id}>
                <img
                  alt={`${state.lodge?.name} ${photo.category}`}
                  src={photo.thumbnailUrl ?? photo.fileUrl}
                />
                <strong>{formatGovernanceStatus(photo.category)}</strong>
                <span className="status-card">{formatGovernanceStatus(photo.approvalStatus)}</span>
                <div className="row-actions">
                  <button
                    className="ghost-control"
                    disabled={!canReviewPhotos || photo.approvalStatus === 'APPROVED'}
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
                    className="ghost-control"
                    disabled={!canReviewPhotos || photo.approvalStatus === 'REJECTED'}
                    type="button"
                    onClick={() =>
                      void runAction(
                        () =>
                          updateGovernancePhotoApproval(photo.id, 'REJECTED', {
                            rejectionReason: photoRejectReasons[0] ?? 'Photo rejected by admin',
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
        </section>
      </div>
    </PermissionGate>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">TS</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function RoomStatusSelect({
  disabled,
  onChange,
  status,
}: {
  disabled: boolean;
  onChange: (status: RoomStatus) => void;
  status: RoomStatus;
}) {
  return (
    <select
      disabled={disabled}
      value={status}
      onChange={(event) => onChange(event.target.value as RoomStatus)}
    >
      {roomStatuses.map((roomStatus) => (
        <option key={roomStatus} value={roomStatus}>
          {formatGovernanceStatus(roomStatus)}
        </option>
      ))}
    </select>
  );
}
