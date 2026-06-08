import type { SearchCandidate } from "./SearchTypes";

export type RerankOptions = {
	preferredFolders?: string[];
	penalizedFolders?: string[];
};

export function rerankCandidates(
	query: string,
	candidates: SearchCandidate[],
	options: RerankOptions = {}
): SearchCandidate[] {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const terms = normalizedQuery.split(/\s+/).filter(Boolean);

	const preferredFolders = new Set((options.preferredFolders ?? []).map((item) => item.toLocaleLowerCase()));
	const penalizedFolders = new Set((options.penalizedFolders ?? []).map((item) => item.toLocaleLowerCase()));

	const rescored = candidates.map((candidate) => {
		let score = candidate.score;
		const heading = (candidate.doc.heading ?? "").toLocaleLowerCase();
		const title = candidate.doc.title.toLocaleLowerCase();
		const aliases = candidate.doc.aliases.map((item) => item.toLocaleLowerCase());
		const body = candidate.doc.body.toLocaleLowerCase();
		const folder = candidate.doc.folder.toLocaleLowerCase();

		if (heading === normalizedQuery) {
			score += 50;
		}
		if (title === normalizedQuery) {
			score += 45;
		}
		if (aliases.includes(normalizedQuery)) {
			score += 40;
		}
		if (heading.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
			score += 20;
		}
		if (body.includes(normalizedQuery) && normalizedQuery.length > 2) {
			score += 10;
		}
		if (terms.length > 1 && terms.every((term) => body.includes(term))) {
			score += 12;
		}
		if (preferredFolders.has(folder)) {
			score += 5;
		}
		if (penalizedFolders.has(folder)) {
			score -= 8;
		}

		return { ...candidate, score };
	});

	rescored.sort((a, b) => b.score - a.score);
	return rescored;
}
