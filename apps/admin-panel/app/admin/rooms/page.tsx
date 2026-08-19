'use client';

import type { Lodge, Room, RoomStatus, RoomType } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  listGovernanceLodges,
  listGovernanceRooms,
  listGovernanceRoomTypes,
  updateGovernanceRoomStatus,
  updateGovernanceRoomType,
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
    if (!selectedLodgeId) return;
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

  useEffect(() => { void loadLodges(); }, [loadLodges]);
  useEffect(() => { void loadRooms(); }, [loadRooms]);

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

  async function updatePrice(roomType: RoomType) {
    const basePrice = window.prompt(`Base price per night for ${roomType.name}`, String(roomType.basePrice));
    if (basePrice === null) return;
    const parsedBasePrice = Number(basePrice);
    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
      setErrorMessage('Base price must be zero or greater.');
      return;
    }

    const festivalPrice = window.prompt(
      `Festival price per night for ${roomType.name} (optional)`,
      String(roomType.festivalPrice ?? parsedBasePrice),
    );
    if (festivalPrice === null) return;
    const parsedFestivalPrice = Number(festivalPrice);
    if (!Number.isFinite(parsedFestivalPrice) || parsedFestivalPrice < 0) {
      setErrorMessage('Festival price must be zero or greater.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateGovernanceRoomType(roomType.id, {
        basePrice: parsedBasePrice,
        festivalPrice: parsedFestivalPrice,
      });
      await loadRooms();
      setSuccessMessage(`${roomType.name} pricing updated successfully.`);
    } catch {
      setErrorMessage('Room pricing could not be updated.');
    }
  }

  return (
    <PermissionGate permission="rooms.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Room Governance & Pricing</p>
            <h2>Rooms, rates and availability controls</h2>
            <p className="muted-copy">
              Manage published room pricing, festival pricing and operational room status from one controlled admin surface.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void loadRooms()}>Refresh</button>
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
          <label>
            <span>Lodge</span>
            <select value={selectedLodgeId} onChange={(event) => setSelectedLodgeId(event.target.value)}>
              {lodges.map((lodge) => <option key={lodge.id} value={lodge.id}>{lodge.name}</option>)}
            </select>
          </label>
        </section>

        <section className="table-panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Published rates</p>
              <h3>Room type pricing</h3>
            </div>
            <span className="muted-copy">Prices are per night.</span>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head"><span>Room type</span><span>Capacity</span><span>Base price</span><span>Festival price</span><span>Rooms</span><span>Action</span></div>
            {roomTypes.map((roomType) => (
              <div className="admin-table-row" key={roomType.id}>
                <span><strong>{roomType.name}</strong><small>{roomType.description || 'No description'}</small></span>
                <span>{roomType.capacityAdults} adults · {roomType.capacityChildren} children</span>
                <span>₹{Number(roomType.basePrice).toLocaleString('en-IN')}</span>
                <span>₹{Number(roomType.festivalPrice ?? roomType.basePrice).toLocaleString('en-IN')}</span>
                <span>{roomType.totalRooms}</span>
                <span><button className="ghost-control" disabled={!canManage} type="button" onClick={() => void updatePrice(roomType)}>Edit pricing</button></span>
              </div>
            ))}
          </div>
          {roomTypes.length === 0 ? <p className="empty-table">No room types found for this lodge.</p> : null}
        </section>

        <section className="table-panel">
          <div className="section-header">
            <div><p className="eyebrow">Inventory</p><h3>Room status governance</h3></div>
          </div>
          <div className="admin-table governance-room-table">
            <div className="admin-table-row admin-table-head"><span>Room</span><span>Lodge</span><span>Type</span><span>Floor</span><span>Status</span><span>Action</span></div>
            {rooms.map((room) => (
              <div className="admin-table-row" key={room.id}>
                <span>{room.roomNumber}</span>
                <span>{lodges.find((lodge) => lodge.id === room.lodgeId)?.name ?? 'Selected lodge'}</span>
                <span>{getRoomTypeLabel(room.roomTypeId, roomTypes)}</span>
                <span>{room.floor ?? 'Not set'}</span>
                <span className="status-card">{formatGovernanceStatus(room.status)}</span>
                <span className="row-actions">
                  <select disabled={!canManage} value={room.status} onChange={(event) => void changeRoomStatus(room.id, event.target.value as RoomStatus)}>
                    {roomStatuses.map((status) => <option key={status} value={status}>{formatGovernanceStatus(status)}</option>)}
                  </select>
                  <Link className="ghost-control" href={`/admin/lodges/${room.lodgeId}`}>Lodge</Link>
                </span>
              </div>
            ))}
          </div>
          {rooms.length === 0 ? <p className="empty-table">No rooms found for this lodge.</p> : null}
        </section>
      </div>
    </PermissionGate>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <div className="kpi-card"><span className="kpi-icon">TS</span><div><span className="kpi-label">{label}</span><strong>{value}</strong></div></div>;
}
