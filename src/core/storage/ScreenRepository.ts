import { normalizePath, type App, TFile, TFolder } from "obsidian";
import type { ScreenLayout } from "../cards/card-types";
import { migrateLayout } from "../layout/migrations";

const FILE_EXTENSION = ".gmscreen.json";

export class ScreenRepository {
	private readonly app: App;

	constructor(app: App) {
		this.app = app;
	}

	async ensureLayoutFolder(folderPath: string): Promise<void> {
		const normalized = normalizePath(folderPath.trim());
		if (!normalized) {
			throw new Error("Layout folder cannot be empty");
		}

		const existing = this.app.vault.getAbstractFileByPath(normalized);
		if (existing) {
			if (existing instanceof TFolder) {
				return;
			}
			throw new Error(`Layout path exists but is not a folder: ${normalized}`);
		}

		await this.app.vault.createFolder(normalized);
	}

	async listLayouts(folderPath: string): Promise<{ id: string; name: string; path: string }[]> {
		const normalizedFolder = normalizePath(folderPath.trim());
		const files = this.app.vault
			.getFiles()
			.filter((file) => file.path.startsWith(`${normalizedFolder}/`) && file.path.endsWith(FILE_EXTENSION));

		return files.map((file) => ({
			id: this.pathToId(file.path),
			name: file.basename.replace(/\.gmscreen$/, ""),
			path: file.path
		}));
	}

	async loadLayoutById(folderPath: string, id: string): Promise<ScreenLayout | null> {
		const path = this.idToPath(folderPath, id);
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return null;
		}
		const raw = await this.app.vault.cachedRead(file);
		const parsed = JSON.parse(raw) as unknown;
		return migrateLayout(parsed);
	}

	async saveLayout(folderPath: string, layout: ScreenLayout): Promise<void> {
		await this.ensureLayoutFolder(folderPath);
		const path = this.idToPath(folderPath, layout.id);
		const payload = JSON.stringify(layout, null, 2);
		const existing = this.app.vault.getAbstractFileByPath(path);

		if (!(existing instanceof TFile)) {
			await this.app.vault.create(path, payload);
			return;
		}

		await this.app.vault.modify(existing, payload);
	}

	createEmptyLayout(name: string, id: string): ScreenLayout {
		return {
			version: 1,
			id,
			name,
			cards: []
		};
	}

	private idToPath(folderPath: string, id: string): string {
		const normalizedFolder = normalizePath(folderPath.trim());
		return normalizePath(`${normalizedFolder}/${id}${FILE_EXTENSION}`);
	}

	private pathToId(path: string): string {
		const base = path.split("/").pop() ?? path;
		return base.replace(FILE_EXTENSION, "");
	}
}
