import { getCurrentSession, onAuthStateChange } from "./auth.js?v=20260825r1";
import { initResourceShell } from "./resource-shell.js?v=20260825r1";
import { fetchSavedResources, unsaveResource } from "./saved-data.js";
import { filterSavedRecords, savedResourceOf } from "./saved-filter.js";
import { addButtonIcon, showFeedback } from "./feedback.js";

const state = { records: [], query: "", category: "all", requestVersion: 0 };

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  return element;
}

function readableDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function setVisible(selector, visible) {
  const element = document.querySelector(selector);
  if (element) element.hidden = !visible;
}

function savedRow(record, index) {
  const resource = savedResourceOf(record);
  const item = createElement("li", "saved-record");
  const rail = createElement("div", "saved-record__rail");
  rail.append(createElement("span", "", String(index + 1).padStart(2, "0")), createElement("span", "", `Saved ${readableDate(record.created_at)}`));
  const body = createElement("div", "saved-record__body");
  if (resource) {
    const category = Array.isArray(resource.category) ? resource.category[0] : resource.category;
    body.append(createElement("p", "saved-record__meta", [category?.name, resource.file_type?.toUpperCase()].filter(Boolean).join(" / ")), createElement("h3", "", String(resource.title)));
    if (resource.teaser) body.append(createElement("p", "saved-record__teaser", String(resource.teaser)));
    const open = createElement("a", "saved-record__open");
    open.href = `/resources/${encodeURIComponent(resource.slug)}/`;
    open.append(createElement("span", "", "Open resource"), createElement("span", "", "→"));
    body.append(open);
  } else {
    item.classList.add("saved-record--unavailable");
    body.append(createElement("p", "saved-record__meta", "RESOURCE / NO LONGER AVAILABLE"), createElement("h3", "", "Resource no longer available."), createElement("p", "saved-record__teaser", "It remains in this list so you can remove it from Saved."));
  }
  const remove = createElement("button", "saved-record__remove", "Remove from Saved");
  remove.type = "button";
  remove.setAttribute("aria-label", resource ? `Remove ${resource.title} from Saved` : "Remove unavailable resource from Saved");
  remove.dataset.unsaveResource = record.resource_id;
  addButtonIcon(remove, "bookmark-minus");
  body.append(remove);
  item.append(rail, body);
  return item;
}

function renderRecords() {
  const filtered = filterSavedRecords(state.records, state);
  const list = document.querySelector("[data-saved-list]");
  const noResults = document.querySelector("[data-saved-no-results]");
  if (list) { list.replaceChildren(...filtered.map(savedRow)); list.hidden = filtered.length === 0; }
  if (noResults) noResults.hidden = filtered.length !== 0;
  const count = document.querySelector("[data-saved-count]");
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? "saved resource" : "saved resources"}`;
}

async function loadSaved(session) {
  const version = ++state.requestVersion;
  setVisible("[data-saved-loading]", Boolean(session));
  setVisible("[data-saved-signed-out]", !session);
  setVisible("[data-saved-error]", false);
  setVisible("[data-saved-empty]", false);
  setVisible("[data-saved-library]", false);
  if (!session) return;
  try {
    const records = await fetchSavedResources();
    if (version !== state.requestVersion) return;
    state.records = records;
    setVisible("[data-saved-loading]", false);
    setVisible("[data-saved-empty]", records.length === 0);
    setVisible("[data-saved-library]", records.length > 0);
    if (records.length) renderRecords();
  } catch {
    if (version !== state.requestVersion) return;
    setVisible("[data-saved-loading]", false);
    setVisible("[data-saved-error]", true);
  }
}

document.querySelector("[data-saved-search]")?.addEventListener("input", (event) => { state.query = event.target.value; renderRecords(); });
document.querySelector("[data-saved-category]")?.addEventListener("change", (event) => { state.category = event.target.value; renderRecords(); });
document.querySelector("[data-saved-list]")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-unsave-resource]");
  if (!button || !getCurrentSession()) return;
  const status = document.querySelector("[data-saved-action-status]");
  button.disabled = true;
  showFeedback(status, { state: "loading", title: "Removing saved resource", message: "Updating your saved resources." });
  try {
    await unsaveResource(button.dataset.unsaveResource);
    state.records = state.records.filter((record) => record.resource_id !== button.dataset.unsaveResource);
    showFeedback(status, { state: "success", title: "Removed from your library", message: "The resource was removed from Saved." });
    if (!state.records.length) { setVisible("[data-saved-library]", false); setVisible("[data-saved-empty]", true); }
    else renderRecords();
  } catch {
    button.disabled = false;
    showFeedback(status, { state: "error", title: "Saved resource could not be removed", message: "Please try again." });
  }
});

await initResourceShell();
onAuthStateChange(loadSaved);
