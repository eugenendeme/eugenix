import { initNavigation } from "./navigation.js";
import { consumeAuthenticationSuccess, initAuth, signInWithGoogle, signOut } from "./auth.js?v=20260825r1";
import { addButtonIcon, showFeedback } from "./feedback.js?v=20260828f4";

function announce(root, title, state = "info", message = "") {
  root.querySelectorAll("[data-auth-status]").forEach((node) => {
    showFeedback(node, { state, title, message });
  });
  if (state) root.dataset.authState = state;
}

export async function initResourceShell() {
  document.documentElement.classList.add("js");
  initNavigation();
  document.querySelectorAll("[data-auth-sign-in]").forEach((button) => addButtonIcon(button, "google"));
  document.querySelectorAll("[data-auth-sign-out]").forEach((button) => addButtonIcon(button, "signout"));

  document.querySelectorAll("[data-auth-sign-in]").forEach((button) => {
    button.addEventListener("click", async () => {
      const root = button.closest("[data-auth-root]") || document.body;
      button.disabled = true;
      announce(root, "Opening Google sign-in", "loading", "You will return here after authentication.");
      try {
        await signInWithGoogle(button.dataset.returnPath || `${window.location.pathname}${window.location.search}`);
      } catch (error) {
        const unavailable = error instanceof Error && error.message === "AUTH_NOT_CONFIGURED";
        announce(root, "Sign-in could not start", "error", unavailable ? "Google sign-in is not configured in this environment." : "Please try again.");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-auth-sign-out]").forEach((button) => {
    button.addEventListener("click", async () => {
      const root = button.closest("[data-auth-root]") || document.body;
      button.disabled = true;
      announce(root, "Signing out", "loading", "Signing you out now.");
      try {
        await signOut();
        announce(root, "Signed out successfully", "success", "You are no longer signed in.");
      } catch {
        announce(root, "Sign out could not be completed", "error", "Please try again.");
      } finally {
        button.disabled = false;
      }
    });
  });

  const session = await initAuth();
  if (session && consumeAuthenticationSuccess()) {
    document.querySelectorAll("[data-auth-root]").forEach((root) => announce(root, "Signed in successfully", "success", "Your saved and download features are ready."));
  }
  return session;
}
