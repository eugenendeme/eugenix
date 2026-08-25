import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { handler: contact } = require("../netlify/functions/contact.js");
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const migrationNames = (await readdir(new URL("supabase/migrations/", root))).sort();
assert.deepEqual(migrationNames, [
  "0001_initial.sql",
  "0002_security_hardening.sql",
  "0003_profile_trigger_and_download_boundary.sql",
  "0004_resource_category_taxonomy.sql",
  "0005_saved_resources_boundary.sql",
  "0006_admin_cms_analytics.sql",
  "0007_resource_archiving.sql",
  "20260824123339_grant_data_api_privileges.sql",
  "20260824125736_grant_admin_cms_table_privileges.sql",
  "20260824160632_grant_service_role_resource_access.sql",
  "20260824210758_fix_is_admin_parameter_shadowing.sql",
  "20260825013119_exclude_archived_resources_from_admin_metrics.sql",
]);


const archiveMigration = await read("supabase/migrations/0007_resource_archiving.sql");
const resourceData = await read("scripts/resource-data.js");
const savedData = await read("scripts/saved-data.js");
const adminData = await read("scripts/admin-data.js");
const downloadFunction = await read("netlify/functions/resource-download.js");
const netlify = await read("netlify.toml");
const sitemap = await read("sitemap.xml");
const robots = await read("robots.txt");
const adminHtml = await read("admin/index.html");
const savedHtml = await read("saved/index.html");
const resourcesHtml = await read("resources/index.html");

assert.match(archiveMigration, /archived_at timestamptz/);
assert.match(archiveMigration, /archived_at is null or published = false/);
assert.match(archiveMigration, /r\.archived_at is null/);
assert.match(resourceData, /\.is\("archived_at", null\)/);
assert.match(savedData, /\.is\("archived_at", null\)/);
assert.match(adminData, /values\.archived_at\?values\.published_at/);
assert.match(downloadFunction, /if \(resource\.archived_at\)/);
assert.match(netlify, /publish = "dist"/);
assert.match(netlify, /Content-Security-Policy/);
assert.match(netlify, /frame-ancestors 'none'/);
assert.match(netlify, /X-Content-Type-Options = "nosniff"/);
assert.match(netlify, /Referrer-Policy = "strict-origin-when-cross-origin"/);
assert.match(netlify, /Permissions-Policy/);
assert.doesNotMatch(sitemap, /\/admin\/|\/saved\//);
assert.match(robots, /Disallow: \/admin\//);
assert.match(robots, /Disallow: \/saved\//);
assert.match(adminHtml, /name="robots" content="noindex,nofollow"/);
assert.match(savedHtml, /name="robots" content="noindex,nofollow"/);
assert.match(resourcesHtml, /rel="canonical" href="https:\/\/eugenix\.dev\/resources\/"/);
assert.match(resourcesHtml, /property="og:title"/);

const event = (body, method = "POST") => ({
  httpMethod: method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  isBase64Encoded: false,
});
const valid = { name: "Production Test", email: "sender@example.test", inquiry: "project", subject: "Staging inquiry", message: "Plain-text delivery test.", website: "" };
const oldFetch = globalThis.fetch;
const oldEnv = { RESEND_API_KEY: process.env.RESEND_API_KEY, CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL, CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL };

try {
  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_FROM_EMAIL;
  assert.equal((await contact(event(valid, "GET"))).statusCode, 405);
  assert.equal((await contact({ ...event(valid), headers: { "content-type": "text/plain" } })).statusCode, 415);
  assert.equal((await contact({ ...event(valid), body: "{" })).statusCode, 400);
  assert.equal((await contact(event(valid))).statusCode, 503);
  assert.equal((await contact(event({ ...valid, website: "bot.example" }))).statusCode, 204);

  process.env.RESEND_API_KEY = "test-server-key";
  process.env.CONTACT_FROM_EMAIL = "EugenIX Test <test@eugenix.dev>";
  process.env.CONTACT_TO_EMAIL = "ndemeeugene237@gmail.com";
  let providerRequest;
  globalThis.fetch = async (url, options) => {
    providerRequest = { url, options };
    return new Response(JSON.stringify({ id: "staging-provider-id" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const accepted = await contact(event(valid));
  assert.equal(accepted.statusCode, 202);
  assert.deepEqual(JSON.parse(accepted.body), { accepted: true });
  const providerBody = JSON.parse(providerRequest.options.body);
  assert.equal(providerRequest.url, "https://api.resend.com/emails");
  assert.equal(providerBody.reply_to, valid.email);
  assert.deepEqual(providerBody.to, ["ndemeeugene237@gmail.com"]);
  assert.equal(Object.hasOwn(providerBody, "html"), false);
  assert.match(providerBody.text, /Inquiry type: project/);

  globalThis.fetch = async () => new Response(JSON.stringify({ message: "rejected" }), { status: 403 });
  assert.equal((await contact(event(valid))).statusCode, 502);
} finally {
  globalThis.fetch = oldFetch;
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

console.log("Phase 09 archive, delivery, deployment, and sitemap assertions passed.");
