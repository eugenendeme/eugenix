import { getCurrentSession, onAuthStateChange, signInWithGoogle } from "./auth.js";
import { fetchPublishedResourceBySlug } from "./resource-data.js";
import { initResourceShell } from "./resource-shell.js";
import { isSupabaseConfigured } from "./supabase-client.js";
import { downloadErrorMessage, requestResourceDownload, safeSignedUrl } from "./download-client.js";
import { completePendingSave, configureSaveButton, initSavedControls, saveReturnPath } from "./saved-controls.js";

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
    status.textContent = "Sign-in complete. Resume your secure download below.";
  }
}

async function startDownload() {
  const status = document.querySelector("[data-download-status]");
  const button = document.querySelector("[data-resource-download]");
  const session = getCurrentSession();
  if (!resource) {
    if (status) status.textContent = "This resource is not available for download.";
    return;
  }
  if (!session) {
    try {
      const target = `${window.location.pathname}?download=1`;
      await signInWithGoogle(target);
    } catch (error) {
      if (status) status.textContent = error instanceof Error && error.message === "AUTH_NOT_CONFIGURED" ? "Google sign-in is not configured in this environment." : "Google sign-in could not be started.";
    }
    return;
  }

  if (button) button.disabled = true;
  if (status) status.textContent = "Preparing a short-lived secure download…";
  try {
    const result = await requestResourceDownload({ resourceId: resource.id, accessToken: session.access_token });
    if (!result.ok) {
      if (status) status.textContent = downloadErrorMessage(result.status);
      return;
    }
    const configuredOrigin = new URL(window.EUGENIX_PUBLIC_CONFIG.supabaseUrl).origin;
    const signedUrl = safeSignedUrl(result.payload.signedUrl, configuredOrigin);
    if (!signedUrl) throw new Error("INVALID_SIGNED_URL");
    if (status) status.textContent = "Download ready. Opening the secure file…";
    window.location.assign(signedUrl.href);
  } catch {
    if (status) status.textContent = "The secure download route is unavailable. Please try again later.";
  } finally {
    if (button) button.disabled = false;
  }
}

document.querySelector("[data-resource-download]")?.addEventListener("click", startDownload);
document.querySelector("[data-download-sign-in]")?.addEventListener("click", startDownload);

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
        if (status) status.textContent = "The resource could not be saved after sign-in.";
      }
    }
    else setDetailState("missing", "This resource could not be found or is not published.");
  } catch {
    console.warn("The resource detail could not be loaded.");
    setDetailState("error", "The resource could not be loaded. Check your connection and try again.");
  }
}
