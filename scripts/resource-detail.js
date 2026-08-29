import { getCurrentSession, onAuthStateChange, signInWithGoogle } from "./auth.js?v=20260825r1";
import { fetchPublishedResourceBySlug } from "./resource-data.js";
import { initResourceShell } from "./resource-shell.js?v=20260828f4";
import { isSupabaseConfigured } from "./supabase-client.js";
import { downloadFailure, requestResourceDownload, safeSignedUrl } from "./download-client.js?v=20260825r1";
import { completePendingSave, configureSaveButton, initSavedControls, saveReturnPath } from "./saved-controls.js?v=20260828f4";
import { addButtonIcon, showFeedback } from "./feedback.js?v=20260828f4";

let resource = null;

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  return element;
}

function getSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const slug = parts[0] === "resources" && parts.length === 2 ? decodeURIComponent(parts[1]) : "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

function readableDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function categoryOf(item) {
  const category = Array.isArray(item.category) ? item.category[0] : item.category;
  return category && typeof category === "object" ? category : null;
}

function addMetadata(list, label, value) {
  if (!value) return;
  const group = createElement("div");
  group.append(createElement("dt", "", label), createElement("dd", "", String(value)));
  list.append(group);
}

function renderResource(item) {
  const article = document.querySelector("[data-resource-detail]");
  if (!article) return;
  const category = categoryOf(item);
  const header = createElement("header", "resource-document__header");
  const kicker = createElement("p", "resource-document__kicker", [category?.name, item.file_type && String(item.file_type).toUpperCase()].filter(Boolean).join(" / "));
  header.append(kicker, createElement("h1", "", String(item.title)));
  if (item.teaser) header.append(createElement("p", "resource-document__teaser", String(item.teaser)));
  const saveWrap = createElement("div", "save-control-wrap resource-document__save");
  const saveButton = createElement("button", "save-control");
  saveButton.type = "button";
  const saveLabel = createElement("span", "", "Save");
  const saveMark = createElement("span", "", "+");
  saveLabel.dataset.saveLabel = "";
  saveMark.dataset.saveMark = "";
  saveButton.append(saveLabel, saveMark);
  const saveStatus = createElement("p", "save-control__status");
  saveStatus.dataset.saveStatus = "";
  saveStatus.setAttribute("role", "status");
  saveStatus.setAttribute("aria-live", "polite");
  saveWrap.append(saveButton, saveStatus);
  configureSaveButton(saveButton, { resourceId: item.id, title: String(item.title), returnPath: saveReturnPath(item.id) });
  header.append(saveWrap);
  const description = createElement("div", "resource-document__description");
  description.append(createElement("p", "", item.description ? String(item.description) : String(item.teaser)));
  const metadata = createElement("dl", "resource-document__metadata");
  addMetadata(metadata, "Category", category?.name);
  addMetadata(metadata, "File type", item.file_type && String(item.file_type).toUpperCase());
  addMetadata(metadata, "Author", item.author);
  addMetadata(metadata, "Published", readableDate(item.published_at || item.created_at));
  const tags = createElement("ul", "archive-tags resource-document__tags");
  if (Array.isArray(item.tags)) item.tags.forEach((tag) => tags.append(createElement("li", "", String(tag))));
  article.replaceChildren(header, description, metadata);
  if (tags.childElementCount) article.append(tags);
  article.hidden = false;
  document.querySelector("[data-detail-loading]")?.setAttribute("hidden", "");
  const download = document.querySelector("[data-resource-download]");
  if (download) download.disabled = false;
  document.title = `${String(item.title)} | EugenIX Resources`;
  const descriptionText = String(item.teaser || item.description || "View a practical EugenIX resource.").trim();
  const publicUrl = new URL(`/resources/${encodeURIComponent(item.slug)}/`, window.location.origin).href;
  document.querySelector('meta[name="description"]')?.setAttribute("content", descriptionText);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", descriptionText);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", publicUrl);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", document.title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", descriptionText);
  document.querySelector('meta[name="robots"]')?.setAttribute("content", "index,follow");
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", publicUrl);
  const breadcrumb = document.querySelector("[data-resource-breadcrumb]");
  if (breadcrumb) breadcrumb.textContent = String(item.title);
  document.querySelector("[data-resource-share]")?.removeAttribute("hidden");
}

async function shareResource() {
  if (!resource) return;
  const status = document.querySelector("[data-share-status]");
  const url = new URL(`/resources/${encodeURIComponent(resource.slug)}/`, window.location.origin).href;
  try {
    if (navigator.share) {
      await navigator.share({ title: String(resource.title), text: String(resource.teaser || ""), url });
      showFeedback(status, { state: "success", title: "Resource shared", message: "The resource was shared successfully." });
    }
    else {
      if (!navigator.clipboard?.writeText) throw new Error("COPY_UNAVAILABLE");
      await navigator.clipboard.writeText(url);
      showFeedback(status, { state: "success", title: "Resource link copied", message: "The link is ready to paste." });
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    showFeedback(status, { state: "error", title: "Resource could not be shared", message: "Copy the link from your browser address bar." });
  }
}

function setDetailState(name, message) {
  document.querySelector("[data-detail-loading]")?.setAttribute("hidden", "");
  const error = document.querySelector("[data-detail-error]");
  const missing = document.querySelector("[data-detail-missing]");
  if (error) error.hidden = name !== "error";
  if (missing) missing.hidden = name !== "missing";
  const output = document.querySelector(`[data-detail-${name}] [data-state-message]`);
  if (output && message) output.textContent = message;
}

function updateDownloadGate(session) {
  document.querySelectorAll("[data-download-signed-out]").forEach((element) => { element.hidden = Boolean(session); });
  document.querySelectorAll("[data-download-signed-in]").forEach((element) => { element.hidden = !session; });
  const status = document.querySelector("[data-download-status]");
  if (session && new URLSearchParams(window.location.search).get("download") === "1" && status) {
    showFeedback(status, { state: "success", title: "Signed in successfully", message: "Select Download Resource when you are ready to continue." });
  }
}

async function startReauthentication(status) {
  showFeedback(status, { state: "loading", title: "Opening Google sign-in", message: "You will return to this resource after signing in." });
  try {
    await signInWithGoogle(`${window.location.pathname}?download=1`);
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "AUTH_NOT_CONFIGURED";
    showFeedback(status, { state: "error", title: "Sign-in could not start", message: unavailable ? "Google sign-in is not configured in this environment." : "Please try again." });
  }
}

async function startDownload() {
  const status = document.querySelector("[data-download-status]");
  const button = document.querySelector("[data-resource-download]");
  const session = getCurrentSession();
  if (!resource) {
    showFeedback(status, { state: "error", title: "Resource unavailable", message: "This resource is not available for download." });
    return;
  }
  if (!session) {
    try {
      const target = `${window.location.pathname}?download=1`;
      showFeedback(status, { state: "loading", title: "Opening Google sign-in", message: "You will return to this resource after signing in." });
      await signInWithGoogle(target);
    } catch (error) {
      showFeedback(status, { state: "error", title: "Sign-in could not start", message: error instanceof Error && error.message === "AUTH_NOT_CONFIGURED" ? "Google sign-in is not configured in this environment." : "Please try again." });
    }
    return;
  }

  if (button) button.disabled = true;
  showFeedback(status, { state: "loading", title: "Preparing secure download", message: "Getting your download ready." });
  try {
    const result = await requestResourceDownload({ resourceId: resource.id, accessToken: session.access_token });
    if (!result.ok) {
      const failure = downloadFailure(result);
      if (failure.kind === "reauth") {
        showFeedback(status, { state: "warning", title: failure.title, message: failure.message, actionLabel: failure.actionLabel, onAction: () => startReauthentication(status), focusAction: true });
      } else {
        showFeedback(status, { state: "error", title: failure.title, message: failure.message });
      }
      return;
    }
    const configuredOrigin = new URL(window.EUGENIX_PUBLIC_CONFIG.supabaseUrl).origin;
    const signedUrl = safeSignedUrl(result.payload.signedUrl, configuredOrigin);
    if (!signedUrl) throw new Error("INVALID_SIGNED_URL");
    showFeedback(status, { state: "info", title: "Opening secure download", message: "Your download is ready." });
    window.location.assign(signedUrl.href);
  } catch {
    showFeedback(status, { state: "error", title: "Download service unavailable", message: "Please try again later." });
  } finally {
    if (button) button.disabled = false;
  }
}

document.querySelector("[data-resource-download]")?.addEventListener("click", startDownload);
document.querySelector("[data-share-resource]")?.addEventListener("click", shareResource);
document.querySelector("[data-download-sign-in]")?.addEventListener("click", startDownload);
addButtonIcon(document.querySelector("[data-download-sign-in]"), "google");
addButtonIcon(document.querySelector("[data-resource-download]"), "download");
addButtonIcon(document.querySelector(".download-terminal__signout"), "signout");

await initResourceShell();
initSavedControls();
onAuthStateChange(updateDownloadGate);

const slug = getSlug();
if (!slug) {
  setDetailState("missing", "Choose a published resource from the library index.");
} else if (!isSupabaseConfigured()) {
  setDetailState("error", "The live resource catalog is not configured in this environment.");
} else {
  try {
    resource = await fetchPublishedResourceBySlug(slug);
    if (resource) {
      renderResource(resource);
      try {
        await completePendingSave();
      } catch {
        const status = document.querySelector(".resource-document__save [data-save-status]");
        showFeedback(status, { state: "error", title: "Resource could not be saved", message: "Please try saving it again." });
      }
    }
    else setDetailState("missing", "It may have been removed or may not be ready to share yet.");
  } catch {
    console.warn("The resource detail could not be loaded.");
    setDetailState("error", "The resource could not be loaded. Check your connection and try again.");
  }
}
