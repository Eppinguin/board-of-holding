import type { Plugin } from "obsidian";
import type { ScreenLayout } from "../cards/card-types";

export type GMScreenData = {
	lastOpenedScreenId: string | null;
	screens: Record<string, ScreenLayout>;
};

const DEFAULT_DATA: GMScreenData = {
	lastOpenedScreenId: null,
	screens: {}
};

export class SettingsService {
	private readonly plugin: Plugin;
	private data: GMScreenData = { ...DEFAULT_DATA };

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<GMScreenData> {
		const loaded = (await this.plugin.loadData()) as Partial<GMScreenData> | null;
		this.data = {
			...DEFAULT_DATA,
			...loaded,
			screens: (loaded as GMScreenData | null)?.screens ?? {}
		};
		return this.data;
	}

	get(): GMScreenData {
		return this.data;
	}

	async update(patch: Partial<GMScreenData>): Promise<GMScreenData> {
		this.data = {
			...this.data,
			...patch
		};
		await this.plugin.saveData(this.data);
		return this.data;
	}
}
