export function initRevealMotion() {
  const elements = [...document.querySelectorAll("[data-reveal]")];
  if (!elements.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    for (const element of elements) element.classList.add("is-revealed");
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -8%", threshold: 0.12 });

  for (const element of elements) observer.observe(element);
}
