export function savedResourceOf(record) {
  const resource = Array.isArray(record?.resource) ? record.resource[0] : record?.resource;
  return resource && typeof resource === "object" ? resource : null;
}

export function filterSavedRecords(records, { query = "", category = "all" } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  return records.filter((record) => {
    const resource = savedResourceOf(record);
    if (!resource) return category === "all" && (!normalizedQuery || "resource no longer available".includes(normalizedQuery));
    const resourceCategory = Array.isArray(resource.category) ? resource.category[0] : resource.category;
    const categoryMatches = category === "all" || resourceCategory?.slug === category;
    const haystack = [resource.title, resource.teaser, resource.author, resourceCategory?.name, ...(Array.isArray(resource.tags) ? resource.tags : [])].filter(Boolean).join(" ").toLocaleLowerCase();
    return categoryMatches && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}
