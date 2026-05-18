import AsyncStorage from '@react-native-async-storage/async-storage';

export type ActivityType = 'crash' | 'error' | 'feedback' | 'hang';

export interface ActivityEntry {
  type: ActivityType;
  detail: string;
  timestampMs: number;
}

const STORAGE_KEY = 'bugsplat_example_activity';
// Matches bugsplat-android's ActivityLog.MAX_ENTRIES — keeps the recent
// activity card from overflowing the screen below the four event cards.
const MAX_ENTRIES = 3;

export async function recordActivity(type: ActivityType, detail: string): Promise<void> {
  const entries = await getActivity();
  entries.unshift({ type, detail, timestampMs: Date.now() });
  const trimmed = entries.slice(0, MAX_ENTRIES);
  // Awaited write — for crash entries, the caller must `await` this before
  // triggering the native crash so the entry survives process death.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export async function getActivity(): Promise<ActivityEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is ActivityEntry =>
      e && typeof e.type === 'string' && typeof e.detail === 'string' && typeof e.timestampMs === 'number'
    );
  } catch {
    return [];
  }
}

export function formatRelativeTime(nowMs: number, thenMs: number): string {
  const deltaMs = Math.max(0, nowMs - thenMs);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
