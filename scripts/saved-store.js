import { getCurrentSession, onAuthStateChange, signInWithGoogle } from "./auth.js?v=20260825r1";
import { fetchSavedResourceIds, saveResource, unsaveResource } from "./saved-data.js";

const listeners = new Set();
let savedIds = new Set();
let loading = false;
let unavailable = false;
let initialized = false;
let requestVersion = 0;

function notify() {
  listeners.forEach((listener) => listener({ savedIds: new Set(savedIds), loading, unavailable }));
}

async function loadForSession(session) {
  const version = ++requestVersion;
  savedIds = new Set();
  unavailable = false;
  if (!session) {
    loading = false;
    notify();
    return;
  }
  loading = true;
  notify();
  try {
    const nextIds = await fetchSavedResourceIds();
    if (version === requestVersion) savedIds = nextIds;
  } catch {
    if (version === requestVersion) {
      savedIds = new Set();
      unavailable = true;
    }
  } finally {
    if (version === requestVersion) {
      loading = false;
      notify();
    }
  }
}

export function initSavedStore() {
  if (initialized) return;
  initialized = true;
  onAuthStateChange(loadForSession);
}

export function isResourceSaved(resourceId) {
  return savedIds.has(resourceId);
}

export function isSavedStoreLoading() {
  return loading;
}

export function isSavedStoreUnavailable() {
  return unavailable;
}

export function onSavedStateChange(listener) {
  listeners.add(listener);
  listener({ savedIds: new Set(savedIds), loading, unavailable });
  return () => listeners.delete(listener);
}

export async function toggleSavedResource(resourceId, returnPath) {
  if (!getCurrentSession()) {
    await signInWithGoogle(returnPath);
    return { authenticationStarted: true, saved: false };
  }
  const currentlySaved = savedIds.has(resourceId);
  if (currentlySaved) {
    await unsaveResource(resourceId);
    savedIds.delete(resourceId);
  } else {
    await saveResource(resourceId);
    savedIds.add(resourceId);
  }
  notify();
  return { authenticationStarted: false, saved: !currentlySaved };
}

export async function ensureResourceSaved(resourceId) {
  if (!getCurrentSession()) return false;
  await saveResource(resourceId);
  savedIds.add(resourceId);
  notify();
  return true;
}
