export function createSnippet(markdown: string, query: string, radius = 80): string {
	const collapsed = markdown.replace(/\s+/g, " ").trim();
	if (!collapsed) {
		return "";
	}

	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (!normalizedQuery) {
		return collapsed.slice(0, radius * 2);
	}

	const index = collapsed.toLocaleLowerCase().indexOf(normalizedQuery);
	if (index === -1) {
		return collapsed.slice(0, radius * 2);
	}

	const start = Math.max(0, index - radius);
	const end = Math.min(collapsed.length, index + normalizedQuery.length + radius);
	const prefix = start > 0 ? "…" : "";
	const suffix = end < collapsed.length ? "…" : "";

	return `${prefix}${collapsed.slice(start, end)}${suffix}`;
}
