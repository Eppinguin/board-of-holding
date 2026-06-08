import { describe, expect, it } from "vitest";
import { MarkdownTableParser } from "../src/core/random/MarkdownTableParser";

const markdown = `| d6 | Encounter |
|---:|-----------|
| 1 | Lost merchant |
| 2 | Wolves fighting over a corpse |`;

describe("MarkdownTableParser", () => {
	it("parses markdown tables", () => {
		const parser = new MarkdownTableParser();
		const parsed = parser.parseFirst(markdown);
		expect(parsed).not.toBeNull();
		expect(parsed?.headers).toEqual(["d6", "Encounter"]);
		expect(parsed?.rows[1]).toEqual(["2", "Wolves fighting over a corpse"]);
	});

	it("strips bold markers from cells", () => {
		const parser = new MarkdownTableParser();
		const md = [
			"| **ROLL** | **LOOT** |",
			"| :------: | -------- |",
			"|  **1**   | Bedroll  |",
			"|  **2**   | Whistle  |"
		].join("\n");
		const table = parser.parseFirst(md);
		expect(table?.headers).toEqual(["ROLL", "LOOT"]);
		expect(table?.rows[0]).toEqual(["1", "Bedroll"]);
	});

	it("promotes the first body row to headers when the header row is blank", () => {
		const parser = new MarkdownTableParser();
		const md = [
			"|            |                |                |",
			"| ---------- | -------------- | -------------- |",
			"|            | **Difficulty** | **HP**         |",
			"| **Tier 1** | 12-14          | 5-7            |",
			"| **Tier 3** | 16-18          | 6-8            |"
		].join("\n");
		const table = parser.parseFirst(md);
		expect(table?.headers).toEqual(["", "Difficulty", "HP"]);
		expect(table?.rows).toEqual([
			["Tier 1", "12-14", "5-7"],
			["Tier 3", "16-18", "6-8"]
		]);
	});

	it("aligns ragged rows to the header count", () => {
		const parser = new MarkdownTableParser();
		const md = ["| A | B | C |", "| - | - | - |", "| 1 | 2 |", "| 1 | 2 | 3 | 4 |"].join("\n");
		const table = parser.parseFirst(md);
		expect(table?.rows[0]).toEqual(["1", "2", ""]);
		expect(table?.rows[1]).toEqual(["1", "2", "3"]);
	});
});
