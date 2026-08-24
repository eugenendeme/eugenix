export function initProcess() {
  const process = document.querySelector("[data-process]");
  const stages = [...document.querySelectorAll("[data-process-stage]")];
  if (!process || !stages.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !("IntersectionObserver" in window)) {
    for (const stage of stages) stage.classList.add("is-active");
    return;
  }

  process.classList.add("is-enhanced");

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-active");
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -22%", threshold: 0.32 });

  for (const stage of stages) observer.observe(stage);
}
