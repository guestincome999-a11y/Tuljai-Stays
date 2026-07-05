import type { LodgePhoto, Room, RoomType } from '@tuljai/types';
import * as SecureStore from 'expo-secure-store';

const ROOM_BOARD_CACHE_KEY = 'tuljai.owner.roomBoard';

export interface RoomBoardCache {
  photos: LodgePhoto[];
  rooms: Room[];
  roomTypes: RoomType[];
}

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function saveRoomBoardCache(cache: RoomBoardCache): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  await SecureStore.setItemAsync(ROOM_BOARD_CACHE_KEY, JSON.stringify(cache));
}

export async function loadRoomBoardCache(): Promise<RoomBoardCache | null> {
  if (!(await isSecureStoreAvailable())) {
    return null;
  }

  const stored = await SecureStore.getItemAsync(ROOM_BOARD_CACHE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as RoomBoardCache;
  } catch {
    await SecureStore.deleteItemAsync(ROOM_BOARD_CACHE_KEY);
    return null;
  }
}
