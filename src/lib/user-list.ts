import { useSyncExternalStore } from "react";
import type {
  MediaItem,
  PriorityLevel,
  UserEntry,
  WatchStatus,
} from "./media-types";

// Local-first personal tracking store. Kept intentionally separate from the
// external metadata layer so it can later be swapped for Supabase-backed data
// without touching the UI. Persisted in localStorage; SSR-safe via
// useSyncExternalStore with an empty server snapshot.

const KEY = "nexus:list:v1";
type Store = Record<string, UserEntry>;

const EMPTY: Store = {};
let cache: Store | null = null;
const listeners = new Set<() => void>();

function read(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Store) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function base(item: MediaItem): UserEntry {
  return {
    key: item.key,
    source: item.source,
    externalId: item.externalId,
    mediaType: item.mediaType,
    title: item.title,
    posterUrl: item.posterUrl,
    status: null,
    favorite: false,
    priority: "normale",
    notes: "",
    tags: [],
    updatedAt: Date.now(),
  };
}

export function upsertEntry(item: MediaItem, patch: Partial<UserEntry>) {
  const all = { ...read() };
  const prev = all[item.key] ?? base(item);
  all[item.key] = {
    ...prev,
    title: item.title,
    posterUrl: item.posterUrl,
    ...patch,
    updatedAt: Date.now(),
  };
  write(all);
}

export function removeEntry(key: string) {
  const all = { ...read() };
  delete all[key];
  write(all);
}

export function setStatus(item: MediaItem, status: WatchStatus | null) {
  upsertEntry(item, { status });
}
export function toggleFavorite(item: MediaItem, current: boolean) {
  upsertEntry(item, { favorite: !current });
}
export function setPriority(item: MediaItem, priority: PriorityLevel) {
  upsertEntry(item, { priority });
}
export function setNotes(item: MediaItem, notes: string) {
  upsertEntry(item, { notes });
}
export function setTags(item: MediaItem, tags: string[]) {
  upsertEntry(item, { tags });
}

export function useUserList(): Store {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useUserEntry(key: string): UserEntry | null {
  const all = useUserList();
  return all[key] ?? null;
}
