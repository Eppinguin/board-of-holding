import { beforeAll, describe, expect, it, vi } from "vitest";

let SearchIndexBuilder: typeof import("../src/core/search/SearchIndexBuilder").SearchIndexBuilder;

vi.mock("obsidian", () => ({
	normalizePath: (value: string) => value
}));

beforeAll(async () => {
	({ SearchIndexBuilder } = await import("../src/core/search/SearchIndexBuilder"));
});

describe("SearchIndexBuilder", () => {
	it("builds file and section documents", async () => {
		const app = {
			vault: {
				getMarkdownFiles: () => [{ path: "Rules/Combat.md", basename: "Combat", parent: { path: "Rules" } }],
				cachedRead: async () => "# Combat\n\n## Initiative\nRoll d20",
			},
			metadataCache: {
				getFileCache: () => ({
					headings: [
						{ heading: "Combat", level: 1, position: { start: { line: 0 } } },
						{ heading: "Initiative", level: 2, position: { start: { line: 2 } } }
					],
					frontmatter: { aliases: ["Fight"], tags: ["rules"] },
					tags: [{ tag: "#rules" }]
				})
			}
		} as any;

		const builder = new SearchIndexBuilder(app);
		const docs = await builder.build([]);
		expect(docs.some((doc) => doc.kind === "file")).toBe(true);
		expect(docs.some((doc) => doc.kind === "section" && doc.heading === "Initiative")).toBe(true);
	});
});
