const MAX_BODY_BYTES = 10000;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_INQUIRY_LENGTH = 80;
const DEFAULT_RECIPIENT = "ndemeeugene237@gmail.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

function getRawBody(event) {
  const body = event.body || "";
  if (!event.isBase64Encoded) {
    return body;
  }
  return Buffer.from(body, "base64").toString("utf8");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" }, { Allow: "POST" });
  }

  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    return json(415, { error: "Content type not supported" });
  }

  const rawBody = getRawBody(event);

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json(413, { error: "Request too large" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return json(400, { error: "Invalid contact payload" });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const inquiry = typeof payload.inquiry === "string" ? payload.inquiry.trim() : "";
  const website = typeof payload.website === "string" ? payload.website.trim() : "";

  if (website) {
    return {
      statusCode: 204,
      body: "",
    };
  }

  if (
    name.length === 0 ||
    name.length > MAX_NAME_LENGTH ||
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    !isValidEmail(email) ||
    subject.length === 0 ||
    subject.length > MAX_SUBJECT_LENGTH ||
    inquiry.length > MAX_INQUIRY_LENGTH ||
    message.length === 0 ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return json(400, { error: "Invalid contact payload" });
  }

  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.CONTACT_FROM_EMAIL || "";
  const to = process.env.CONTACT_TO_EMAIL || DEFAULT_RECIPIENT;
  if (!apiKey || !from) {
    return json(503, { error: "Message delivery unavailable" });
  }

  const plainText = [
    `Sender name: ${name}`,
    `Sender email: ${email}`,
    `Inquiry type: ${inquiry || "Not specified"}`,
    `Subject: ${subject}`,
    "",
    "Message:",
    message,
  ].join("\n");

  let providerResponse;
  try {
    providerResponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `EugenIX inquiry: ${subject}`,
        text: plainText,
      }),
    });
  } catch {
    return json(502, { error: "Message delivery unavailable" });
  }

  if (!providerResponse.ok) {
    return json(502, { error: "Message delivery unavailable" });
  }

  let providerResult;
  try {
    providerResult = await providerResponse.json();
  } catch {
    return json(502, { error: "Message delivery unavailable" });
  }

  if (!providerResult || typeof providerResult.id !== "string" || !providerResult.id) {
    return json(502, { error: "Message delivery unavailable" });
  }

  return json(202, { accepted: true });
};
