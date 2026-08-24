export function categoryOf(resource) {
  const category = Array.isArray(resource?.category) ? resource.category[0] : resource?.category;
  return category && typeof category === "object" ? category : null;
}

export function filterAndSortResources(resources, { category = "all", query = "", sort = "newest" } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const filtered = resources.filter((resource) => {
    const resourceCategory = categoryOf(resource);
    const categoryMatches = category === "all" || resourceCategory?.slug === category;
    const haystack = [resource.title, resource.teaser, resource.author, resourceCategory?.name, ...(Array.isArray(resource.tags) ? resource.tags : [])].filter(Boolean).join(" ").toLocaleLowerCase();
    return categoryMatches && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
  return filtered.sort((firstResource, secondResource) => {
    if (sort === "az") return String(firstResource.title).localeCompare(String(secondResource.title));
    const firstDate = new Date(firstResource.published_at || firstResource.created_at || 0).getTime();
    const secondDate = new Date(secondResource.published_at || secondResource.created_at || 0).getTime();
    return sort === "oldest" ? firstDate - secondDate : secondDate - firstDate;
  });
}
