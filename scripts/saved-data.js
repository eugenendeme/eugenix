import { getSupabaseClient } from "./supabase-client.js";

const SAVED_RESOURCE_FIELDS = "id,slug,title,teaser,file_type,author,tags,published_at,created_at,category:categories(id,slug,name)";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("SAVED_NOT_CONFIGURED");
  return client;
}

export async function fetchSavedResourceIds() {
  const { data, error } = await requireClient().from("resource_bookmarks").select("resource_id");
  if (error) throw new Error("SAVED_QUERY_FAILED");
  return new Set((Array.isArray(data) ? data : []).map((row) => row.resource_id).filter(Boolean));
}

export async function fetchSavedResources() {
  const client = requireClient();
  const { data: bookmarks, error: bookmarkError } = await client
    .from("resource_bookmarks")
    .select("resource_id,created_at")
    .order("created_at", { ascending: false });
  if (bookmarkError) throw new Error("SAVED_QUERY_FAILED");
  if (!Array.isArray(bookmarks) || bookmarks.length === 0) return [];
  const ids = bookmarks.map((row) => row.resource_id);
  const { data: resources, error: resourceError } = await client
    .from("resources")
    .select(SAVED_RESOURCE_FIELDS)
    .in("id", ids)
    .eq("published", true)
    .is("archived_at", null);
  if (resourceError) throw new Error("SAVED_QUERY_FAILED");
  const resourcesById = new Map((Array.isArray(resources) ? resources : []).map((resource) => [resource.id, resource]));
  return bookmarks.map((bookmark) => ({ ...bookmark, resource: resourcesById.get(bookmark.resource_id) || null }));
}

export async function saveResource(resourceId) {
  const { data, error } = await requireClient().rpc("save_resource", { target_resource_id: resourceId });
  if (error) throw new Error("SAVE_FAILED");
  if (data !== true) throw new Error("RESOURCE_UNAVAILABLE");
  return true;
}

export async function unsaveResource(resourceId) {
  const { data, error } = await requireClient().rpc("unsave_resource", { target_resource_id: resourceId });
  if (error) throw new Error("UNSAVE_FAILED");
  return data === true;
}
