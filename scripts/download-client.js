const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requestResourceDownload({ resourceId, accessToken, fetchImplementation = fetch }) {
  if (!UUID_PATTERN.test(resourceId) || typeof accessToken !== "string" || !accessToken) {
    return { ok: false, status: 400, payload: {} };
  }
  const response = await fetchImplementation("/api/resource-download", {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId }),
  });
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
  return { ok: response.ok, status: response.status, payload };
}

export function downloadErrorMessage(status) {
  const messages = {
    400: "The download request was invalid.",
    401: "Your session has expired. Sign in again to download.",
    403: "You do not have permission to download this resource.",
    404: "This resource is no longer available.",
    500: "The download service is temporarily unavailable.",
    502: "The download service could not be reached.",
  };
  return messages[status] || "The download could not be prepared. Please try again.";
}

export function downloadFailure(result) {
  if (result?.status === 401 && result?.payload?.code === "reauth_required") {
    return {
      kind: "reauth",
      title: "Sign in again to continue",
      message: "For your security, please sign in again before downloading this file.",
      actionLabel: "Sign in again",
    };
  }
  if (result?.status === 401) {
    return {
      kind: "authentication",
      title: "Your session has expired",
      message: "Sign in again to download this file.",
    };
  }
  if (result?.status === 404) {
    return {
      kind: "unavailable",
      title: "Resource unavailable",
      message: "This resource is no longer available.",
    };
  }
  return {
    kind: "error",
    title: "Download could not start",
    message: downloadErrorMessage(result?.status),
  };
}

export function safeSignedUrl(value, allowedOrigin = "") {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const safeProtocol = url.protocol === "https:" || (url.protocol === "http:" && local);
    if (!safeProtocol || (allowedOrigin && url.origin !== allowedOrigin)) return null;
    return url;
  } catch {
    return null;
  }
}
