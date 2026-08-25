const { createClient } = require("@supabase/supabase-js");

const MAX_BODY_BYTES = 4000;
const DOWNLOAD_TTL_SECONDS = 300;
const AUTH_FRESHNESS_WINDOW_MS = 48 * 60 * 60 * 1000;
const RESOURCE_BUCKET = "resources";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getBearerToken(headers) {
  const value = headers.authorization || headers.Authorization || "";

  if (!value.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return value.slice(7).trim();
}

function getRawBody(event) {
  const body = event.body || "";

  if (!event.isBase64Encoded) {
    return body;
  }

  return Buffer.from(body, "base64").toString("utf8");
}

async function verifyUser({ supabaseUrl, publishableKey, token }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function isAuthenticationFresh(lastSignInAt, nowMs = Date.now()) {
  if (typeof lastSignInAt !== "string" || !lastSignInAt.trim()) {
    return false;
  }

  const lastSignInMs = Date.parse(lastSignInAt);

  if (!Number.isFinite(lastSignInMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  const authenticationAgeMs = nowMs - lastSignInMs;
  return authenticationAgeMs >= 0 && authenticationAgeMs < AUTH_FRESHNESS_WINDOW_MS;
}

exports.isAuthenticationFresh = isAuthenticationFresh;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(
      405,
      { error: "Method not allowed" },
      { Allow: "POST" }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json(500, {
      error: "Server configuration unavailable",
    });
  }

  const contentType =
    event.headers["content-type"] ||
    event.headers["Content-Type"] ||
    "";

  if (
    contentType &&
    !contentType.toLowerCase().includes("application/json")
  ) {
    return json(415, {
      error: "Content type not supported",
    });
  }

  const rawBody = getRawBody(event);

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json(413, {
      error: "Request too large",
    });
  }

  let payload;

  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return json(400, {
      error: "Invalid request body",
    });
  }

  const resourceId =
    typeof payload.resourceId === "string"
      ? payload.resourceId.trim()
      : "";

  if (!UUID_RE.test(resourceId)) {
    return json(400, {
      error: "Invalid resource identifier",
    });
  }

  const token = getBearerToken(event.headers || {});

  if (!token) {
    return json(401, {
      error: "Authentication required",
    });
  }

  const user = await verifyUser({
    supabaseUrl,
    publishableKey,
    token,
  });

  if (!user || !user.id) {
    return json(401, {
      error: "Authentication required",
    });
  }

  if (!isAuthenticationFresh(user.last_sign_in_at)) {
    return json(401, {
      error: "Reauthentication required",
      code: "reauth_required",
    });
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: resource,
    error: resourceError,
  } = await supabaseAdmin
    .from("resources")
    .select("id,published,archived_at,file_path")
    .eq("id", resourceId)
    .maybeSingle();

  if (
    resourceError ||
    !resource ||
    !resource.file_path
  ) {
    return json(404, {
      error: "Resource not found",
    });
  }

  if (resource.archived_at) {
    return json(404, {
      error: "Resource not found",
    });
  }

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = Boolean(roleRow);

  if (!resource.published && !isAdmin) {
    return json(404, {
      error: "Resource not found",
    });
  }

  if (!resource.file_path.startsWith(`${resource.id}/`)) {
    return json(400, {
      error: "Invalid resource file path",
    });
  }

  const {
    data: signedUrlData,
    error: signedUrlError,
  } = await supabaseAdmin.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(
      resource.file_path,
      DOWNLOAD_TTL_SECONDS,
      {
        download: true,
      }
    );

  if (
    signedUrlError ||
    !signedUrlData ||
    !signedUrlData.signedUrl
  ) {
    return json(500, {
      error: "Unable to create download link",
    });
  }

  const { error: downloadError } =
    await supabaseAdmin
      .from("downloads")
      .insert({
        user_id: user.id,
        resource_id: resource.id,
      });

  if (downloadError) {
    console.error("download_log_failed", {
      user_id: user.id,
      resource_id: resource.id,
      message: downloadError.message,
    });
  }

  return json(200, {
    signedUrl: signedUrlData.signedUrl,
    expiresIn: DOWNLOAD_TTL_SECONDS,
  });
};
