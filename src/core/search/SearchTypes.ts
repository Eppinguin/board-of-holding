export type SearchDocument = {
	id: string;
	filePath: string;
	folder: string;
	title: string;
	heading?: string;
	headingPath?: string[];
	aliases: string[];
	tags: string[];
	properties: Record<string, string | string[]>;
	body: string;
	kind: "file" | "section" | "block";
};

export type SearchCandidate = {
	doc: SearchDocument;
	score: number;
};

export type SearchResult = {
	doc: SearchDocument;
	score: number;
	snippet: string;
};
