import { initResourceShell } from "./resource-shell.js?v=20260828f4";
import { fetchCategories, fetchPublishedResources } from "./resource-data.js";
import { isSupabaseConfigured } from "./supabase-client.js";
import { categoryOf, filterAndSortResources } from "./resource-filter.js";
import { completePendingSave, configureSaveButton, initSavedControls, saveReturnPath } from "./saved-controls.js?v=20260828f4";
import { showFeedback } from "./feedback.js?v=20260828f4";

const FALLBACK_CATEGORIES = [
  { slug: "documentation", name: "Documentation" },
  { slug: "engineering-notes", name: "Engineering Notes" },
  { slug: "web", name: "Web" },
  { slug: "mobile", name: "Mobile" },
  { slug: "system-design", name: "System Design" },
  { slug: "ai-prompts", name: "AI Prompts" },
];
const FALLBACK_TAXONOMY = FALLBACK_CATEGORIES.map((category) => category.name);
const state = { resources: [], categories: [], category: "all", query: "", sort: "newest" };

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  return element;
}

function readableDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function renderTaxonomy(container, names, structural = false) {
  container.replaceChildren();
  names.forEach((name, index) => {
    const item = createElement("li");
    item.append(createElement("span", "archive-taxonomy__number", String(index + 1).padStart(2, "0")), createElement("strong", "", name));
    if (structural) item.append(createElement("em", "", "Category structure"));
    container.append(item);
  });
}

function renderFilters(disabled = false) {
  const container = document.querySelector("[data-category-filters]");
  if (!container) return;
  container.replaceChildren();
  const all = [{ slug: "all", name: "All" }, ...state.categories];
  all.forEach((category) => {
    const button = createElement("button", "archive-filter", category.name);
    button.type = "button";
    button.disabled = disabled;
    button.dataset.category = category.slug;
    button.setAttribute("aria-pressed", String(state.category === category.slug));
    button.addEventListener("click", () => {
      state.category = category.slug;
      renderFilters();
      renderResources();
    });
    container.append(button);
  });
}

function filteredResources() {
  return filterAndSortResources(state.resources, state);
}

function resourceRow(resource, index) {
  const item = createElement("li", "archive-resource");
  item.id = `resource-${resource.slug}`;
  const rail = createElement("div", "archive-resource__rail");
  rail.append(createElement("span", "", String(index + 1).padStart(2, "0")));
  const category = categoryOf(resource);
  if (category?.name) rail.append(createElement("span", "", category.name));
  if (resource.file_type) rail.append(createElement("span", "", String(resource.file_type).toUpperCase()));

  const body = createElement("div", "archive-resource__body");
  body.append(createElement("h2", "", String(resource.title || "Untitled resource")));
  if (resource.teaser) body.append(createElement("p", "archive-resource__teaser", String(resource.teaser)));
  const metadata = createElement("dl", "archive-resource__metadata");
  const details = [
    ["Author", resource.author],
    ["Published", readableDate(resource.published_at || resource.created_at)],
  ];
  details.forEach(([label, value]) => {
    if (!value) return;
    const group = createElement("div");
    group.append(createElement("dt", "", label), createElement("dd", "", String(value)));
    metadata.append(group);
  });
  if (metadata.childElementCount) body.append(metadata);
  if (Array.isArray(resource.tags) && resource.tags.length) {
    const tags = createElement("ul", "archive-tags");
    resource.tags.forEach((tag) => tags.append(createElement("li", "", String(tag))));
    body.append(tags);
  }
  const link = createElement("a", "archive-resource__link");
  link.href = `/resources/${encodeURIComponent(resource.slug)}/`;
  link.append(createElement("span", "", "Open resource"), createElement("span", "", "→"));
  const actions = createElement("div", "archive-resource__actions");
  const saveWrap = createElement("div", "save-control-wrap");
  const saveButton = createElement("button", "save-control");
  saveButton.type = "button";
  saveButton.append(createElement("span", "", "Save"), createElement("span", "", "+"));
  saveButton.firstElementChild.dataset.saveLabel = "";
  saveButton.lastElementChild.dataset.saveMark = "";
  const saveStatus = createElement("p", "save-control__status");
  saveStatus.dataset.saveStatus = "";
  saveStatus.setAttribute("role", "status");
  saveStatus.setAttribute("aria-live", "polite");
  saveWrap.append(saveButton, saveStatus);
  configureSaveButton(saveButton, { resourceId: resource.id, title: String(resource.title), returnPath: saveReturnPath(resource.id, item.id) });
  actions.append(link, saveWrap);
  body.append(actions);
  item.append(rail, body);
  return item;
}

function renderResources() {
  const list = document.querySelector("[data-resource-list]");
  const empty = document.querySelector("[data-no-results]");
  const count = document.querySelector("[data-result-count]");
  if (!list || !empty) return;
  const resources = filteredResources();
  list.replaceChildren(...resources.map(resourceRow));
  list.hidden = resources.length === 0;
  empty.hidden = resources.length !== 0;
  if (!resources.length) {
    const hasQuery = Boolean(state.query.trim());
    const filteredCategory = state.category !== "all";
    const code = document.querySelector("[data-no-results-code]");
    const title = document.querySelector("[data-no-results-title]");
    const message = document.querySelector("[data-no-results-message]");
    if (code) code.textContent = hasQuery ? "SEARCH / 00 MATCHES" : "CATEGORY / 00 MATCHES";
    if (title) title.textContent = hasQuery ? "No resources match your search." : filteredCategory ? "No resources in this category yet." : "No resources match.";
    if (message) message.textContent = hasQuery ? "Try a different word or clear the search." : "Choose another category or show all resources.";
  }
  if (count) count.textContent = `${resources.length} ${resources.length === 1 ? "resource" : "resources"}`;
}

async function initCatalog() {
  const fallback = document.querySelector("[data-static-catalog]");
  const application = document.querySelector("[data-catalog-app]");
  const loading = document.querySelector("[data-catalog-loading]");
  const errorState = document.querySelector("[data-catalog-error]");
  const emptyState = document.querySelector("[data-catalog-empty]");
  const taxonomy = document.querySelector("[data-taxonomy]");
  if (loading) loading.hidden = false;
  if (errorState) errorState.hidden = true;
  if (emptyState) emptyState.hidden = true;
  document.querySelector("[data-catalog-results]")?.setAttribute("hidden", "");
  if (fallback) fallback.hidden = true;
  if (application) application.hidden = false;

  if (!isSupabaseConfigured()) {
    if (loading) loading.hidden = true;
    if (errorState) errorState.hidden = false;
    if (taxonomy) renderTaxonomy(taxonomy, FALLBACK_TAXONOMY, true);
    state.categories = FALLBACK_CATEGORIES;
    renderFilters(true);
    document.querySelectorAll("[data-resource-search], [data-resource-sort]").forEach((control) => { control.disabled = true; });
    return;
  }

  try {
    const [categories, resources] = await Promise.all([fetchCategories(), fetchPublishedResources()]);
    state.categories = categories.length ? categories : FALLBACK_CATEGORIES;
    state.resources = resources;
    if (loading) loading.hidden = true;
    document.querySelectorAll("[data-resource-search], [data-resource-sort]").forEach((control) => { control.disabled = false; });
    if (taxonomy) renderTaxonomy(taxonomy, state.categories.map((category) => category.name), categories.length === 0);
    renderFilters(categories.length === 0);
    if (!resources.length) {
      if (emptyState) emptyState.hidden = false;
      return;
    }
    document.querySelector("[data-catalog-results]")?.removeAttribute("hidden");
    renderResources();
  } catch {
    console.warn("The public resource catalog could not be loaded.");
    if (loading) loading.hidden = true;
    if (errorState) errorState.hidden = false;
    if (taxonomy) renderTaxonomy(taxonomy, FALLBACK_TAXONOMY, true);
    state.categories = FALLBACK_CATEGORIES;
    renderFilters(true);
    document.querySelectorAll("[data-resource-search], [data-resource-sort]").forEach((control) => { control.disabled = true; });
  }
}

document.querySelector("[data-catalog-retry]")?.addEventListener("click", () => { initCatalog(); });
document.querySelector("[data-clear-discovery]")?.addEventListener("click", () => {
  state.category = "all";
  state.query = "";
  const search = document.querySelector("[data-resource-search]");
  if (search) search.value = "";
  renderFilters();
  renderResources();
});

document.querySelector("[data-resource-search]")?.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderResources();
});
document.querySelector("[data-resource-sort]")?.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderResources();
});

await initResourceShell();
initSavedControls();
await initCatalog();
try {
  await completePendingSave();
} catch {
  const pendingStatus = document.querySelector("[data-save-status]");
  showFeedback(pendingStatus, { state: "error", title: "Resource could not be saved", message: "Please try saving it again." });
}
