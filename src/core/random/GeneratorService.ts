import { normalizePath, TFolder, type App } from "obsidian";
import type { RandomCardConfig, RandomGeneratorType } from "../cards/card-types";
import { NoteResolver, parseNoteTarget } from "../notes/NoteResolver";
import { SectionExtractor } from "../notes/SectionExtractor";
import { MarkdownTableParser, type ParsedTable } from "./MarkdownTableParser";
import { detectDiceColumn, pickTableRows } from "./TableRoller";

/** A single generated value, tagged so the UI can render it appropriately. */
export type RollEntry =
	| { kind: "text"; value: string }
	| { kind: "markdown"; value: string; title?: string }
	| { kind: "table-row"; title?: string; fields: { header: string; value: string }[] }
	| { kind: "file"; path: string; title: string };

export type RollResult = {
	/** Short label describing what kind of roll produced these entries. */
	meta: string;
	entries: RollEntry[];
};

export class GeneratorService {
	private readonly app: App;
	private readonly noteResolver: NoteResolver;
	private readonly sectionExtractor: SectionExtractor;
	private readonly tableParser: MarkdownTableParser;

	constructor(app: App, noteResolver: NoteResolver, sectionExtractor: SectionExtractor) {
		this.app = app;
		this.noteResolver = noteResolver;
		this.sectionExtractor = sectionExtractor;
		this.tableParser = new MarkdownTableParser();
	}

	async roll(config: RandomCardConfig): Promise<RollResult> {
		const count = clampCount(config.count);
		const type = await this.resolveGeneratorType(config);
		switch (type) {
			case "list":
				return this.rollList(config, count);
			case "table":
				return this.rollTable(config, count);
			case "sections":
				return this.rollSections(config, count);
			case "files":
				return this.rollFiles(config, count);
			default:
				throw new Error(`Unsupported generator type: ${type satisfies never}`);
		}
	}

	/**
	 * Returns the effective generator type: the user's override when set,
	 * otherwise auto-detection.
	 */
	async resolveGeneratorType(config: RandomCardConfig): Promise<RandomGeneratorType> {
		if (config.generatorType) {
			return config.generatorType;
		}
		return this.detectGenerator(config);
	}

	/**
	 * Works out which generator to run purely from the source.
	 * Folder → files; note with a markdown table → table; note with a bulleted
	 * list → list; otherwise pick a random heading section.
	 */
	async detectGenerator(config: RandomCardConfig): Promise<RandomGeneratorType> {
		const available = await this.detectAvailableTypes(config);
		// Priority: table > list > sections > files
		return available[0]!;
	}

	/**
	 * Returns all generator types that are valid for the current source, in
	 * priority order (highest first). The UI uses this to disable inapplicable
	 * options in the override control.
	 */
	async detectAvailableTypes(config: RandomCardConfig): Promise<RandomGeneratorType[]> {
		const source = config.source.trim();
		if (config.folder.trim() || this.isFolder(source)) {
			return ["files"];
		}

		const file = this.noteResolver.resolveFile(source);
		if (!file) {
			throw new Error(`Set a note or folder for this generator${source ? `: ${source}` : ""}`);
		}

		const markdown = this.scopeMarkdown(
			await this.app.vault.cachedRead(file),
			parseNoteTarget(source).heading ?? ""
		);

		const available: RandomGeneratorType[] = [];
		if (this.tableParser.parseFirst(markdown)) available.push("table");
		if (this.extractListItems(markdown).length > 0) available.push("list");
		// Sections is always available for any note with headings, but even without
		// headings the whole note counts as one section — so it's always offered.
		available.push("sections");
		return available;
	}

	private isFolder(path: string): boolean {
		if (!path) {
			return false;
		}
		return this.app.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFolder;
	}

	private scopeMarkdown(markdown: string, heading: string): string {
		if (!heading) {
			return markdown;
		}
		return this.sectionExtractor.extractHeadingSection(markdown, heading) ?? markdown;
	}

	private async rollList(config: RandomCardConfig, count: number): Promise<RollResult> {
		const markdown = await this.resolveScopedMarkdown(config);
		const items = this.extractListItems(markdown);
		if (items.length === 0) {
			throw new Error("No list items (lines starting with - or *) found in the source");
		}
		const entries = pickMany(items, count).map((value): RollEntry => ({ kind: "markdown", value }));
		return { meta: count > 1 ? `${count} random items` : "Random item", entries };
	}

	private async rollTable(config: RandomCardConfig, count: number): Promise<RollResult> {
		const markdown = await this.resolveScopedMarkdown(config);
		const table = this.tableParser.parseFirst(markdown);
		if (!table || table.rows.length === 0) {
			throw new Error("No markdown table with rows found in the source");
		}
		return config.tableAxis === "columns"
			? this.rollTableColumn(table, config, count)
			: this.rollTableRows(table, config, count);
	}

	/** Rolls whole rows, optionally projecting down to the configured columns. */
	private rollTableRows(table: ParsedTable, config: RandomCardConfig, count: number): RollResult {
		const titleIndex = this.detectTitleColumn(table);
		const keep = this.columnFilter(table, config.columns);

		const entries = pickTableRows(table, count).map((row): RollEntry => {
			const fields: { header: string; value: string }[] = [];
			let title: string | undefined;
			row.forEach((cell, index) => {
				if (index === titleIndex) {
					if (cell) title = cell;
					return;
				}
				if (keep && !keep.has(index)) {
					return;
				}
				if (cell) {
					fields.push({ header: table.headers[index] ?? "", value: cell });
				}
			});
			return { kind: "table-row", title, fields };
		});
		return { meta: count > 1 ? `${count} random rows` : "Random table row", entries };
	}

	/**
	 * Rolls a value from a single column. The column is chosen from the
	 * configured set (or any non-title column), then `count` values are drawn
	 * from that column's cells.
	 */
	private rollTableColumn(table: ParsedTable, config: RandomCardConfig, count: number): RollResult {
		const titleIndex = this.detectTitleColumn(table);
		const keep = this.columnFilter(table, config.columns);
		const eligible = table.headers
			.map((_, index) => index)
			.filter((index) => index !== titleIndex && (!keep || keep.has(index)));
		if (eligible.length === 0) {
			throw new Error("No columns available to roll from");
		}

		const columnIndex = eligible[pickIndex(eligible.length)]!;
		const header = table.headers[columnIndex] ?? "";
		const cells = table.rows
			.map((row) => row[columnIndex]?.trim())
			.filter((value): value is string => Boolean(value));
		if (cells.length === 0) {
			throw new Error(`Column "${header || columnIndex + 1}" has no values`);
		}

		const entries = pickMany(cells, count).map((value): RollEntry => ({
			kind: "table-row",
			fields: [{ header, value }]
		}));
		return { meta: count > 1 ? `${count} from “${header}”` : `Random ${header || "value"}`, entries };
	}

	/**
	 * The column treated as a row's title: an explicit dice/roll column, a header
	 * named "Roll" etc., or a leading column with a blank header.
	 */
	private detectTitleColumn(table: ParsedTable): number | null {
		const diceColumn = detectDiceColumn(table);
		return (
			diceColumn?.index ??
			this.detectRollColumnByHeader(table.headers) ??
			(table.headers[0] === "" ? 0 : null)
		);
	}

	/**
	 * Maps the configured column header names to a set of column indices.
	 * Returns null when no filter is configured (= keep all). Matching is
	 * case-insensitive; unknown names are ignored.
	 */
	private columnFilter(table: ParsedTable, columns: string[]): Set<number> | null {
		const wanted = columns.map((c) => c.trim().toLowerCase()).filter(Boolean);
		if (wanted.length === 0) {
			return null;
		}
		const set = new Set<number>();
		table.headers.forEach((header, index) => {
			if (wanted.includes(header.trim().toLowerCase())) {
				set.add(index);
			}
		});
		return set;
	}

	private detectRollColumnByHeader(headers: string[]): number | null {
		const rollPatterns = /^(roll|d\d+|#|nr\.?|num\.?)$/i;
		const idx = headers.findIndex((h) => rollPatterns.test(h.trim()));
		return idx === -1 ? null : idx;
	}

	/**
	 * Returns the column headers of the first table in the source (minus any
	 * detected title column), so the UI can offer a column picker. Empty when the
	 * source isn't a table.
	 */
	async getTableColumns(config: RandomCardConfig): Promise<string[]> {
		let markdown: string;
		try {
			markdown = await this.resolveScopedMarkdown(config);
		} catch {
			return [];
		}
		const table = this.tableParser.parseFirst(markdown);
		if (!table) {
			return [];
		}
		const titleIndex = this.detectTitleColumn(table);
		return table.headers
			.filter((header, index) => index !== titleIndex && header.trim().length > 0);
	}

	private async rollSections(config: RandomCardConfig, count: number): Promise<RollResult> {
		const file = this.noteResolver.resolveFile(config.source);
		if (!file) {
			throw new Error(`Note not found: ${config.source || "(none)"}`);
		}
		const markdown = await this.app.vault.cachedRead(file);
		const headings = Array.from(markdown.matchAll(/^#{1,6}\s+(.*)$/gm))
			.map((match) => match[1]?.trim())
			.filter((heading): heading is string => Boolean(heading));
		if (headings.length === 0) {
			throw new Error("No headings found in the note to pick a section from");
		}
		const entries = pickMany(headings, count).map((heading): RollEntry => {
			const section = this.sectionExtractor.extractHeadingSection(markdown, heading);
			return { kind: "markdown", title: heading, value: section ?? `## ${heading}` };
		});
		return { meta: count > 1 ? `${count} random sections` : "Random section", entries };
	}

	private rollFiles(config: RandomCardConfig, count: number): RollResult {
		const folder = normalizePath((config.folder.trim() || config.source.trim()));
		if (!folder) {
			throw new Error("Choose a folder for the files generator");
		}
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path === folder || file.path.startsWith(`${folder}/`));
		if (files.length === 0) {
			throw new Error(`No markdown files found in folder: ${config.folder}`);
		}
		const entries = pickMany(files, count).map((file): RollEntry => ({
			kind: "file",
			path: file.path,
			title: file.basename
		}));
		return { meta: count > 1 ? `${count} random files` : "Random file", entries };
	}

	/** Reads a note and narrows it to the `#heading` section in the source, if any. */
	private async resolveScopedMarkdown(config: RandomCardConfig): Promise<string> {
		const file = this.noteResolver.resolveFile(config.source);
		if (!file) {
			throw new Error(`Note not found: ${config.source || "(none)"}`);
		}
		const markdown = await this.app.vault.cachedRead(file);
		const heading = parseNoteTarget(config.source).heading?.trim();
		if (!heading) {
			return markdown;
		}
		const section = this.sectionExtractor.extractHeadingSection(markdown, heading);
		if (!section) {
			throw new Error(`Heading not found: ${heading}`);
		}
		return section;
	}

	private extractListItems(markdown: string): string[] {
		return markdown
			.split("\n")
			.map((line) => /^\s*[-*+]\s+(.+)$/.exec(line)?.[1]?.trim())
			.filter((value): value is string => Boolean(value));
	}
}

function clampCount(count: number): number {
	if (!Number.isFinite(count)) {
		return 1;
	}
	return Math.min(20, Math.max(1, Math.floor(count)));
}

function pickIndex(length: number): number {
	return Math.floor(Math.random() * length);
}

function pickMany<TValue>(items: TValue[], count: number): TValue[] {
	if (items.length === 0) {
		throw new Error("Cannot pick from an empty list");
	}
	const result: TValue[] = [];
	for (let i = 0; i < count; i++) {
		const value = items[pickIndex(items.length)];
		if (value !== undefined) {
			result.push(value);
		}
	}
	return result;
}
