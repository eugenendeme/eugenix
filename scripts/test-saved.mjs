import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterSavedRecords, savedResourceOf } from "./saved-filter.js";

const available = {
  resource_id: "71000000-0000-4000-8000-000000000001",
  resource: { title: "System Boundary Notes", teaser: "Trust boundaries", author: "EugenIX", tags: ["security"], category: { slug: "engineering-notes", name: "Engineering Notes" } },
};
const unavailable = { resource_id: "71000000-0000-4000-8000-000000000002", resource: null };
const records = [available, unavailable];

assert.equal(savedResourceOf(available)?.title, "System Boundary Notes");
assert.equal(savedResourceOf(unavailable), null);
assert.deepEqual(filterSavedRecords(records, { query: "security" }), [available]);
assert.deepEqual(filterSavedRecords(records, { category: "engineering-notes" }), [available]);
assert.deepEqual(filterSavedRecords(records, { query: "no longer" }), [unavailable]);

const dataClient = await readFile(new URL("./saved-data.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/0005_saved_resources_boundary.sql", import.meta.url), "utf8");
assert.equal(dataClient.includes("localStorage"), false);
assert.equal(dataClient.includes("user_id"), false);
assert.match(dataClient, /rpc\("save_resource", \{ target_resource_id: resourceId \}\)/);
assert.match(dataClient, /\.eq\("published", true\)/);
assert.match(migration, /user_id = auth\.uid\(\)/);
assert.match(migration, /on conflict \(user_id, resource_id\) do nothing/);
assert.match(migration, /revoke all on function public\.save_resource\(uuid\) from public, anon/);

console.log("Saved Resources unit and boundary assertions passed.");
