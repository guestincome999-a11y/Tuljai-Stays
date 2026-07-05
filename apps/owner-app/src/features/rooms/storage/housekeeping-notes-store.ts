import * as SecureStore from 'expo-secure-store';

const HOUSEKEEPING_NOTES_KEY = 'tuljai.owner.housekeepingNotes';

type HousekeepingNotes = Record<string, string>;

async function isSecureStoreAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function loadHousekeepingNotes(): Promise<HousekeepingNotes> {
  if (!(await isSecureStoreAvailable())) {
    return {};
  }

  const stored = await SecureStore.getItemAsync(HOUSEKEEPING_NOTES_KEY);

  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored) as HousekeepingNotes;
  } catch {
    await SecureStore.deleteItemAsync(HOUSEKEEPING_NOTES_KEY);
    return {};
  }
}

export async function saveHousekeepingNote(roomId: string, note: string): Promise<void> {
  if (!(await isSecureStoreAvailable())) {
    return;
  }

  const notes = await loadHousekeepingNotes();
  const nextNotes = { ...notes, [roomId]: note };
  await SecureStore.setItemAsync(HOUSEKEEPING_NOTES_KEY, JSON.stringify(nextNotes));
}
