'use client';

import type { Lodge, Room, RoomStatus, RoomType } from '@tuljai/types';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  createGovernanceRoom,
  createGovernanceRoomType,
  listGovernanceLodges,
  listGovernanceRooms,
  listGovernanceRoomTypes,
  updateGovernanceRoomStatus,
} from '../../../src/api/admin-governance-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  formatGovernanceStatus,
  getRoomTypeLabel,
  roomStatuses,
  summarizeRooms,
} from '../../../src/governance/governance-utils';
import { hasPermission } from '../../../src/permissions/permissions';

export default function AdminRoomsPage() {
  const auth = useAdminAuth();
  const canManage = hasPermission(auth.permissions, 'rooms.manage');
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [selectedLodgeId, setSelectedLodgeId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addRoomTypeFormVisible, setAddRoomTypeFormVisible] = useState(false);
  const [isCreatingRoomType, setIsCreatingRoomType] = useState(false);
  const summary = summarizeRooms(rooms);

  const loadLodges = useCallback(async () => {
    try {
      const response = await listGovernanceLodges({ page: 1, pageSize: 50 });
      setLodges(response.items);
      setSelectedLodgeId((current) => current || response.items[0]?.id || '');
    } catch {
      setErrorMessage('Lodges could not be loaded for room governance.');
    }
  }, []);

  const loadRooms = useCallback(async () => {
    if (!selectedLodgeId) {
      return;
    }

    setErrorMessage(null);
    try {
      const [roomResponse, roomTypeResponse] = await Promise.all([
        listGovernanceRooms(selectedLodgeId),
        listGovernanceRoomTypes(selectedLodgeId),
      ]);
      setRooms(roomResponse);
      setRoomTypes(roomTypeResponse);
    } catch {
      setErrorMessage('Rooms could not be loaded. Please retry.');
    }
  }, [selectedLodgeId]);

  useEffect(() => {
    void loadLodges();
  }, [loadLodges]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  async function changeRoomStatus(roomId: string, status: RoomStatus) {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateGovernanceRoomStatus(roomId, { status });
      await loadRooms();
      setSuccessMessage('Room status updated.');
    } catch {
      setErrorMessage('Room status could not be updated.');
    }
  }

  async function submitRoomType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLodgeId) {
      setErrorMessage('Select a lodge before adding a room type.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsCreatingRoomType(true);

    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const optionalText = (name: string) => text(name) || undefined;
    const optionalNumber = (name: string) => {
      const value = text(name);
      return value ? Number(value) : undefined;
    };

    const name = text('name');
    const slug = text('slug') || slugify(name);
    const totalRooms = Number(text('totalRooms') || '0');
    const startingRoomNumber = optionalText('startingRoomNumber');
    const floor = optionalText('floor');

    try {
      const roomType = await createGovernanceRoomType(selectedLodgeId, {
        basePrice: Number(text('basePrice') || '0'),
        capacityAdults: Number(text('capacityAdults') || '1'),
        capacityChildren: Number(text('capacityChildren') || '0'),
        description: optionalText('description'),
        festivalPrice: optionalNumber('festivalPrice'),
        name,
        slug,
        totalRooms,
      });

      let roomsCreated = 0;
      for (let index = 0; index < totalRooms; index += 1) {
        const roomNumber = startingRoomNumber
          ? String(Number(startingRoomNumber) + index)
          : `${slug}-${index + 1}`;
        await createGovernanceRoom(roomType.id, { floor, roomNumber });
        roomsCreated += 1;
      }

      await loadRooms();
      setSuccessMessage(
        roomsCreated > 0
          ? `Room type "${roomType.name}" added with ${roomsCreated} room(s).`
          : `Room type "${roomType.name}" added.`,
      );
      setAddRoomTypeFormVisible(false);
      event.currentTarget.reset();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The room type could not be created.',
      );
    } finally {
      setIsCreatingRoomType(false);
    }
  }

  return (
    <PermissionGate permission="rooms.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Room Governance</p>
            <h2>Rooms and availability controls</h2>
            <p className="muted-copy">
              Block, release, clean, or put rooms into maintenance from one operations surface.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void loadRooms()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="grid grid-4">
          <MetricCard label="Total rooms" value={summary.total} />
          <MetricCard label="Available" value={summary.available} />
          <MetricCard label="Occupied" value={summary.occupied} />
          <MetricCard label="Maintenance" value={summary.maintenance + summary.blocked} />
        </section>

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Lodge</span>
              <select
                value={selectedLodgeId}
                onChange={(event) => setSelectedLodgeId(event.target.value)}
              >
                {lodges.map((lodge) => (
                  <option key={lodge.id} value={lodge.id}>
                    {lodge.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {canManage ? (
            <div className="row-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={!selectedLodgeId}
                onClick={() => setAddRoomTypeFormVisible((current) => !current)}
              >
                {addRoomTypeFormVisible ? 'Close' : 'Add Room Type'}
              </button>
            </div>
          ) : null}
        </section>

        {canManage && addRoomTypeFormVisible ? (
          <form className="panel form-stack" onSubmit={(event) => void submitRoomType(event)}>
            <h3>Add room type</h3>
            <p className="muted-copy">
              Create a room type for the selected lodge, then generate its rooms in one step.
            </p>
            <div className="control-grid">
              <Field label="Room type name" name="name" placeholder="Deluxe AC Room" required />
              <Field
                label="Slug (optional, auto-generated)"
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="deluxe-ac-room"
                title="Use lowercase letters, numbers, and hyphens."
              />
              <Field
                label="Base price (₹ per night)"
                name="basePrice"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <Field
                label="Festival price (₹, optional)"
                name="festivalPrice"
                type="number"
                min="0"
                step="0.01"
              />
              <Field
                label="Adult capacity"
                name="capacityAdults"
                type="number"
                min="1"
                defaultValue="2"
                required
              />
              <Field
                label="Children capacity"
                name="capacityChildren"
                type="number"
                min="0"
                defaultValue="0"
                required
              />
              <Field
                label="Number of rooms of this type"
                name="totalRooms"
                type="number"
                min="1"
                defaultValue="1"
                required
              />
              <Field
                label="Starting room number (optional)"
                name="startingRoomNumber"
                type="number"
                min="1"
                placeholder="e.g. 101"
              />
              <Field label="Floor (optional, applies to all)" name="floor" placeholder="1" />
            </div>
            <label className="form-field">
              <span>Description (optional)</span>
              <textarea name="description" rows={3} />
            </label>
            <div className="row-actions">
              <button className="button button-primary" disabled={isCreatingRoomType} type="submit">
                {isCreatingRoomType ? 'Creating…' : 'Create Room Type & Rooms'}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setAddRoomTypeFormVisible(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <section className="table-panel">
          <div className="admin-table governance-room-table">
            <div className="admin-table-row admin-table-head">
              <span>Room</span>
              <span>Lodge</span>
              <span>Type</span>
              <span>Floor</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {rooms.map((room) => (
              <div className="admin-table-row" key={room.id}>
                <span>{room.roomNumber}</span>
                <span>
                  {lodges.find((lodge) => lodge.id === room.lodgeId)?.name ?? 'Selected lodge'}
                </span>
                <span>{getRoomTypeLabel(room.roomTypeId, roomTypes)}</span>
                <span>{room.floor ?? 'Not set'}</span>
                <span className="status-card">{formatGovernanceStatus(room.status)}</span>
                <span className="row-actions">
                  <select
                    disabled={!canManage}
                    value={room.status}
                    onChange={(event) =>
                      void changeRoomStatus(room.id, event.target.value as RoomStatus)
                    }
                  >
                    {roomStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatGovernanceStatus(status)}
                      </option>
                    ))}
                  </select>
                  <Link className="ghost-control" href={`/admin/lodges/${room.lodgeId}`}>
                    Lodge
                  </Link>
                </span>
              </div>
            ))}
          </div>
          {rooms.length === 0 ? (
            <p className="empty-table">No rooms found for this lodge.</p>
          ) : null}
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

function Field({
  label,
  ...inputProps
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      <span>{label}</span>
      <input {...inputProps} />
    </label>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
