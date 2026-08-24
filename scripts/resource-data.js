import { getSupabaseClient } from "./supabase-client.js";

const RESOURCE_FIELDS = "id,slug,title,teaser,description,file_type,mime_type,author,tags,published_at,created_at,category:categories(id,slug,name)";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("CATALOG_NOT_CONFIGURED");
  return client;
}

export async function fetchCategories() {
  const { data, error } = await requireClient().from("categories").select("id,slug,name,description,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true });
  if (error) throw new Error("CATEGORY_QUERY_FAILED");
  return Array.isArray(data) ? data : [];
}

export async function fetchPublishedResources() {
  const { data, error } = await requireClient().from("resources").select(RESOURCE_FIELDS).eq("published", true).is("archived_at", null).order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw new Error("RESOURCE_QUERY_FAILED");
  return Array.isArray(data) ? data : [];
}

export async function fetchPublishedResourceBySlug(slug) {
  const { data, error } = await requireClient().from("resources").select(RESOURCE_FIELDS).eq("slug", slug).eq("published", true).is("archived_at", null).maybeSingle();
  if (error) throw new Error("RESOURCE_DETAIL_QUERY_FAILED");
  return data || null;
}
