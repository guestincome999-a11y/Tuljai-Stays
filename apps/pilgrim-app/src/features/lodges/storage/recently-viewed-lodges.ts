import * as SecureStore from 'expo-secure-store';

const RECENTLY_VIEWED_LODGES_KEY = 'tuljai_recently_viewed_lodges';
const MAX_RECENT_LODGES = 8;

export async function saveRecentlyViewedLodge(lodgeId: string): Promise<void> {
  const current = await listRecentlyViewedLodgeIds();
  const next = [lodgeId, ...current.filter((id) => id !== lodgeId)].slice(0, MAX_RECENT_LODGES);

  await SecureStore.setItemAsync(RECENTLY_VIEWED_LODGES_KEY, JSON.stringify(next));
}

export async function listRecentlyViewedLodgeIds(): Promise<string[]> {
  const stored = await SecureStore.getItemAsync(RECENTLY_VIEWED_LODGES_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearRecentlyViewedLodges(): Promise<void> {
  await SecureStore.deleteItemAsync(RECENTLY_VIEWED_LODGES_KEY);
}
