import { App, PluginSettingTab, Setting } from "obsidian";
import type { GMScreenPlugin } from "./GMScreenPlugin";

export class GMScreenSettingsTab extends PluginSettingTab {
	private readonly plugin: GMScreenPlugin;

	constructor(app: App, plugin: GMScreenPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Board of Holding" });

		new Setting(containerEl)
			.setName("Screen layout folder")
			.setDesc("Vault folder for GM screen JSON layout files")
			.addText((text) =>
				text
					.setPlaceholder("_GM Screens")
					.setValue(this.plugin.settings.layoutFolder)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ layoutFolder: value.trim() || "_GM Screens" });
					})
			);

		new Setting(containerEl)
			.setName("Search folders")
			.setDesc("Comma-separated folders to prioritize for index rebuild")
			.addText((text) =>
				text.setValue(this.plugin.settings.searchFolders.join(", ")).onChange(async (value) => {
					const folders = value
						.split(",")
						.map((entry) => entry.trim())
						.filter((entry) => entry.length > 0);
					await this.plugin.updateSettings({ searchFolders: folders });
				})
			);

		new Setting(containerEl)
			.setName("Preferred search folders")
			.setDesc("Folders that should rank higher in Search card results")
			.addText((text) =>
				text.setValue(this.plugin.settings.preferredSearchFolders.join(", ")).onChange(async (value) => {
					const folders = value
						.split(",")
						.map((entry) => entry.trim())
						.filter((entry) => entry.length > 0);
					await this.plugin.updateSettings({ preferredSearchFolders: folders });
				})
			);

		new Setting(containerEl)
			.setName("Archive folders")
			.setDesc("Folders to slightly down-rank in Search card results")
			.addText((text) =>
				text.setValue(this.plugin.settings.archiveFolders.join(", ")).onChange(async (value) => {
					const folders = value
						.split(",")
						.map((entry) => entry.trim())
						.filter((entry) => entry.length > 0);
					await this.plugin.updateSettings({ archiveFolders: folders });
				})
			);

	}
}
