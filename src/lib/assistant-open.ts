import { useSyncExternalStore } from "react";

// Tiny shared store for the AI assistant panel open/closed state.
// Lets the assistant panel and the mascot share a single source of truth
// without duplicating the chat or its logic.

let openState = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setAssistantOpen(next: boolean) {
  if (openState === next) return;
  openState = next;
  emit();
}

export function openAssistant() {
  setAssistantOpen(true);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return openState;
}

/** Reactive hook returning the current assistant open state. */
export function useAssistantOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
