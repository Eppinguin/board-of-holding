import type { ParsedTable } from "./MarkdownTableParser";

export type DiceColumn = { index: number; max: number };

/**
 * Picks `count` rows from a parsed markdown table.
 *
 * If the leading column reads as a set of dice ranges (e.g. "1-5", "20",
 * "96-00"), a die is rolled across the full range and the matching row is
 * returned — the way printed TTRPG random tables are meant to be consulted.
 * Otherwise rows are drawn with uniform probability.
 *
 * `random` is injectable for deterministic tests.
 */
export function pickTableRows(
	table: ParsedTable,
	count: number,
	random: () => number = Math.random
): string[][] {
	if (table.rows.length === 0) {
		throw new Error("Cannot pick from a table with no rows");
	}
	const diceColumn = detectDiceColumn(table);
	const result: string[][] = [];
	for (let i = 0; i < count; i++) {
		result.push(
			diceColumn ? rollDiceTableRow(table, diceColumn, random) : pickUniform(table.rows, random)
		);
	}
	return result;
}

/** Returns the leading column index + its max value when it holds dice ranges. */
export function detectDiceColumn(table: ParsedTable): DiceColumn | null {
	const index = 0;
	let max = 0;
	for (const row of table.rows) {
		const range = parseDiceRange(row[index]);
		if (!range) {
			return null;
		}
		max = Math.max(max, range.high);
	}
	return max > 0 ? { index, max } : null;
}

export function parseDiceRange(cell: string | undefined): { low: number; high: number } | null {
	if (cell === undefined) {
		return null;
	}
	const match = /^(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?$/.exec(cell.trim());
	if (!match) {
		return null;
	}
	// "00" reads as 100 on a percentile table.
	const low = normalizeRangeValue(match[1]!);
	const high = match[2] === undefined ? low : normalizeRangeValue(match[2]);
	return high >= low ? { low, high } : null;
}

function normalizeRangeValue(token: string): number {
	const value = Number(token);
	return value === 0 ? 100 : value;
}

function rollDiceTableRow(table: ParsedTable, diceColumn: DiceColumn, random: () => number): string[] {
	const roll = Math.floor(random() * diceColumn.max) + 1;
	for (const row of table.rows) {
		const range = parseDiceRange(row[diceColumn.index]);
		if (range && roll >= range.low && roll <= range.high) {
			return row;
		}
	}
	// Fall back to a uniform pick if the roll lands in an unlabelled gap.
	return pickUniform(table.rows, random);
}

function pickUniform<TValue>(items: TValue[], random: () => number): TValue {
	return items[Math.floor(random() * items.length)]!;
}
