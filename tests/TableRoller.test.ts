import { describe, expect, it } from "vitest";
import { detectDiceColumn, parseDiceRange, pickTableRows } from "../src/core/random/TableRoller";
import type { ParsedTable } from "../src/core/random/MarkdownTableParser";

const diceTable: ParsedTable = {
	headers: ["d6", "Encounter"],
	rows: [
		["1-2", "Lost merchant"],
		["3-5", "Wolves"],
		["6", "Dragon"]
	]
};

const plainTable: ParsedTable = {
	headers: ["Name", "Trait"],
	rows: [
		["Bram", "Gruff"],
		["Sela", "Curious"]
	]
};

describe("parseDiceRange", () => {
	it("parses single values and ranges", () => {
		expect(parseDiceRange("6")).toEqual({ low: 6, high: 6 });
		expect(parseDiceRange("1-5")).toEqual({ low: 1, high: 5 });
		expect(parseDiceRange(" 96 – 99 ")).toEqual({ low: 96, high: 99 });
	});

	it("treats 00 as 100 on percentile tables", () => {
		expect(parseDiceRange("00")).toEqual({ low: 100, high: 100 });
		expect(parseDiceRange("96-00")).toEqual({ low: 96, high: 100 });
	});

	it("rejects non-numeric cells", () => {
		expect(parseDiceRange("Dragon")).toBeNull();
		expect(parseDiceRange(undefined)).toBeNull();
	});
});

describe("detectDiceColumn", () => {
	it("detects a leading dice column and its max", () => {
		expect(detectDiceColumn(diceTable)).toEqual({ index: 0, max: 6 });
	});

	it("returns null when the leading column is not dice ranges", () => {
		expect(detectDiceColumn(plainTable)).toBeNull();
	});
});

describe("pickTableRows", () => {
	it("maps a dice roll to the row whose range contains it", () => {
		// random() = 0.5 -> floor(0.5 * 6) + 1 = 4 -> "3-5" -> Wolves
		const [row] = pickTableRows(diceTable, 1, () => 0.5);
		expect(row).toEqual(["3-5", "Wolves"]);
	});

	it("hits the low and high edges of the range", () => {
		const low = pickTableRows(diceTable, 1, () => 0)[0]; // roll 1 -> Lost merchant
		const high = pickTableRows(diceTable, 1, () => 0.999)[0]; // roll 6 -> Dragon
		expect(low).toEqual(["1-2", "Lost merchant"]);
		expect(high).toEqual(["6", "Dragon"]);
	});

	it("picks uniformly when there is no dice column", () => {
		expect(pickTableRows(plainTable, 1, () => 0)[0]).toEqual(["Bram", "Gruff"]);
		expect(pickTableRows(plainTable, 1, () => 0.9)[0]).toEqual(["Sela", "Curious"]);
	});

	it("returns the requested number of rows", () => {
		expect(pickTableRows(diceTable, 3, () => 0.5)).toHaveLength(3);
	});
});
