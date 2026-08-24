import { getCurrentSession } from "./auth.js";
import { ensureResourceSaved, initSavedStore, isResourceSaved, isSavedStoreLoading, isSavedStoreUnavailable, onSavedStateChange, toggleSavedResource } from "./saved-store.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function saveReturnPath(resourceId, hash = "") {
  const target = new URL(`${location.pathname}${location.search}`, location.origin);
  target.searchParams.set("save", resourceId);
  target.hash = hash;
  return `${target.pathname}${target.search}${target.hash}`;
}

function syncButton(button) {
  const resourceId = button.dataset.saveResource || "";
  const title = button.dataset.resourceTitle || "resource";
  const saved = isResourceSaved(resourceId);
  const loading = Boolean(getCurrentSession()) && isSavedStoreLoading();
  const unavailable = Boolean(getCurrentSession()) && isSavedStoreUnavailable();
  button.disabled = !resourceId || loading || unavailable;
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute("aria-label", unavailable ? `Saved state unavailable for ${title}` : saved ? `Remove ${title} from Saved` : `Save ${title}`);
  const label = button.querySelector("[data-save-label]");
  if (label) label.textContent = loading ? "Checking…" : unavailable ? "Unavailable" : saved ? "Saved" : "Save";
  const mark = button.querySelector("[data-save-mark]");
  if (mark) mark.textContent = saved ? "✓" : "+";
}

export function configureSaveButton(button, { resourceId, title, returnPath }) {
  button.dataset.saveResource = resourceId;
  button.dataset.resourceTitle = title;
  button.dataset.returnPath = returnPath;
  syncButton(button);
}

export function syncSaveButtons(root = document) {
  root.querySelectorAll("[data-save-resource]").forEach(syncButton);
}

export function initSavedControls() {
  initSavedStore();
  onSavedStateChange(() => syncSaveButtons());
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-save-resource]");
    if (!button) return;
    const status = button.parentElement?.querySelector("[data-save-status]");
    button.disabled = true;
    if (status) status.textContent = getCurrentSession() ? "Updating your library…" : "Opening Google sign-in…";
    try {
      const result = await toggleSavedResource(button.dataset.saveResource, button.dataset.returnPath || `${location.pathname}${location.search}${location.hash}`);
      if (!result.authenticationStarted && status) status.textContent = result.saved ? "Saved to your library." : "Removed from your library.";
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (status) status.textContent = message === "AUTH_NOT_CONFIGURED" ? "Google sign-in is not configured in this environment." : message === "RESOURCE_UNAVAILABLE" ? "This resource is no longer available to save." : "Saved state could not be updated. Please try again.";
    } finally {
      syncButton(button);
    }
  });
}

export async function completePendingSave() {
  const target = new URL(location.href);
  const resourceId = target.searchParams.get("save") || "";
  if (!UUID_RE.test(resourceId) || !getCurrentSession()) return false;
  await ensureResourceSaved(resourceId);
  target.searchParams.delete("save");
  history.replaceState(null, "", `${target.pathname}${target.search}${target.hash}`);
  const button = document.querySelector(`[data-save-resource="${CSS.escape(resourceId)}"]`);
  const status = button?.parentElement?.querySelector("[data-save-status]");
  if (status) status.textContent = "Signed in and saved to your library.";
  return true;
}
