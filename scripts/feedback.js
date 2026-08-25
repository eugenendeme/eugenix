const SVG_NS = "http://www.w3.org/2000/svg";

const ICON_PATHS = {
  "bookmark-minus": ["M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z", "M9 10h6"],
  check: ["M20 6 9 17l-5-5"],
  download: ["M12 3v12", "m7-5-7 7-7-7", "M5 21h14"],
  error: ["M12 9v4", "M12 17h.01", "M10.3 3.6 2.4 17.3A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.7L13.7 3.6a2 2 0 0 0-3.4 0Z"],
  info: ["M12 16v-4", "M12 8h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"],
  refresh: ["M20 7h-5V2", "M4 17h5v5", "M5.1 9A8 8 0 0 1 18.4 5.4L20 7", "M18.9 15A8 8 0 0 1 5.6 18.6L4 17"],
  save: ["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z", "M17 21v-8H7v8", "M7 3v5h8"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  signout: ["M10 17l5-5-5-5", "M15 12H3", "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"],
};

export function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("ui-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const data of ICON_PATHS[name] || ICON_PATHS.info) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", data);
    svg.append(path);
  }
  return svg;
}

export function createGoogleIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("ui-icon", "ui-icon--google");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const paths = [
    ["#4285F4", "M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z"],
    ["#34A853", "M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"],
    ["#FBBC05", "M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"],
    ["#EA4335", "M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"],
  ];
  for (const [fill, data] of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("fill", fill);
    path.setAttribute("d", data);
    svg.append(path);
  }
  return svg;
}

export function addButtonIcon(button, name) {
  if (!button || button.querySelector(".ui-icon")) return;
  button.prepend(name === "google" ? createGoogleIcon() : createIcon(name));
  button.classList.add("button--with-icon");
}

export function setButtonIcon(button, name) {
  if (!button) return;
  const current = button.querySelector(".ui-icon");
  const replacement = name === "google" ? createGoogleIcon() : createIcon(name);
  if (current) current.replaceWith(replacement);
  else button.prepend(replacement);
  button.classList.add("button--with-icon");
}

export function showFeedback(target, { state = "info", title, message = "", actionLabel = "", onAction, focusAction = false } = {}) {
  if (!target || !title) return null;
  target.classList.add("feedback-panel");
  target.classList.toggle("feedback-panel--action", Boolean(actionLabel && typeof onAction === "function"));
  target.dataset.feedbackState = state;
  target.setAttribute("role", state === "error" || state === "warning" ? "alert" : "status");
  target.setAttribute("aria-live", state === "error" || state === "warning" ? "assertive" : "polite");
  const iconName = state === "success" ? "check" : state === "error" || state === "warning" ? "error" : state === "loading" ? "refresh" : "info";
  const copy = document.createElement("span");
  copy.className = "feedback-panel__copy";
  const heading = document.createElement("strong");
  heading.textContent = title;
  copy.append(heading);
  if (message) {
    const detail = document.createElement("span");
    detail.textContent = message;
    copy.append(detail);
  }
  target.replaceChildren(createIcon(iconName), copy);
  let action = null;
  if (actionLabel && typeof onAction === "function") {
    action = document.createElement("button");
    action.type = "button";
    action.className = "feedback-panel__action";
    action.textContent = actionLabel;
    action.addEventListener("click", onAction, { once: true });
    target.append(action);
    if (focusAction) action.focus();
  }
  return action;
}
