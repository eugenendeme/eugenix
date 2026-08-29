export function initTestimonials() {
  const root = document.querySelector("[data-testimonials]");
  if (!root) return;

  const items = [...root.querySelectorAll("[data-testimonial]")];
  const selectors = [...root.querySelectorAll("[data-testimonial-select]")];
  const previous = root.querySelector("[data-testimonial-previous]");
  const next = root.querySelector("[data-testimonial-next]");
  if (!items.length || !previous || !next) return;

  let current = 0;
  const show = (index) => {
    current = (index + items.length) % items.length;
    items.forEach((item, itemIndex) => {
      const active = itemIndex === current;
      item.hidden = !active;
      item.classList.toggle("is-active", active);
    });
    selectors.forEach((selector, selectorIndex) => {
      const active = selectorIndex === current;
      selector.classList.toggle("is-active", active);
      selector.setAttribute("aria-pressed", String(active));
    });
  };

  previous.addEventListener("click", () => show(current - 1));
  next.addEventListener("click", () => show(current + 1));
  selectors.forEach((selector) => selector.addEventListener("click", () => show(Number(selector.dataset.testimonialSelect))));
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    show(current + (event.key === "ArrowRight" ? 1 : -1));
  });
}
