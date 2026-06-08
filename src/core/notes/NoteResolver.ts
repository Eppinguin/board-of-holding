import { normalizePath, type App, TFile } from "obsidian";
import { SectionExtractor } from "./SectionExtractor";
import type { NoteCardConfig } from "../cards/card-types";

export type ResolvedNoteContent = {
	file: TFile;
	title: string;
	markdown: string;
};

export class NoteResolver {
	private readonly app: App;
	private readonly sectionExtractor: SectionExtractor;

	constructor(app: App, sectionExtractor: SectionExtractor) {
		this.app = app;
		this.sectionExtractor = sectionExtractor;
	}

	resolveFile(pathOrLink: string): TFile | null {
		const path = parseNoteTarget(pathOrLink).path;
		const normalized = normalizePath(path);
		const direct = this.app.vault.getAbstractFileByPath(normalized);
		if (direct instanceof TFile && direct.extension === "md") {
			return direct;
		}

		return this.app.metadataCache.getFirstLinkpathDest(path, "") ?? null;
	}

	async resolveForNoteCard(config: NoteCardConfig): Promise<ResolvedNoteContent> {
		const target = parseNoteTarget(config.source);
		const file = this.resolveFile(config.source);
		if (!file) {
			throw new Error(`Note not found: ${target.path || config.source}`);
		}

		const markdown = await this.app.vault.cachedRead(file);
		let content: string | null;

		if (target.blockId) {
			content = this.sectionExtractor.extractBlock(markdown, target.blockId);
			if (!content) {
				throw new Error(`Block not found: ^${target.blockId}`);
			}
		} else if (target.heading) {
			content = this.sectionExtractor.extractHeadingSection(markdown, target.heading);
			if (!content) {
				throw new Error(`Heading not found: ${target.heading}`);
			}
		} else {
			content = this.sectionExtractor.extractFullNote(markdown);
		}

		return {
			file,
			title: file.basename,
			markdown: content
		};
	}
}

export type NoteTarget = {
	path: string;
	heading?: string;
	blockId?: string;
};

/**
 * Splits an Obsidian-style reference into its parts. Accepts plain paths,
 * `[[wikilinks]]`, `Note#Heading`, `Note#Sub > Heading`, and `Note#^block-id`.
 */
export function parseNoteTarget(source: string): NoteTarget {
	let raw = source.trim();
	// strip surrounding [[ ]] and any |display alias
	const wikilink = /^\[\[(.+?)\]\]$/.exec(raw);
	if (wikilink?.[1]) {
		raw = wikilink[1];
	}
	const aliasIndex = raw.indexOf("|");
	if (aliasIndex !== -1) {
		raw = raw.slice(0, aliasIndex);
	}

	const hashIndex = raw.indexOf("#");
	if (hashIndex === -1) {
		return { path: raw.trim() };
	}

	const path = raw.slice(0, hashIndex).trim();
	const fragment = raw.slice(hashIndex + 1).trim();
	if (fragment.startsWith("^")) {
		return { path, blockId: fragment.slice(1).trim() };
	}
	return { path, heading: fragment };
}
