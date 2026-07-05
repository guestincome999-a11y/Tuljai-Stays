import type { LodgePhoto, Room, RoomStatus, RoomType } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import {
  createPhotoMetadata,
  createRoom,
  createRoomType,
  listOwnerPhotos,
  listRooms,
  listRoomTypes,
  updateRoomStatus,
  updateRoomType,
  type PhotoMetadataInput,
  type RoomInput,
  type RoomTypeInput,
} from '../api/owner-rooms-api';
import { loadHousekeepingNotes, saveHousekeepingNote } from '../storage/housekeeping-notes-store';
import { loadRoomBoardCache, saveRoomBoardCache } from '../storage/room-board-cache';

interface RoomOperationsState {
  errorMessage: string | null;
  housekeepingNotes: Record<string, string>;
  isLoading: boolean;
  isRefreshing: boolean;
  photos: LodgePhoto[];
  rooms: Room[];
  roomTypes: RoomType[];
}

export function useRoomOperations() {
  const assignedLodges = useAssignedLodges();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const [state, setState] = useState<RoomOperationsState>({
    errorMessage: null,
    housekeepingNotes: {},
    isLoading: true,
    isRefreshing: false,
    photos: [],
    rooms: [],
    roomTypes: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (!lodgeId) {
        setState((current) => ({
          ...current,
          errorMessage: 'No lodge selected.',
          isLoading: false,
          isRefreshing: false,
          photos: [],
          rooms: [],
          roomTypes: [],
        }));
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: null,
        isLoading: !refreshing && current.rooms.length === 0 && current.roomTypes.length === 0,
        isRefreshing: refreshing,
      }));

      const notes = await loadHousekeepingNotes().catch(() => ({}));

      if (isOffline) {
        const cached = await loadRoomBoardCache().catch(() => null);
        setState((current) => ({
          ...current,
          errorMessage:
            current.rooms.length || cached ? null : 'Connect to the internet to load rooms.',
          housekeepingNotes: notes,
          isLoading: false,
          isRefreshing: false,
          photos: current.photos.length ? current.photos : (cached?.photos ?? current.photos),
          rooms: current.rooms.length ? current.rooms : (cached?.rooms ?? current.rooms),
          roomTypes: current.roomTypes.length
            ? current.roomTypes
            : (cached?.roomTypes ?? current.roomTypes),
        }));
        return;
      }

      try {
        const [roomTypes, rooms, photos] = await Promise.all([
          listRoomTypes(lodgeId),
          listRooms(lodgeId),
          listOwnerPhotos(lodgeId),
        ]);
        setState({
          errorMessage: null,
          housekeepingNotes: notes,
          isLoading: false,
          isRefreshing: false,
          photos,
          rooms,
          roomTypes,
        });
        await saveRoomBoardCache({ photos, rooms, roomTypes }).catch(() => undefined);
      } catch {
        const cached = await loadRoomBoardCache().catch(() => null);
        setState((current) => ({
          ...current,
          errorMessage: cached
            ? 'Showing last saved room board. Refresh when online.'
            : 'Room operations could not be loaded.',
          housekeepingNotes: notes,
          isLoading: false,
          isRefreshing: false,
          photos: current.photos.length ? current.photos : (cached?.photos ?? current.photos),
          rooms: current.rooms.length ? current.rooms : (cached?.rooms ?? current.rooms),
          roomTypes: current.roomTypes.length
            ? current.roomTypes
            : (cached?.roomTypes ?? current.roomTypes),
        }));
      }
    },
    [isOffline, lodgeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      realtime.lastEvent?.name === 'room:availability-updated' ||
      realtime.lastEvent?.name === 'room:status-updated'
    ) {
      void load(true);
    }
  }, [load, realtime.lastEvent]);

  const roomTypeById = useMemo(
    () => new Map(state.roomTypes.map((roomType) => [roomType.id, roomType])),
    [state.roomTypes],
  );

  const runMutation = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      if (isOffline) {
        setState((current) => ({
          ...current,
          errorMessage: 'Connect to the internet to complete this action.',
        }));
        return false;
      }

      setIsSubmitting(true);
      setSuccessMessage(null);

      try {
        await action();
        setSuccessMessage(success);
        await load(true);
        return true;
      } catch {
        setState((current) => ({
          ...current,
          errorMessage: 'Update failed. Please check details and try again.',
        }));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isOffline, load],
  );

  return {
    ...state,
    createPhotoMetadata: (input: PhotoMetadataInput) =>
      lodgeId
        ? runMutation(() => createPhotoMetadata(lodgeId, input), 'Photo metadata submitted.')
        : Promise.resolve(false),
    createRoom: (roomTypeId: string, input: RoomInput) =>
      runMutation(() => createRoom(roomTypeId, input), 'Room created.'),
    createRoomType: (input: RoomTypeInput) =>
      lodgeId
        ? runMutation(() => createRoomType(lodgeId, input), 'Room type saved.')
        : Promise.resolve(false),
    isOffline,
    isSubmitting,
    refresh: () => load(true),
    roomTypeById,
    saveHousekeepingNote: async (roomId: string, note: string) => {
      await saveHousekeepingNote(roomId, note);
      setState((current) => ({
        ...current,
        housekeepingNotes: { ...current.housekeepingNotes, [roomId]: note },
      }));
      setSuccessMessage('Housekeeping note saved locally.');
    },
    setSuccessMessage,
    successMessage,
    updateRoomStatus: (roomId: string, status: RoomStatus) =>
      runMutation(() => updateRoomStatus(roomId, status), 'Room status updated.'),
    updateRoomType: (roomTypeId: string, input: Partial<RoomTypeInput> & { isActive?: boolean }) =>
      runMutation(() => updateRoomType(roomTypeId, input), 'Room type updated.'),
  };
}
