import { copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, "dist");
const supabaseBundle = join(projectRoot, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js");
const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabasePublishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();

const rootFiles = ["index.html", "404.html", "favicon.svg", "robots.txt", "sitemap.xml"];
const routeDirectories = ["admin", "privacy", "resources", "saved", "resume", "terms", "work"];
const assetDirectories = ["assets"];
const runtimeScripts = [
  "admin.js", "admin-data.js", "auth.js", "contact.js", "download-client.js", "hero.js", "main.js",
  "motion.js", "navigation.js", "process.js", "resource-data.js", "resource-detail.js", "resource-filter.js",
  "resources.js", "resource-shell.js", "saved.js", "saved-controls.js", "saved-data.js", "saved-filter.js",
  "saved-store.js", "supabase-client.js",
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(join(outputRoot, "scripts", "vendor"), { recursive: true });
await Promise.all(rootFiles.map((name) => copyFile(join(projectRoot, name), join(outputRoot, name))));
await Promise.all(routeDirectories.map((name) => cp(join(projectRoot, name), join(outputRoot, name), { recursive: true })));
await Promise.all(assetDirectories.map((name) => cp(join(projectRoot, name), join(outputRoot, name), { recursive: true })));
await cp(join(projectRoot, "styles"), join(outputRoot, "styles"), { recursive: true });
await Promise.all(runtimeScripts.map((name) => copyFile(join(projectRoot, "scripts", name), join(outputRoot, "scripts", name))));
await copyFile(supabaseBundle, join(outputRoot, "scripts", "vendor", "supabase.js"));
await writeFile(
  join(outputRoot, "scripts", "public-config.js"),
  `window.EUGENIX_PUBLIC_CONFIG = Object.freeze(${JSON.stringify({ supabaseUrl, supabasePublishableKey })});\n`,
  "utf8"
);

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn("Public Supabase configuration is empty; Resource Hub pages will use their truthful unavailable state.");
}

console.log("Production artifact created in dist/ from the explicit public allowlist.");
