import { AbstractInputSuggest, TFile, TFolder, type App } from "obsidian";
import { prepareFuzzySearch } from "obsidian";

// ── Folder suggest ────────────────────────────────────────────────────────────

class FolderSuggest extends AbstractInputSuggest<string> {
	private folders: string[];
	private readonly cb: (value: string) => void;

	constructor(app: App, inputEl: HTMLInputElement, cb: (value: string) => void) {
		super(app, inputEl);
		this.cb = cb;
		this.folders = [];
		for (const file of app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder) {
				this.folders.push(file.path);
			}
		}
		this.folders.sort((a, b) => a.localeCompare(b));
	}

	getSuggestions(query: string): string[] {
		if (!query) return this.folders.slice(0, 20);
		const search = prepareFuzzySearch(query);
		return this.folders.filter((f) => search(f) !== null).slice(0, 20);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value || "/");
	}

	selectSuggestion(value: string): void {
		this.setValue(value);
		this.cb(value);
		this.close();
	}
}

// ── File + anchor suggest ─────────────────────────────────────────────────────

type AnchorSuggestion =
	| { kind: "file"; file: TFile }
	| { kind: "heading"; file: TFile; heading: string; level: number }
	| { kind: "block"; file: TFile; id: string };

/**
 * Two-phase suggest: before `#` it completes file paths; after `#` it
 * completes headings and block IDs from whichever file precedes the `#`.
 */
class NoteReferenceSuggest extends AbstractInputSuggest<AnchorSuggestion> {
	private readonly files: TFile[];
	private readonly cb: (value: string) => void;
	private readonly inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, cb: (value: string) => void) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.cb = cb;
		this.files = app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
	}

	getSuggestions(query: string): AnchorSuggestion[] {
		const hashIdx = query.indexOf("#");
		if (hashIdx === -1) {
			// Phase 1: complete file path
			if (!query) return this.files.slice(0, 20).map((file) => ({ kind: "file", file }));
			const search = prepareFuzzySearch(query);
			return this.files
				.filter((f) => search(f.path) !== null || search(f.basename) !== null)
				.slice(0, 20)
				.map((file) => ({ kind: "file", file }));
		}

		// Phase 2: complete heading or block anchor within a specific file
		const filePart = query.slice(0, hashIdx).trim();
		const anchorQuery = query.slice(hashIdx + 1);
		const isBlock = anchorQuery.startsWith("^");
		const anchorSearch = isBlock ? anchorQuery.slice(1) : anchorQuery;

		const file = this.resolveFile(filePart);
		if (!file) return [];

		const cache = this.app.metadataCache.getCache(file.path);
		if (!cache) return [];

		const results: AnchorSuggestion[] = [];
		const search = anchorSearch ? prepareFuzzySearch(anchorSearch) : null;

		if (!isBlock) {
			for (const h of cache.headings ?? []) {
				if (!search || search(h.heading) !== null) {
					results.push({ kind: "heading", file, heading: h.heading, level: h.level });
				}
			}
		}

		for (const [id] of Object.entries(cache.blocks ?? {})) {
			if (!search || search(id) !== null) {
				results.push({ kind: "block", file, id });
			}
		}

		return results.slice(0, 20);
	}

	renderSuggestion(item: AnchorSuggestion, el: HTMLElement): void {
		if (item.kind === "file") {
			el.setText(item.file.path);
		} else if (item.kind === "heading") {
			const indent = "  ".repeat(item.level - 1);
			el.setText(`${indent}# ${item.heading}`);
		} else {
			el.setText(`^${item.id}`);
		}
	}

	selectSuggestion(item: AnchorSuggestion): void {
		let value: string;
		if (item.kind === "file") {
			value = item.file.path;
		} else if (item.kind === "heading") {
			const filePart = this.getFilePartFromInput();
			value = `${filePart}#${item.heading}`;
		} else {
			const filePart = this.getFilePartFromInput();
			value = `${filePart}#^${item.id}`;
		}
		this.setValue(value);
		this.cb(value);
		this.close();
	}

	private resolveFile(pathOrName: string): TFile | null {
		if (!pathOrName) return null;
		const direct = this.app.vault.getAbstractFileByPath(pathOrName);
		if (direct instanceof TFile) return direct;
		return this.app.metadataCache.getFirstLinkpathDest(pathOrName, "") ?? null;
	}

	private getFilePartFromInput(): string {
		const val = this.inputEl.value;
		const hashIdx = val.indexOf("#");
		return hashIdx === -1 ? val : val.slice(0, hashIdx);
	}
}

// ── Svelte actions ────────────────────────────────────────────────────────────

/** Svelte action: attaches folder autocomplete to an <input> */
export function folderSuggest(node: HTMLInputElement, params: { app: App; onSelect: (v: string) => void }) {
	const suggest = new FolderSuggest(params.app, node, params.onSelect);
	return {
		destroy() { suggest.close(); }
	};
}

/** Svelte action: attaches file + heading/block autocomplete to an <input> */
export function fileSuggest(node: HTMLInputElement, params: { app: App; onSelect: (v: string) => void }) {
	const suggest = new NoteReferenceSuggest(params.app, node, params.onSelect);
	return {
		destroy() { suggest.close(); }
	};
}
