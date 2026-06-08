import {
	Modal,
	Notice,
	Plugin,
	Setting,
	SuggestModal,
	type App,
	type WorkspaceLeaf
} from "obsidian";
import type { CardType } from "../core/cards/card-types";
import { DEFAULT_SETTINGS, SettingsService, type GMScreenSettings } from "../core/storage/SettingsService";
import { GMScreenView } from "./GMScreenView";
import { GMScreenViewModel } from "./GMScreenViewModel";
import { ADD_CARD_COMMAND, CREATE_GM_SCREEN_COMMAND, GM_SCREEN_VIEW_TYPE, OPEN_GM_SCREEN_COMMAND } from "./constants";
import { GMScreenSettingsTab } from "./settings-tab";

export class GMScreenPlugin extends Plugin {
	settings: GMScreenSettings = { ...DEFAULT_SETTINGS };

	private settingsService!: SettingsService;
	private viewModel!: GMScreenViewModel;

	async onload(): Promise<void> {
		this.settingsService = new SettingsService(this);
		this.settings = await this.settingsService.load();
		this.viewModel = new GMScreenViewModel(this.app, this.settingsService);

		this.registerView(
			GM_SCREEN_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new GMScreenView(leaf, this.viewModel)
		);

		this.addRibbonIcon("layout-grid", "Open GM Screen", () => {
			void this.activateView();
		});

		this.addCommand({
			id: OPEN_GM_SCREEN_COMMAND,
			name: "Open GM Screen",
			callback: () => {
				void this.activateView();
			}
		});

		this.addCommand({
			id: CREATE_GM_SCREEN_COMMAND,
			name: "Create GM Screen",
			callback: () => {
				new CreateScreenModal(this.app, async (name) => {
					await this.viewModel.createScreen(name);
					await this.activateView();
					new Notice(`Created GM Screen: ${name}`);
				}).open();
			}
		});

		this.addCommand({
			id: ADD_CARD_COMMAND,
			name: "Add card to GM Screen",
			callback: () => {
				new CardTypeSuggestModal(this.app, this.viewModel, (type) => {
					this.viewModel.addCard(type);
				}).open();
			}
		});

		this.addSettingTab(new GMScreenSettingsTab(this.app, this));

		this.registerEvent(this.app.vault.on("create", (file) => this.viewModel.handleVaultFileChanged(file)));
		this.registerEvent(this.app.vault.on("modify", (file) => this.viewModel.handleVaultFileChanged(file)));
		this.registerEvent(this.app.vault.on("delete", (file) => this.viewModel.handleVaultFileChanged(file)));
		this.registerEvent(this.app.vault.on("rename", (file) => this.viewModel.handleVaultFileChanged(file)));
	}

	async onunload(): Promise<void> {
		await this.app.workspace.detachLeavesOfType(GM_SCREEN_VIEW_TYPE);
	}

	async updateSettings(patch: Partial<GMScreenSettings>): Promise<void> {
		this.settings = await this.settingsService.update(patch);
	}

	private async activateView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(GM_SCREEN_VIEW_TYPE);
		const existingLeaf = leaves[0];
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({
			type: GM_SCREEN_VIEW_TYPE,
			active: true
		});
		await this.app.workspace.revealLeaf(leaf);
	}
}

class CardTypeSuggestModal extends SuggestModal<CardType> {
	private readonly viewModel: GMScreenViewModel;
	private readonly onSelect: (type: CardType) => void;

	constructor(app: App, viewModel: GMScreenViewModel, onSelect: (type: CardType) => void) {
		super(app);
		this.viewModel = viewModel;
		this.onSelect = onSelect;
		this.setPlaceholder("Choose a card type");
	}

	getSuggestions(query: string): CardType[] {
		const normalized = query.toLocaleLowerCase();
		return this.viewModel
			.cardRegistry
			.list()
			.map((definition) => definition.type)
			.filter((type) => type.toLocaleLowerCase().includes(normalized));
	}

	renderSuggestion(type: CardType, el: HTMLElement): void {
		const definition = this.viewModel.cardRegistry.get(type);
		el.createEl("div", { text: definition.name });
		el.createEl("small", { text: type });
	}

	onChooseSuggestion(type: CardType): void {
		this.onSelect(type);
	}
}

class CreateScreenModal extends Modal {
	private readonly onSubmit: (name: string) => Promise<void>;
	private name = "GM Screen";

	constructor(app: App, onSubmit: (name: string) => Promise<void>) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create GM Screen" });

		new Setting(contentEl)
			.setName("Screen name")
			.addText((text) =>
				text.setPlaceholder("GM Screen").setValue(this.name).onChange((value) => {
					this.name = value;
				})
			);

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText("Create")
					.setCta()
					.onClick(async () => {
						await this.onSubmit(this.name.trim() || "GM Screen");
						this.close();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
