import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

const RETURN_PATH_KEY = "eugenix.auth.returnPath";
const AUTH_NOTICE_KEY = "eugenix.auth.noticePath";
const listeners = new Set();
let authSubscription;
let currentSession = null;
let initialized = false;

export function validateInternalPath(value, fallback = "/resources/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const target = new URL(value, window.location.origin);
    const allowedPath = target.pathname.startsWith("/resources/") || target.pathname === "/saved/" || target.pathname === "/admin/";
    if (target.origin !== window.location.origin || !allowedPath) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

function safeDisplayName(user) {
  const metadata = user?.user_metadata || {};
  const candidate = metadata.full_name || metadata.name || "Signed in";
  return typeof candidate === "string" && candidate.trim() ? candidate.trim().slice(0, 100) : "Signed in";
}

export function renderAuthState(session, loading = false) {
  document.querySelectorAll("[data-auth-root]").forEach((root) => {
    const signedOut = root.querySelector("[data-auth-signed-out]");
    const signedIn = root.querySelector("[data-auth-signed-in]");
    const loadingNode = root.querySelector("[data-auth-loading]");
    if (loadingNode) loadingNode.hidden = !loading;
    if (signedOut) signedOut.hidden = loading || Boolean(session);
    if (signedIn) signedIn.hidden = loading || !session;
    const name = root.querySelector("[data-auth-name]");
    if (name) name.textContent = session ? safeDisplayName(session.user) : "";
  });
  document.querySelectorAll("[data-authenticated-only]").forEach((element) => { element.hidden = loading || !session; });
}

function notify(session) {
  currentSession = session;
  renderAuthState(session);
  listeners.forEach((listener) => listener(session));
}

export async function initAuth() {
  if (initialized) return currentSession;
  initialized = true;
  renderAuthState(null, true);
  const client = getSupabaseClient();
  if (!client) {
    renderAuthState(null);
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.warn("Auth session could not be restored.");
    notify(null);
  } else {
    notify(data.session);
  }

  const change = client.auth.onAuthStateChange((_event, session) => notify(session));
  authSubscription = change.data.subscription;

  if (currentSession) {
    const savedPath = validateInternalPath(sessionStorage.getItem(RETURN_PATH_KEY) || "", "");
    if (savedPath) {
      sessionStorage.removeItem(RETURN_PATH_KEY);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (savedPath !== currentPath) window.location.replace(savedPath);
    }
  }
  return currentSession;
}

export function getCurrentSession() {
  return currentSession;
}

export function onAuthStateChange(listener) {
  listeners.add(listener);
  listener(currentSession);
  return () => listeners.delete(listener);
}

export async function signInWithGoogle(returnPath = `${window.location.pathname}${window.location.search}`) {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) throw new Error("AUTH_NOT_CONFIGURED");
  const safeReturnPath = validateInternalPath(returnPath);
  sessionStorage.setItem(RETURN_PATH_KEY, safeReturnPath);
  sessionStorage.setItem(AUTH_NOTICE_KEY, safeReturnPath);
  const redirectTo = new URL("/resources/", window.location.origin).href;
  const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) {
    sessionStorage.removeItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
    throw new Error("AUTH_START_FAILED");
  }
}

export function consumeAuthenticationSuccess() {
  const expectedPath = validateInternalPath(sessionStorage.getItem(AUTH_NOTICE_KEY) || "", "");
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!expectedPath || expectedPath !== currentPath) return false;
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return true;
}

export async function signOut() {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw new Error("AUTH_SIGN_OUT_FAILED");
  notify(null);
}

export function destroyAuth() {
  authSubscription?.unsubscribe();
  authSubscription = undefined;
  listeners.clear();
  initialized = false;
  currentSession = null;
}
