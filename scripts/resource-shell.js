import { initNavigation } from "./navigation.js";
import { initAuth, signInWithGoogle, signOut } from "./auth.js";

function announce(root, message, state = "") {
  root.querySelectorAll("[data-auth-status]").forEach((node) => { node.textContent = message; });
  if (state) root.dataset.authState = state;
}

export async function initResourceShell() {
  document.documentElement.classList.add("js");
  initNavigation();

  document.querySelectorAll("[data-auth-sign-in]").forEach((button) => {
    button.addEventListener("click", async () => {
      const root = button.closest("[data-auth-root]") || document.body;
      button.disabled = true;
      announce(root, "Opening Google sign-in…", "loading");
      try {
        await signInWithGoogle(button.dataset.returnPath || `${window.location.pathname}${window.location.search}`);
      } catch (error) {
        const unavailable = error instanceof Error && error.message === "AUTH_NOT_CONFIGURED";
        announce(root, unavailable ? "Google sign-in is not configured in this environment." : "Google sign-in could not be started. Please try again.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-auth-sign-out]").forEach((button) => {
    button.addEventListener("click", async () => {
      const root = button.closest("[data-auth-root]") || document.body;
      button.disabled = true;
      announce(root, "Signing out…", "loading");
      try {
        await signOut();
        announce(root, "Signed out.", "idle");
      } catch {
        announce(root, "Sign out could not be completed. Please try again.", "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  return initAuth();
}
