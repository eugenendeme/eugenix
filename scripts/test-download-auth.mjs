import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const downloadFunction = require("../netlify/functions/resource-download.js");
const { handler, isAuthenticationFresh } = downloadFunction;

const HOUR_MS = 60 * 60 * 1000;
const NOW_MS = Date.parse("2026-08-25T12:00:00.000Z");
const timestampAtAge = (ageMs) => new Date(NOW_MS - ageMs).toISOString();
const downloadClientSource = await readFile(new URL("./download-client.js", import.meta.url), "utf8");
const { downloadFailure } = await import(`data:text/javascript;base64,${Buffer.from(downloadClientSource).toString("base64")}`);

assert.equal(isAuthenticationFresh(timestampAtAge(47 * HOUR_MS), NOW_MS), true);
assert.equal(isAuthenticationFresh(timestampAtAge(48 * HOUR_MS), NOW_MS), false);
assert.equal(isAuthenticationFresh(timestampAtAge(49 * HOUR_MS), NOW_MS), false);
assert.equal(isAuthenticationFresh(undefined, NOW_MS), false);
assert.equal(isAuthenticationFresh("not-a-timestamp", NOW_MS), false);
assert.equal(isAuthenticationFresh(new Date(NOW_MS).toISOString(), NOW_MS), true);
assert.equal(isAuthenticationFresh(new Date(NOW_MS + 1).toISOString(), NOW_MS), false);

assert.deepEqual(downloadFailure({ status: 401, payload: { code: "reauth_required" } }), {
  kind: "reauth",
  title: "Sign in again to continue",
  message: "For your security, please sign in again before downloading this file.",
  actionLabel: "Sign in again",
});
assert.deepEqual(downloadFailure({ status: 401, payload: {} }), {
  kind: "authentication",
  title: "Your session has expired",
  message: "Sign in again to download this file.",
});
assert.deepEqual(downloadFailure({ status: 404, payload: {} }), {
  kind: "unavailable",
  title: "Resource unavailable",
  message: "This resource is no longer available.",
});

const functionSource = await readFile(new URL("../netlify/functions/resource-download.js", import.meta.url), "utf8");
assert.match(functionSource, /const DOWNLOAD_TTL_SECONDS = 300;/);
const detailSource = await readFile(new URL("./resource-detail.js", import.meta.url), "utf8");
const feedbackSource = await readFile(new URL("./feedback.js", import.meta.url), "utf8");
const authSource = await readFile(new URL("./auth.js", import.meta.url), "utf8");
assert.match(detailSource, /failure\.kind === "reauth"/);
assert.match(detailSource, /actionLabel: failure\.actionLabel/);
assert.match(detailSource, /focusAction: true/);
assert.match(detailSource, /signInWithGoogle\(`\$\{window\.location\.pathname\}\?download=1`\)/);
assert.match(feedbackSource, /setAttribute\("aria-hidden", "true"\)/);
assert.match(feedbackSource, /action\.textContent = actionLabel/);
assert.match(feedbackSource, /action\.type = "button"/);
assert.match(authSource, /target\.origin !== window\.location\.origin/);
assert.match(authSource, /sessionStorage\.setItem\(AUTH_NOTICE_KEY, safeReturnPath\)/);

const previousFetch = globalThis.fetch;
const previousEnvironment = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

try {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  delete process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

  const staleUserFetchCalls = [];
  globalThis.fetch = async (url, options) => {
    staleUserFetchCalls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      id: "92000000-0000-4000-8000-000000000001",
      last_sign_in_at: new Date(Date.now() - 49 * HOUR_MS).toISOString(),
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const staleResponse = await handler({
    httpMethod: "POST",
    headers: {
      authorization: "Bearer stale-user-access-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ resourceId: "71000000-0000-4000-8000-000000000001" }),
    isBase64Encoded: false,
  });

  assert.equal(staleResponse.statusCode, 401);
  assert.deepEqual(JSON.parse(staleResponse.body), {
    error: "Reauthentication required",
    code: "reauth_required",
  });
  assert.equal(staleUserFetchCalls.length, 1);
  assert.equal(staleUserFetchCalls[0].url, "https://example.supabase.co/auth/v1/user");

  globalThis.fetch = async () => new Response("{}", { status: 401 });

  const response = await handler({
    httpMethod: "POST",
    headers: {
      authorization: "Bearer invalid-access-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ resourceId: "71000000-0000-4000-8000-000000000001" }),
    isBase64Encoded: false,
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(JSON.parse(response.body), { error: "Authentication required" });
} finally {
  globalThis.fetch = previousFetch;
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

console.log("Download authentication freshness assertions passed.");
