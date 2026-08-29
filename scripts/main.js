import { initNavigation } from "./navigation.js?v=20260828r1";
import { initRevealMotion } from "./motion.js";
import { initHeroInteraction } from "./hero.js";
import { initProcess } from "./process.js";
import { initContactForm } from "./contact.js?v=20260828f4";
import { initTestimonials } from "./testimonials.js?v=20260828f1";

document.documentElement.classList.add("js");

const currentYear = document.querySelector("[data-year]");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

initNavigation();
initRevealMotion();
initHeroInteraction();
initProcess();
initContactForm();
initTestimonials();
