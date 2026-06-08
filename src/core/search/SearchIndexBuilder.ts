import { normalizePath, type App, type CachedMetadata, type TFile } from "obsidian";
import type { SearchDocument } from "./SearchTypes";
import { createId } from "../utils/ids";

export class SearchIndexBuilder {
	private readonly app: App;

	constructor(app: App) {
		this.app = app;
	}

	async build(folders: string[]): Promise<SearchDocument[]> {
		const docs: SearchDocument[] = [];
		const files = this.getFilesInFolders(folders);

		for (const file of files) {
			const markdown = await this.app.vault.cachedRead(file);
			const cache = this.app.metadataCache.getFileCache(file);
			const base = this.buildBaseFields(file, cache);

			docs.push({
				id: createId("search-file"),
				kind: "file",
				filePath: file.path,
				folder: base.folder,
				title: base.title,
				aliases: base.aliases,
				tags: base.tags,
				properties: base.properties,
				body: markdown,
				heading: undefined,
				headingPath: undefined
			});

			const sectionDocs = this.buildSectionDocs(file, markdown, cache, base);
			docs.push(...sectionDocs);
		}

		return docs;
	}

	private getFilesInFolders(folders: string[]): TFile[] {
		const markdownFiles = this.app.vault.getMarkdownFiles();
		const normalizedFolders = folders
			.map((folder) => normalizePath(folder.trim()))
			.filter((folder) => folder.length > 0);

		if (normalizedFolders.length === 0) {
			return markdownFiles;
		}

		return markdownFiles.filter((file) => {
			return normalizedFolders.some((folder) => file.path === folder || file.path.startsWith(`${folder}/`));
		});
	}

	private buildBaseFields(file: TFile, cache: CachedMetadata | null): {
		folder: string;
		title: string;
		aliases: string[];
		tags: string[];
		properties: Record<string, string | string[]>;
	} {
		const folder = file.parent?.path ?? "/";
		const title = file.basename;

		const frontmatter = cache?.frontmatter ?? {};
		const aliasValue = frontmatter.aliases;
		const aliases = this.toStringArray(aliasValue);
		const tags = new Set<string>();

		for (const tagEntry of cache?.tags ?? []) {
			tags.add(tagEntry.tag.replace(/^#/, ""));
		}
		for (const tagValue of this.toStringArray(frontmatter.tags)) {
			tags.add(tagValue.replace(/^#/, ""));
		}

		const properties: Record<string, string | string[]> = {};
		for (const [key, value] of Object.entries(frontmatter)) {
			if (key === "aliases" || key === "tags") {
				continue;
			}
			if (typeof value === "string") {
				properties[key] = value;
				continue;
			}
			if (Array.isArray(value)) {
				properties[key] = value.filter((item): item is string => typeof item === "string");
			}
		}

		return {
			folder,
			title,
			aliases,
			tags: Array.from(tags),
			properties
		};
	}

	private buildSectionDocs(
		file: TFile,
		markdown: string,
		cache: CachedMetadata | null,
		base: {
			folder: string;
			title: string;
			aliases: string[];
			tags: string[];
			properties: Record<string, string | string[]>;
		}
	): SearchDocument[] {
		const headings = (cache?.headings ?? [])
			.map((heading) => ({
				heading: heading.heading,
				level: heading.level,
				line: heading.position.start.line
			}))
			.filter(
				(heading): heading is { heading: string; level: number; line: number } =>
					typeof heading.heading === "string" &&
					typeof heading.level === "number" &&
					typeof heading.line === "number"
			)
			.sort((a, b) => a.line - b.line);

		if (headings.length === 0) {
			return [];
		}

		const lines = markdown.split("\n");
		const sectionDocs: SearchDocument[] = [];
		const pathStack: string[] = [];

		for (let i = 0; i < headings.length; i++) {
			const current = headings[i];
			if (!current) {
				continue;
			}
			const next = headings[i + 1];
			const startLine = Math.max(0, current.line);
			const endLine = next ? Math.max(startLine, next.line) : lines.length;
			const body = lines.slice(startLine, endLine).join("\n").trim();

			if (!body) {
				continue;
			}

			pathStack.splice(Math.max(0, current.level - 1));
			pathStack[current.level - 1] = current.heading;

			sectionDocs.push({
				id: createId("search-section"),
				kind: "section",
				filePath: file.path,
				folder: base.folder,
				title: base.title,
				heading: current.heading,
				headingPath: [...pathStack],
				aliases: base.aliases,
				tags: base.tags,
				properties: base.properties,
				body
			});
		}

		return sectionDocs;
	}

	private toStringArray(value: unknown): string[] {
		if (typeof value === "string") {
			return [value];
		}
		if (Array.isArray(value)) {
			return value.filter((entry): entry is string => typeof entry === "string");
		}
		return [];
	}
}
