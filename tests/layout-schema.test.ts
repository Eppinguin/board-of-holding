import { describe, expect, it } from "vitest";
import { parseScreenLayout } from "../src/core/layout/layout-schema";

describe("layout schema", () => {
	it("validates a screen layout", () => {
		const parsed = parseScreenLayout({
			version: 1,
			id: "combat",
			name: "Combat",
			cards: [
				{
					id: "note-1",
					type: "note",
					x: 0,
					y: 0,
					w: 4,
					h: 4,
					config: { source: "Rules.md", mode: "full-note", showTitle: true, compact: false }
				}
			]
		});
		expect(parsed.cards.length).toBe(1);
	});

	it("rejects invalid layout", () => {
		expect(() => parseScreenLayout({ version: 0, id: "", name: "", cards: [] })).toThrow();
	});
});
