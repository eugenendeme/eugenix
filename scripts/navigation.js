const mobileMenuQuery = window.matchMedia("(max-width: 63.999rem)");

export function initNavigation() {
  const header = document.querySelector("[data-site-header]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const navigation = document.querySelector("[data-primary-nav]");
  if (!header || !toggle || !navigation) return;

  const navigationParent = navigation.parentNode;
  const navigationNextSibling = navigation.nextSibling;
  const menuLinks = [...navigation.querySelectorAll("a[href]")];
  const backgroundElements = [...document.body.children].filter((element) => element !== header);
  const placeNavigation = () => {
    if (mobileMenuQuery.matches) header.after(navigation);
    else navigationParent.insertBefore(navigation, navigationNextSibling);
  };
  const menuFocusables = () => [toggle, ...navigation.querySelectorAll("a[href], button:not([disabled])")]
    .filter((element) => !element.hidden && !element.closest("[hidden]") && getComputedStyle(element).visibility !== "hidden");
  const setMenuState = (isOpen, shouldReturnFocus = false) => {
    navigation.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    document.documentElement.classList.toggle("menu-open", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    backgroundElements.forEach((element) => { element.inert = isOpen; });
    if (isOpen) {
      navigation.getBoundingClientRect();
      menuLinks[0]?.focus();
    }
    else if (shouldReturnFocus) toggle.focus();
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setMenuState(!isOpen, isOpen);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a") && mobileMenuQuery.matches) setMenuState(false, true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenuState(false, true);
      return;
    }
    if (event.key !== "Tab" || toggle.getAttribute("aria-expanded") !== "true") return;

    const focusable = menuFocusables();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  mobileMenuQuery.addEventListener("change", (event) => {
    if (!event.matches) setMenuState(false);
    placeNavigation();
  });

  placeNavigation();

  const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  for (const link of document.querySelectorAll("[data-nav-link]")) {
    const linkUrl = new URL(link.href, window.location.origin);
    if (linkUrl.pathname === window.location.pathname && !linkUrl.hash) link.setAttribute("aria-current", "page");
  }
}
