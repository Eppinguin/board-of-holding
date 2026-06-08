import type { Plugin } from "obsidian";

export type GMScreenSettings = {
	lastOpenedScreenId: string | null;
	layoutFolder: string;
	searchFolders: string[];
	preferredSearchFolders: string[];
	archiveFolders: string[];
	defaultNoteFolder: string;
};

export const DEFAULT_SETTINGS: GMScreenSettings = {
	lastOpenedScreenId: null,
	layoutFolder: "_GM Screens",
	searchFolders: [],
	preferredSearchFolders: [],
	archiveFolders: ["Archive", "Daily"] as string[],
	defaultNoteFolder: ""
};

export class SettingsService {
	private readonly plugin: Plugin;
	private settings: GMScreenSettings = { ...DEFAULT_SETTINGS };

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<GMScreenSettings> {
		const loaded = (await this.plugin.loadData()) as Partial<GMScreenSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...(loaded ?? {})
		};
		return this.settings;
	}

	get(): GMScreenSettings {
		return this.settings;
	}

	async update(patch: Partial<GMScreenSettings>): Promise<GMScreenSettings> {
		this.settings = {
			...this.settings,
			...patch
		};
		await this.plugin.saveData(this.settings);
		return this.settings;
	}
}
