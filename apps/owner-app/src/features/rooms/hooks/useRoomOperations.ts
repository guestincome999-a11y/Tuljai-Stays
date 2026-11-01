import type { LodgePhoto, ManualBookingBlock, Room, RoomStatus, RoomType } from '@tuljai/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../../../auth/auth-context';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import {
  createManualBooking,
  createPhotoMetadata,
  createRoom,
  createRoomType,
  deleteManualBooking,
  listManualBookings,
  listOwnerPhotos,
  listRooms,
  listRoomTypes,
  updateRoom,
  updateRoomStatus,
  updateRoomType,
  uploadLodgePhoto,
  type ManualBookingInput,
  type PhotoMetadataInput,
  type PickedPhoto,
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
  manualBookings: ManualBookingBlock[];
  photos: LodgePhoto[];
  rooms: Room[];
  roomTypes: RoomType[];
}

export function useRoomOperations() {
  const assignedLodges = useAssignedLodges();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const auth = useAuth();
  const cacheScope = `${auth.user?.id ?? 'signed-out'}.${lodgeId ?? 'none'}`;
  const activeScope = useRef(cacheScope);
  activeScope.current = cacheScope;
  const loadRevision = useRef(0);
  const [state, setState] = useState<RoomOperationsState>({
    errorMessage: null,
    housekeepingNotes: {},
    isLoading: true,
    isRefreshing: false,
    manualBookings: [],
    photos: [],
    rooms: [],
    roomTypes: [],
  });
  const mutationInFlight = useRef(false);
  const hasFocused = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      const revision = ++loadRevision.current;
      const isCurrent = () =>
        revision === loadRevision.current && activeScope.current === cacheScope;
      if (!lodgeId) {
        if (!isCurrent()) return;
        setState((current) => ({
          ...current,
          errorMessage: 'No lodge selected.',
          isLoading: false,
          isRefreshing: false,
          manualBookings: [],
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

      if (!isCurrent()) return;
      if (isOffline) {
        const cached = await loadRoomBoardCache(cacheScope).catch(() => null);
        if (!isCurrent()) return;
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
        const [roomTypes, rooms, photos, manualBookings] = await Promise.all([
          listRoomTypes(lodgeId),
          listRooms(lodgeId),
          listOwnerPhotos(lodgeId),
          listManualBookings(lodgeId),
        ]);
        if (!isCurrent()) return;
        setState({
          errorMessage: null,
          housekeepingNotes: notes,
          isLoading: false,
          isRefreshing: false,
          manualBookings,
          photos,
          rooms,
          roomTypes,
        });
        await saveRoomBoardCache(cacheScope, { photos, rooms, roomTypes }).catch(() => undefined);
      } catch {
        const cached = await loadRoomBoardCache(cacheScope).catch(() => null);
        if (!isCurrent()) return;
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
    [cacheScope, isOffline, lodgeId],
  );

  useEffect(() => {
    setState({
      errorMessage: null,
      housekeepingNotes: {},
      isLoading: true,
      isRefreshing: false,
      manualBookings: [],
      photos: [],
      rooms: [],
      roomTypes: [],
    });
  }, [cacheScope]);

  useEffect(() => {
    void load();
    return () => {
      loadRevision.current += 1;
    };
  }, [load]);

  useEffect(() => {
    // 'lodge:catalog-updated' is what an admin (or another owner/staff member) price, capacity
    // or room-type edit produces; without it this board kept showing the old price until the
    // owner pulled to refresh.
    if (realtime.lastEvent?.payload.lodgeId && realtime.lastEvent.payload.lodgeId !== lodgeId)
      return;
    if (
      realtime.lastEvent?.name === 'room:availability-updated' ||
      realtime.lastEvent?.name === 'room:status-updated' ||
      realtime.lastEvent?.name === 'lodge:catalog-updated'
    ) {
      void load(true);
    }
  }, [load, lodgeId, realtime.lastEvent]);

  useEffect(() => {
    if (realtime.connectionRevision === 0) {
      return;
    }

    void load(true);
  }, [load, realtime.connectionRevision]);

  useEffect(() => {
    if (isOffline) {
      return undefined;
    }

    const interval = setInterval(() => void load(true), 30_000);
    return () => clearInterval(interval);
  }, [isOffline, load, realtime.connected]);

  const focusLoad = useRef(load);
  useEffect(() => {
    focusLoad.current = load;
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) void focusLoad.current(true);
      hasFocused.current = true;
    }, []),
  );

  const roomTypeById = useMemo(
    () => new Map(state.roomTypes.map((roomType) => [roomType.id, roomType])),
    [state.roomTypes],
  );

  const runMutation = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      if (mutationInFlight.current) return false;
      if (isOffline) {
        setState((current) => ({
          ...current,
          errorMessage: 'Connect to the internet to complete this action.',
        }));
        return false;
      }

      mutationInFlight.current = true;
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
        mutationInFlight.current = false;
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
    uploadPhoto: (photo: PickedPhoto) =>
      lodgeId ? uploadLodgePhoto(lodgeId, photo) : Promise.reject(new Error('No lodge selected.')),
    createManualBooking: (roomId: string, input: ManualBookingInput) =>
      runMutation(
        () => createManualBooking(roomId, input),
        'Offline booking saved and live availability updated.',
      ),
    createRoom: (roomTypeId: string, input: RoomInput) =>
      runMutation(() => createRoom(roomTypeId, input), 'Room created.'),
    createRoomType: (input: RoomTypeInput) =>
      lodgeId
        ? runMutation(() => createRoomType(lodgeId, input), 'Room type saved.')
        : Promise.resolve(false),
    isOffline,
    isSubmitting,
    deleteManualBooking: (bookingId: string) =>
      runMutation(
        () => deleteManualBooking(bookingId),
        'Offline booking removed and room availability released.',
      ),
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
    updateRoom: (roomId: string, input: Partial<RoomInput>) =>
      runMutation(() => updateRoom(roomId, input), 'Room details updated.'),
    updateRoomStatus: (roomId: string, status: RoomStatus) =>
      runMutation(() => updateRoomStatus(roomId, status), 'Room status updated.'),
    updateRoomType: (roomTypeId: string, input: Partial<RoomTypeInput> & { isActive?: boolean }) =>
      runMutation(() => updateRoomType(roomTypeId, input), 'Room type updated.'),
  };
}
