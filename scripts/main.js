import { initNavigation } from "./navigation.js";
import { initRevealMotion } from "./motion.js";
import { initHeroInteraction } from "./hero.js";
import { initProcess } from "./process.js";
import { initContactForm } from "./contact.js";

document.documentElement.classList.add("js");

const currentYear = document.querySelector("[data-year]");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

initNavigation();
initRevealMotion();
initHeroInteraction();
initProcess();
initContactForm();
