/**
 * The name a page gives the breadcrumb for its own last crumb, instead of
 * the URL's word (the profile audit, 2026-10-19: a character page read
 * "Home / Character"). A page sets it while it is open and clears it on the
 * way out; Breadcrumbs reads it.
 *
 *   setPageTitle(path, label)   clearPageTitle(path)   usePageTitle(path)
 */
import { useSyncExternalStore } from 'react';

let current = null; // { path, label }
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function setPageTitle(path, label) {
  current = label ? { path, label } : null;
  emit();
}

export function clearPageTitle(path) {
  if (current && current.path === path) { current = null; emit(); }
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => current;

/** The label set for `path`, or null. */
export function usePageTitle(path) {
  const t = useSyncExternalStore(subscribe, snapshot, snapshot);
  return t && t.path === path ? t.label : null;
}
