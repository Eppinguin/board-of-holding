import { describe, expect, it } from "vitest";
import { SectionExtractor } from "../src/core/notes/SectionExtractor";

const sample = `# Root

Intro paragraph

## Rules
Rule text

### Combat
Combat text

## NPCs
- A
- B

Block line ^npc-block
`;

describe("SectionExtractor", () => {
	it("extracts full note", () => {
		const extractor = new SectionExtractor();
		expect(extractor.extractFullNote(sample)).toContain("Intro paragraph");
	});

	it("extracts a heading section", () => {
		const extractor = new SectionExtractor();
		const section = extractor.extractHeadingSection(sample, "Rules");
		expect(section).toContain("Rule text");
		expect(section).toContain("### Combat");
	});

	it("extracts nested heading path", () => {
		const extractor = new SectionExtractor();
		const section = extractor.extractHeadingSection(sample, "Root > Rules > Combat");
		expect(section).toContain("Combat text");
		expect(section).not.toContain("NPCs");
	});

	it("extracts by block id", () => {
		const extractor = new SectionExtractor();
		const section = extractor.extractBlock(sample, "npc-block");
		expect(section).toContain("Block line ^npc-block");
	});
});
