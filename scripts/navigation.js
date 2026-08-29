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
  const backgroundInertState = new Map(backgroundElements.map((element) => [element, element.hasAttribute("inert")]));
  let lockedScrollY = 0;
  let scrollLockState = null;
  const placeNavigation = () => {
    if (mobileMenuQuery.matches) header.after(navigation);
    else navigationParent.insertBefore(navigation, navigationNextSibling);
  };
  const menuFocusables = () => [toggle, ...navigation.querySelectorAll("a[href], button:not([disabled])")]
    .filter((element) => !element.hidden && !element.closest("[hidden]") && getComputedStyle(element).visibility !== "hidden");
  const lockPageScroll = () => {
    if (scrollLockState) return;

    lockedScrollY = window.scrollY;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    scrollLockState = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      bodyPaddingRight: document.body.style.paddingRight,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = "100%";
    if (scrollbarWidth) document.body.style.paddingRight = `${scrollbarWidth}px`;
  };
  const unlockPageScroll = () => {
    if (!scrollLockState) return;

    document.documentElement.style.overflow = scrollLockState.htmlOverflow;
    document.body.style.overflow = scrollLockState.bodyOverflow;
    document.body.style.position = scrollLockState.bodyPosition;
    document.body.style.top = scrollLockState.bodyTop;
    document.body.style.width = scrollLockState.bodyWidth;
    document.body.style.paddingRight = scrollLockState.bodyPaddingRight;
    scrollLockState = null;
    window.scrollTo(0, lockedScrollY);
  };
  const setMenuState = (isOpen, shouldReturnFocus = false) => {
    navigation.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    document.documentElement.classList.toggle("menu-open", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    backgroundElements.forEach((element) => {
      if (isOpen) element.setAttribute("inert", "");
      else if (!backgroundInertState.get(element)) element.removeAttribute("inert");
    });
    if (isOpen) {
      lockPageScroll();
      navigation.getBoundingClientRect();
      menuLinks[0]?.focus();
    }
    else {
      unlockPageScroll();
      if (shouldReturnFocus) toggle.focus();
    }
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
    if (!focusable.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
      return;
    }
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
