import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(projectRoot, "dist");
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(distRoot);

const forbiddenPaths = ["docs/", "netlify/", "supabase/", "node_modules/", "package.json", "package-lock.json"];
const publicPaths = files.map((file) => relative(distRoot, file).replaceAll("\\", "/"));
for (const prefix of forbiddenPaths) assert.equal(publicPaths.some((path) => path === prefix || path.startsWith(prefix)), false, `${prefix} must not be public`);

const patterns = [
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  /\bre_[A-Za-z0-9_\-]{20,}\b/g,
  /\bGOCSPX-[A-Za-z0-9_\-]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];
const configuredSecrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.RESEND_API_KEY, process.env.GOOGLE_CLIENT_SECRET].filter((value) => typeof value === "string" && value.length >= 8);
const findings = [];
for (const file of files) {
  const content = await readFile(file, "utf8").catch(() => "");
  for (const pattern of patterns) if (pattern.test(content)) findings.push(`${relative(distRoot, file)} matched ${pattern}`);
  for (const secret of configuredSecrets) if (content.includes(secret)) findings.push(`${relative(distRoot, file)} contains a configured server secret`);
}
assert.deepEqual(findings, []);
console.log(`Public secret scan passed across ${files.length} production files.`);
