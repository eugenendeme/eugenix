import { addButtonIcon, showFeedback } from "./feedback.js?v=20260828f4";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function valueOf(form, name) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
    ? field.value.trim()
    : "";
}

function validate(form) {
  const values = {
    name: valueOf(form, "name"),
    email: valueOf(form, "email"),
    inquiry: valueOf(form, "inquiry"),
    subject: valueOf(form, "subject"),
    message: valueOf(form, "message"),
    website: valueOf(form, "website"),
  };
  const errors = {};

  if (!values.name) errors.name = "Enter your name.";
  else if (values.name.length > 100) errors.name = "Keep your name within 100 characters.";

  if (!values.email) errors.email = "Enter your email address.";
  else if (values.email.length > 254 || !EMAIL_PATTERN.test(values.email)) errors.email = "Enter a valid email address.";

  if (!values.subject) errors.subject = "Enter a subject or reason for contacting me.";
  else if (values.subject.length > 160) errors.subject = "Keep the subject within 160 characters.";

  if (!values.message) errors.message = "Enter a message.";
  else if (values.message.length > 4000) errors.message = "Keep the message within 4,000 characters.";

  return { values, errors };
}

function renderErrors(form, errors) {
  form.querySelectorAll("[data-error-for]").forEach((output) => {
    const fieldName = output.getAttribute("data-error-for");
    const field = fieldName ? form.elements.namedItem(fieldName) : null;
    const message = fieldName ? errors[fieldName] || "" : "";
    output.textContent = message;
    if (field instanceof HTMLElement) {
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
  });
}

function setState(form, state, message = "", options = {}) {
  const submit = form.querySelector("[data-contact-submit]");
  const label = form.querySelector("[data-submit-label]");
  const status = form.querySelector("[data-form-status]");
  form.dataset.state = state;
  if (submit instanceof HTMLButtonElement) submit.disabled = state === "submitting";
  if (label) label.textContent = state === "submitting" ? "Sending…" : "Send Message";
  if (status && message) {
    const titles = { submitting: "Sending your message", success: "Message sent successfully", error: "Message could not be sent" };
    showFeedback(status, { state: state === "submitting" ? "loading" : state, title: titles[state] || "Contact update", message, ...options });
  }
}

export function initContactForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!(form instanceof HTMLFormElement)) return;
  addButtonIcon(form.querySelector("[data-contact-submit]"), "send");

  form.noValidate = true;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { values, errors } = validate(form);
    renderErrors(form, errors);

    const firstInvalidName = Object.keys(errors)[0];
    if (firstInvalidName) {
      setState(form, "error", "Check the highlighted fields and try again.", { transient: false });
      const firstInvalid = form.elements.namedItem(firstInvalidName);
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      return;
    }

    setState(form, "submitting", "Sending your message…");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(values),
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : {};
      const accepted = response.ok && response.status !== 204 && payload.accepted === true;

      if (!accepted) {
        const unavailable = response.status === 501 || response.status === 503;
        setState(
          form,
          "error",
          unavailable
            ? "Message delivery is not configured yet. Please email me directly at ndemeeugene237@gmail.com."
            : "Your message was not confirmed as delivered. Please try again or email me directly at ndemeeugene237@gmail.com."
        );
        return;
      }

      form.reset();
      renderErrors(form, {});
      setState(form, "success", "Thank you. Your message was sent, and I’ll respond as soon as I can.");
    } catch {
      setState(form, "error", "The contact form is unavailable. Please email me directly at ndemeeugene237@gmail.com.");
    }
  });
}
