export function initHeroInteraction() {
  const hero = document.querySelector("[data-hero]");
  const pointerLight = document.querySelector("[data-pointer-light]");
  const depthElements = [...document.querySelectorAll("[data-depth]")];
  const supportsPointer = window.matchMedia("(min-width: 64rem) and (hover: hover) and (pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!hero || !supportsPointer || reducedMotion) return;

  let frameId = 0;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  const render = () => {
    const normalizedX = pointerX / window.innerWidth - 0.5;
    const normalizedY = pointerY / window.innerHeight - 0.5;
    if (pointerLight) {
      pointerLight.style.setProperty("--pointer-x", `${pointerX}px`);
      pointerLight.style.setProperty("--pointer-y", `${pointerY}px`);
    }
    for (const element of depthElements) {
      const depth = Number(element.dataset.depth) || 0;
      element.style.transform = `translate3d(${normalizedX * depth * 18}px, ${normalizedY * depth * 12}px, 0)`;
    }
    frameId = 0;
  };

  hero.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frameId) frameId = requestAnimationFrame(render);
  }, { passive: true });
}
