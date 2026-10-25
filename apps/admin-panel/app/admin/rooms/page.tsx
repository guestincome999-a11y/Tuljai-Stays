'use client';

import type { Lodge, Room, RoomStatus, RoomType } from '@tuljai/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { listManageableRoomTypes, saveRoomType } from '../../../src/api/admin-room-types-api';
import {
  createGovernanceRoom,
  createGovernanceRoomType,
  listGovernanceLodges,
  listGovernanceRooms,
  updateGovernanceRoom,
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

const MAX_PRICE = 10_000_000;

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminRoomsPage() {
  return (
    <Suspense fallback={null}>
      <AdminRoomsPageContent />
    </Suspense>
  );
}

function AdminRoomsPageContent() {
  const auth = useAdminAuth();
  const searchParams = useSearchParams();
  const lodgeIdFromQuery = searchParams.get('lodgeId') ?? '';
  const canManage = hasPermission(auth.permissions, 'rooms.manage');
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [selectedLodgeId, setSelectedLodgeId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addRoomTypeFormVisible, setAddRoomTypeFormVisible] = useState(false);
  const [isCreatingRoomType, setIsCreatingRoomType] = useState(false);
  const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);
  const [isSavingRoomType, setIsSavingRoomType] = useState(false);
  // Rooms whose status change is in flight: their selector is disabled so a
  // second change can't race the first, and the admin sees it is working.
  const [pendingRoomIds, setPendingRoomIds] = useState<ReadonlySet<string>>(new Set());
  const summary = summarizeRooms(rooms);
  const activeRoomCountsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const room of rooms) {
      if (room.isActive) {
        counts.set(room.roomTypeId, (counts.get(room.roomTypeId) ?? 0) + 1);
      }
    }
    return counts;
  }, [rooms]);

  const loadLodges = useCallback(async () => {
    try {
      const response = await listGovernanceLodges({ page: 1, pageSize: 50 });
      setLodges(response.items);
      setSelectedLodgeId((current) => current || lodgeIdFromQuery || response.items[0]?.id || '');
    } catch {
      setErrorMessage('Lodges could not be loaded for room governance.');
    }
  }, [lodgeIdFromQuery]);

  /** Returns true only when both lists were refreshed from the server. */
  const loadRooms = useCallback(async (): Promise<boolean> => {
    if (!selectedLodgeId) {
      return false;
    }

    try {
      const [roomResponse, roomTypeResponse] = await Promise.all([
        listGovernanceRooms(selectedLodgeId),
        listManageableRoomTypes(selectedLodgeId),
      ]);
      setRooms(roomResponse);
      setRoomTypes(roomTypeResponse);
      return true;
    } catch (error) {
      setErrorMessage(errorText(error, 'Rooms could not be loaded. Please retry.'));
      return false;
    }
  }, [selectedLodgeId]);

  useEffect(() => {
    void loadLodges();
  }, [loadLodges]);

  useEffect(() => {
    setErrorMessage(null);
    void loadRooms();
    setEditingRoomTypeId(null);
    setAddRoomTypeFormVisible(false);
  }, [loadRooms]);

  async function changeRoomStatus(roomId: string, status: RoomStatus) {
    if (pendingRoomIds.has(roomId)) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingRoomIds((current) => new Set(current).add(roomId));
    let saved = false;
    try {
      await updateGovernanceRoomStatus(roomId, { status });
      saved = true;
    } catch (error) {
      setErrorMessage(errorText(error, 'Room status could not be updated.'));
    } finally {
      setPendingRoomIds((current) => {
        const next = new Set(current);
        next.delete(roomId);
        return next;
      });
    }

    if (!saved) {
      // Re-read so the selector shows what the server actually has.
      await loadRooms();
      return;
    }

    // The write succeeded; report the refresh separately so a failed refetch
    // is never mistaken for a failed save (or the other way round).
    const refreshed = await loadRooms();
    if (refreshed) {
      setSuccessMessage('Room status updated.');
    } else {
      setErrorMessage('Room status was saved, but the list could not be refreshed. Press Refresh.');
    }
  }

  async function submitRoomType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React clears event.currentTarget once the handler yields, so keep the
    // form element for the reset after the awaits below.
    const formElement = event.currentTarget;
    if (isCreatingRoomType) {
      return;
    }
    if (!selectedLodgeId) {
      setErrorMessage('Select a lodge before adding a room type.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const form = new FormData(formElement);
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
    const basePrice = Number(text('basePrice') || '0');
    const festivalPrice = optionalNumber('festivalPrice');
    const startingRoomNumber = optionalText('startingRoomNumber');
    const floor = optionalText('floor');

    const priceError = validatePrices(basePrice, festivalPrice);
    if (priceError) {
      setErrorMessage(priceError);
      return;
    }

    setIsCreatingRoomType(true);
    let createdRoomType: RoomType | null = null;
    let roomsCreated = 0;

    try {
      createdRoomType = await createGovernanceRoomType(selectedLodgeId, {
        basePrice,
        capacityAdults: Number(text('capacityAdults') || '1'),
        capacityChildren: Number(text('capacityChildren') || '0'),
        description: optionalText('description'),
        festivalPrice,
        name,
        slug,
        totalRooms,
      });

      for (let index = 0; index < totalRooms; index += 1) {
        const roomNumber = startingRoomNumber
          ? String(Number(startingRoomNumber) + index)
          : `${slug}-${index + 1}`;
        await createGovernanceRoom(createdRoomType.id, { floor, roomNumber });
        roomsCreated += 1;
      }

      const refreshed = await loadRooms();
      if (refreshed) {
        setSuccessMessage(
          roomsCreated > 0
            ? `Room type "${createdRoomType.name}" added with ${roomsCreated} room(s).`
            : `Room type "${createdRoomType.name}" added.`,
        );
      } else {
        setErrorMessage(
          `Room type "${createdRoomType.name}" was created, but the list could not be refreshed. Press Refresh.`,
        );
      }
      setAddRoomTypeFormVisible(false);
      formElement.reset();
    } catch (error) {
      if (createdRoomType) {
        // The room type exists on the server; only creating its rooms failed.
        await loadRooms();
        setErrorMessage(
          `Room type "${createdRoomType.name}" was created with ${roomsCreated} of ${totalRooms} room(s). ${errorText(error, 'Creating the remaining rooms failed.')}`,
        );
      } else {
        setErrorMessage(errorText(error, 'The room type could not be created.'));
      }
    } finally {
      setIsCreatingRoomType(false);
    }
  }

  async function submitRoomTypeEdit(event: FormEvent<HTMLFormElement>, roomType: RoomType) {
    event.preventDefault();
    if (isSavingRoomType) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };

    const basePrice = Number(text('basePrice') || '0');
    // Blank means "clear it" (null). Omitting the field would leave the old
    // value in the database, so the admin could never remove a festival price
    // or a description.
    const festivalPrice = text('festivalPrice') ? Number(text('festivalPrice')) : null;
    const description = text('description') || null;
    const targetRoomCount = Number(text('totalRooms') || '0');

    const priceError = validatePrices(basePrice, festivalPrice ?? undefined);
    if (priceError) {
      setErrorMessage(priceError);
      return;
    }
    if (!Number.isInteger(targetRoomCount) || targetRoomCount < 0) {
      setErrorMessage('Number of rooms must be a whole number, 0 or more.');
      return;
    }

    setIsSavingRoomType(true);
    let updated: RoomType | null = null;

    try {
      updated = await saveRoomType(roomType.id, {
        basePrice,
        capacityAdults: Number(text('capacityAdults') || '1'),
        capacityChildren: Number(text('capacityChildren') || '0'),
        description,
        festivalPrice,
        isActive: form.get('isActive') === 'on',
        name: text('name'),
        totalRooms: targetRoomCount,
      });

      const roomsOfType = rooms.filter((room) => room.roomTypeId === roomType.id);
      const activeRoomsOfType = roomsOfType.filter((room) => room.isActive);
      const diff = targetRoomCount - activeRoomsOfType.length;

      let note = '';

      if (diff > 0) {
        const existingNumbers = new Set(roomsOfType.map((room) => room.roomNumber));
        let created = 0;
        let attempt = roomsOfType.length + 1;
        let guard = 0;
        while (created < diff && guard < diff + 50) {
          guard += 1;
          const roomNumber = `${updated.slug}-${attempt}`;
          attempt += 1;
          if (existingNumbers.has(roomNumber)) {
            continue;
          }
          await createGovernanceRoom(roomType.id, { roomNumber });
          created += 1;
        }
        note = ` Added ${created} room(s).`;
      } else if (diff < 0) {
        const removable = activeRoomsOfType
          .filter((room) => room.status === 'AVAILABLE')
          .sort((a, b) => b.roomNumber.localeCompare(a.roomNumber, undefined, { numeric: true }))
          .slice(0, Math.abs(diff));

        for (const room of removable) {
          await updateGovernanceRoom(room.id, { isActive: false });
        }

        note =
          removable.length === Math.abs(diff)
            ? ` Removed ${removable.length} room(s).`
            : ` Removed ${removable.length} of ${Math.abs(diff)} requested room(s); the rest are not currently available (occupied, reserved, or blocked) and were left untouched.`;
      }

      const refreshed = await loadRooms();
      if (refreshed) {
        setSuccessMessage(`Room type "${updated.name}" updated.${note}`);
      } else {
        setErrorMessage(
          `Room type "${updated.name}" was saved.${note} The list could not be refreshed, so press Refresh to see the new values.`,
        );
      }
      setEditingRoomTypeId(null);
    } catch (error) {
      if (updated) {
        // The price and details are already saved; only the follow-up room
        // adjustment failed. Re-read so the screen shows what is really stored
        // and say exactly which part succeeded.
        await loadRooms();
        setErrorMessage(
          `Price and details for "${updated.name}" were saved, but adjusting the room count failed: ${errorText(error, 'unknown error')}`,
        );
      } else {
        setErrorMessage(errorText(error, 'The room type could not be updated.'));
      }
    } finally {
      setIsSavingRoomType(false);
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
          <div className="admin-table governance-room-type-table">
            <div className="admin-table-row admin-table-head">
              <span>Room type</span>
              <span>Price</span>
              <span>Capacity</span>
              <span>Rooms</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {roomTypes.map((roomType) => (
              <RoomTypeRow
                activeRoomCount={activeRoomCountsByType.get(roomType.id) ?? 0}
                canManage={canManage}
                isEditing={editingRoomTypeId === roomType.id}
                isSaving={isSavingRoomType && editingRoomTypeId === roomType.id}
                key={roomType.id}
                onCancelEdit={() => setEditingRoomTypeId(null)}
                onStartEdit={() => setEditingRoomTypeId(roomType.id)}
                onSubmitEdit={(event) => void submitRoomTypeEdit(event, roomType)}
                roomType={roomType}
              />
            ))}
          </div>
          {roomTypes.length === 0 ? (
            <p className="empty-table">No room types configured for this lodge yet.</p>
          ) : null}
        </section>

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
                <span className="status-card">
                  {pendingRoomIds.has(room.id) ? 'Saving…' : formatGovernanceStatus(room.status)}
                  {room.isActive ? '' : ' · Inactive'}
                </span>
                <span className="row-actions">
                  <select
                    disabled={!canManage || pendingRoomIds.has(room.id)}
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

function validatePrices(basePrice: number, festivalPrice: number | undefined): string | null {
  if (!Number.isFinite(basePrice) || basePrice < 0 || basePrice > MAX_PRICE) {
    return `Base price must be a number between 0 and ${MAX_PRICE.toLocaleString('en-IN')}.`;
  }
  if (
    festivalPrice !== undefined &&
    (!Number.isFinite(festivalPrice) || festivalPrice < 0 || festivalPrice > MAX_PRICE)
  ) {
    return `Festival price must be a number between 0 and ${MAX_PRICE.toLocaleString('en-IN')}.`;
  }
  return null;
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

function RoomTypeRow({
  activeRoomCount,
  canManage,
  isEditing,
  isSaving,
  onCancelEdit,
  onStartEdit,
  onSubmitEdit,
  roomType,
}: {
  activeRoomCount: number;
  canManage: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  roomType: RoomType;
}) {
  if (isEditing) {
    return (
      <form className="panel form-stack governance-room-type-edit" onSubmit={onSubmitEdit}>
        <h3>Edit {roomType.name}</h3>
        <div className="control-grid">
          <Field defaultValue={roomType.name} label="Room type name" name="name" required />
          <Field
            defaultValue={roomType.basePrice}
            label="Base price (₹ per night)"
            min="0"
            name="basePrice"
            required
            step="0.01"
            type="number"
          />
          <Field
            defaultValue={roomType.festivalPrice ?? ''}
            label="Festival price (₹, leave blank to clear)"
            min="0"
            name="festivalPrice"
            step="0.01"
            type="number"
          />
          <Field
            defaultValue={roomType.capacityAdults}
            label="Adult capacity"
            min="1"
            name="capacityAdults"
            required
            type="number"
          />
          <Field
            defaultValue={roomType.capacityChildren}
            label="Children capacity"
            min="0"
            name="capacityChildren"
            required
            type="number"
          />
          <Field
            defaultValue={activeRoomCount}
            label="Number of rooms of this type"
            min="0"
            name="totalRooms"
            required
            type="number"
          />
        </div>
        <label className="form-field">
          <span>Description (optional)</span>
          <textarea defaultValue={roomType.description ?? ''} name="description" rows={3} />
        </label>
        <label className="checkbox-row">
          <input defaultChecked={roomType.isActive} name="isActive" type="checkbox" />
          <span>Room type is active and bookable</span>
        </label>
        <p className="muted-copy">
          Increasing the room count adds new rooms automatically. Decreasing it deactivates the
          highest-numbered rooms that are currently available; occupied, reserved, or blocked
          rooms are left untouched.
        </p>
        <div className="row-actions">
          <button className="button button-primary" disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            className="button button-secondary"
            disabled={isSaving}
            onClick={onCancelEdit}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="admin-table-row">
      <span>{roomType.name}</span>
      <span>
        ₹{roomType.basePrice}
        {roomType.festivalPrice ? ` · Festival ₹${roomType.festivalPrice}` : ''}
      </span>
      <span>
        {roomType.capacityAdults} adults, {roomType.capacityChildren} children
      </span>
      <span>{activeRoomCount}</span>
      <span className="status-card">{roomType.isActive ? 'Active' : 'Inactive'}</span>
      <span className="row-actions">
        <button
          className="button button-secondary"
          disabled={!canManage}
          onClick={onStartEdit}
          type="button"
        >
          Edit
        </button>
      </span>
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
