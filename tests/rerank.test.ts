import { describe, expect, it } from "vitest";
import { rerankCandidates } from "../src/core/search/rerank";

describe("rerankCandidates", () => {
	it("boosts exact heading matches", () => {
		const results = rerankCandidates(
			"combat",
			[
				{
					score: 10,
					doc: {
						id: "1",
						kind: "section",
						filePath: "Rules.md",
						folder: "Rules",
						title: "Rules",
						heading: "Combat",
						headingPath: ["Rules", "Combat"],
						aliases: [],
						tags: [],
						properties: {},
						body: "combat rules"
					}
				},
				{
					score: 12,
					doc: {
						id: "2",
						kind: "file",
						filePath: "Lore.md",
						folder: "Lore",
						title: "Lore",
						aliases: [],
						tags: [],
						properties: {},
						body: "mentions combat briefly"
					}
				}
			]
		);

		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.doc.id).toBe("1");
	});
});
