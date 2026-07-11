import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Lightweight client-side auth store. A single supabase.auth listener feeds
// both the render state (useAuth) and an optional identity-change callback used
// by the root to invalidate router/query caches.

interface AuthState {
  user: User | null;
  ready: boolean;
}

let state: AuthState = { user: null, ready: false };
const listeners = new Set<() => void>();
let started = false;

type IdentityEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
let identityCb: ((event: IdentityEvent) => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => {
    state = { user: data.session?.user ?? null, ready: true };
    emit();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    state = { user: session?.user ?? null, ready: true };
    emit();
    if (
      identityCb &&
      (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED")
    ) {
      identityCb(event);
    }
  });
}

export function setIdentityCallback(cb: (event: IdentityEvent) => void) {
  identityCb = cb;
  ensureStarted();
}

function subscribe(l: () => void) {
  ensureStarted();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => ({ user: null, ready: false }),
  );
}

export async function signOut() {
  await supabase.auth.signOut();
}
