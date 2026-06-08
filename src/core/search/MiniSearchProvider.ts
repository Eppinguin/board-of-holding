import MiniSearch from "minisearch";
import type { SearchCandidate, SearchDocument } from "./SearchTypes";

type IndexedDocument = {
	id: string;
	heading: string;
	headingPath: string;
	aliases: string;
	title: string;
	tags: string;
	properties: string;
	body: string;
	filePath: string;
};

export class MiniSearchProvider {
	private readonly miniSearch: MiniSearch<IndexedDocument>;
	private readonly byId = new Map<string, SearchDocument>();

	constructor() {
		this.miniSearch = new MiniSearch<IndexedDocument>({
			idField: "id",
			fields: ["heading", "headingPath", "aliases", "title", "tags", "properties", "body", "filePath"],
			storeFields: ["id"],
			searchOptions: {
				boost: {
					heading: 12,
					aliases: 10,
					title: 8,
					headingPath: 6,
					tags: 4,
					properties: 3,
					body: 1,
					filePath: 0.5
				},
				prefix: true,
				fuzzy: 0.2
			}
		});
	}

	rebuild(docs: SearchDocument[]): void {
		this.miniSearch.removeAll();
		this.byId.clear();

		const indexedDocs = docs.map((doc) => {
			this.byId.set(doc.id, doc);
			return this.toIndexedDocument(doc);
		});

		this.miniSearch.addAll(indexedDocs);
	}

	search(query: string, limit: number): SearchCandidate[] {
		if (!query.trim()) {
			return [];
		}

		const results = this.miniSearch.search(query, {
			combineWith: "AND",
			prefix: true,
			fuzzy: 0.2,
			boost: {
				heading: 12,
				aliases: 10,
				title: 8,
				headingPath: 6,
				tags: 4,
				properties: 3,
				body: 1,
				filePath: 0.5
			}
		});

		const candidates: SearchCandidate[] = [];
		for (const result of results.slice(0, Math.max(limit * 3, limit))) {
			const doc = this.byId.get(result.id);
			if (!doc) {
				continue;
			}
			candidates.push({ doc, score: result.score });
		}

		return candidates;
	}

	private toIndexedDocument(doc: SearchDocument): IndexedDocument {
		const flattenedProperties = Object.entries(doc.properties)
			.map(([key, value]) => {
				if (typeof value === "string") {
					return `${key}:${value}`;
				}
				return `${key}:${value.join(" ")}`;
			})
			.join(" ");

		return {
			id: doc.id,
			heading: doc.heading ?? "",
			headingPath: (doc.headingPath ?? []).join(" > "),
			aliases: doc.aliases.join(" "),
			title: doc.title,
			tags: doc.tags.join(" "),
			properties: flattenedProperties,
			body: doc.body,
			filePath: doc.filePath
		};
	}
}
