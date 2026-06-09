import { normalizePath, Notice, TFile, TFolder, type App, type Component, type TAbstractFile } from "obsidian";
import type { CardType, ScreenCard, ScreenLayout } from "../core/cards/card-types";
import { LayoutStore } from "../core/layout/layout-store";
import { SectionExtractor } from "../core/notes/SectionExtractor";
import { NoteResolver } from "../core/notes/NoteResolver";
import { MarkdownRenderService } from "../core/notes/MarkdownRenderService";
import { SearchService } from "../core/search/SearchService";
import { GeneratorService } from "../core/random/GeneratorService";
import { SettingsService } from "../core/storage/SettingsService";
import { createId } from "../core/utils/ids";
import { asErrorMessage } from "../core/utils/errors";
import type { GMScreenController } from "../ui/controller";
import { createCardRegistry } from "./create-card-registry";

export class GMScreenViewModel implements GMScreenController {
	readonly cardRegistry = createCardRegistry();
	readonly layoutStore = new LayoutStore();

	private readonly app: App;
	private readonly settingsService: SettingsService;
	private readonly noteResolver: NoteResolver;
	private readonly markdownRenderService: MarkdownRenderService;
	private readonly searchService: SearchService;
	private readonly generatorService: GeneratorService;

	constructor(app: App, settingsService: SettingsService) {
		this.app = app;
		this.settingsService = settingsService;
		const sectionExtractor = new SectionExtractor();
		this.noteResolver = new NoteResolver(app, sectionExtractor);
		this.markdownRenderService = new MarkdownRenderService(app);
		this.searchService = new SearchService(app);
		this.generatorService = new GeneratorService(app, this.noteResolver, sectionExtractor);
	}

	async loadInitialLayout(): Promise<void> {
		const data = this.settingsService.get();

		if (data.lastOpenedScreenId && data.screens[data.lastOpenedScreenId]) {
			this.layoutStore.setLayout(data.screens[data.lastOpenedScreenId]!);
			await this.searchService.rebuildIndex();
			return;
		}

		const screenIds = Object.keys(data.screens);
		if (screenIds.length > 0) {
			const firstLayout = data.screens[screenIds[0]!]!;
			this.layoutStore.setLayout(firstLayout);
			await this.settingsService.update({ lastOpenedScreenId: firstLayout.id });
			await this.searchService.rebuildIndex();
			return;
		}

		await this.createScreen("GM Screen");
		await this.searchService.rebuildIndex();
	}

	async saveLayout(): Promise<void> {
		const layout = this.layoutStore.getLayout();
		if (!layout) {
			return;
		}
		const data = this.settingsService.get();
		await this.settingsService.update({
			lastOpenedScreenId: layout.id,
			screens: { ...data.screens, [layout.id]: layout }
		});
	}

	async createScreen(name = "GM Screen"): Promise<void> {
		const safeName = name.trim() || "GM Screen";
		const id = this.uniqueScreenId(safeName);
		const layout: ScreenLayout = { version: 1, id, name: safeName, cards: [] };
		this.layoutStore.setLayout(layout);
		await this.saveLayout();
	}

	async openScreen(id: string): Promise<void> {
		const layout = this.settingsService.get().screens[id];
		if (!layout) {
			throw new Error(`Screen not found: ${id}`);
		}
		this.layoutStore.setLayout(layout);
		await this.settingsService.update({ lastOpenedScreenId: id });
	}

	async renameScreen(id: string, name: string): Promise<void> {
		const data = this.settingsService.get();
		const layout = data.screens[id];
		if (!layout) {
			return;
		}
		const safeName = name.trim() || "GM Screen";
		const updated: ScreenLayout = { ...layout, name: safeName };
		await this.settingsService.update({ screens: { ...data.screens, [id]: updated } });
		if (this.layoutStore.getLayout()?.id === id) {
			this.layoutStore.setLayout(updated);
		}
	}

	async deleteScreen(id: string): Promise<void> {
		const data = this.settingsService.get();
		if (!data.screens[id]) {
			return;
		}
		const screens = { ...data.screens };
		delete screens[id];
		await this.settingsService.update({ screens });

		const remaining = Object.values(screens);
		if (remaining[0]) {
			await this.openScreen(remaining[0].id);
		} else {
			await this.createScreen("GM Screen");
		}
	}

	exportScreen(id: string): string {
		const layout = this.settingsService.get().screens[id];
		if (!layout) {
			throw new Error(`Screen not found: ${id}`);
		}
		return JSON.stringify(layout, null, 2);
	}

	async importScreen(json: string): Promise<void> {
		const layout = this.parseScreen(json);
		const newId = this.uniqueScreenId(layout.name);
		const imported: ScreenLayout = { ...layout, id: newId };
		this.layoutStore.setLayout(imported);
		await this.saveLayout();
	}

	private parseScreen(json: string): ScreenLayout {
		let parsed: unknown;
		try {
			parsed = JSON.parse(json);
		} catch {
			throw new Error("Not valid JSON.");
		}
		if (!parsed || typeof parsed !== "object") {
			throw new Error("Expected a screen object.");
		}
		const candidate = parsed as Partial<ScreenLayout>;
		const name = typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : "Imported Screen";
		const rawCards = Array.isArray(candidate.cards) ? candidate.cards : [];

		const cards: ScreenCard[] = [];
		for (const raw of rawCards) {
			const card = this.parseCard(raw);
			if (card) {
				cards.push(card);
			}
		}

		return { version: 1, id: "", name, cards };
	}

	private parseCard(raw: unknown): ScreenCard | null {
		if (!raw || typeof raw !== "object") {
			return null;
		}
		const candidate = raw as Partial<ScreenCard>;
		const type = candidate.type;
		if (typeof type !== "string" || !this.cardRegistry.isRegistered(type as CardType)) {
			return null;
		}
		const cardType = type as CardType;
		const toInt = (value: unknown, fallback: number): number =>
			typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
		return {
			id: createId(`card-${cardType}`),
			type: cardType,
			x: toInt(candidate.x, 0),
			y: toInt(candidate.y, 0),
			w: Math.max(1, toInt(candidate.w, 1)),
			h: Math.max(1, toInt(candidate.h, 1)),
			config: this.cardRegistry.validateConfig(cardType, candidate.config)
		};
	}

	listScreens(): { id: string; name: string }[] {
		return Object.values(this.settingsService.get().screens).map((layout) => ({
			id: layout.id,
			name: layout.name
		}));
	}

	addCard<TType extends CardType>(type: TType, config?: Partial<ScreenCard<TType>["config"]>): void {
		const layout = this.layoutStore.getLayout();
		if (!layout) {
			return;
		}

		const definition = this.cardRegistry.get(type);
		const y = this.getNextRow(layout);
		const newCard: ScreenCard<TType> = {
			id: createId(`card-${type}`),
			type,
			x: 0,
			y,
			w: definition.defaultSize.w,
			h: definition.defaultSize.h,
			config: definition.validateConfig({ ...definition.defaultConfig, ...config })
		};

		this.layoutStore.addCard(newCard as ScreenCard);
		void this.saveLayout();
	}

	removeCard(cardId: string): void {
		this.layoutStore.removeCard(cardId);
		void this.saveLayout();
	}

	updateCardConfig<TType extends CardType>(cardId: string, type: TType, config: unknown): void {
		const validated = this.cardRegistry.validateConfig(type, config);
		this.layoutStore.updateCard(cardId, (card) => ({
			...card,
			config: validated
		}));
		void this.saveLayout();
	}

	updateCardPosition(cardId: string, x: number, y: number, w: number, h: number): void {
		this.layoutStore.updateCardPosition(cardId, x, y, w, h);
		void this.saveLayout();
	}

	async resolveNoteCard(config: ScreenCard<"note">["config"]): Promise<{ path: string; title: string; markdown: string }> {
		const resolved = await this.noteResolver.resolveForNoteCard(config);
		return {
			path: resolved.file.path,
			title: resolved.title,
			markdown: resolved.markdown
		};
	}

	async renderMarkdown(markdown: string, containerEl: HTMLElement, sourcePath: string, component: Component): Promise<void> {
		await this.markdownRenderService.renderMarkdown(markdown, containerEl, sourcePath, component);
	}

	search(query: string, config: ScreenCard<"search">["config"]) {
		return this.searchService.search(query, config);
	}

	async rollRandom(config: ScreenCard<"random">["config"]) {
		return this.generatorService.roll(config);
	}

	async detectGenerator(config: ScreenCard<"random">["config"]) {
		return this.generatorService.detectGenerator(config);
	}

	async resolveGeneratorType(config: ScreenCard<"random">["config"]) {
		return this.generatorService.resolveGeneratorType(config);
	}

	async detectAvailableTypes(config: ScreenCard<"random">["config"]) {
		return this.generatorService.detectAvailableTypes(config);
	}

	async getTableColumns(config: ScreenCard<"random">["config"]): Promise<string[]> {
		return this.generatorService.getTableColumns(config);
	}

	async openFileInLeaf(path: string, heading?: string): Promise<void> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(normalized);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${path}`);
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(file, heading ? { eState: { subpath: `#${heading}` } } : undefined);
	}

	pinSearchResultAsNoteCard(path: string, heading?: string): void {
		this.addCard("note", {
			source: heading ? `${path}#${heading}` : path,
			showTitle: true,
			compact: false
		});
	}

	getApp(): App {
		return this.app;
	}

	listMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	listFolders(): string[] {
		const folderSet = new Set<string>();
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder) {
				folderSet.add(file.path);
			}
		}
		return Array.from(folderSet).sort((a, b) => a.localeCompare(b));
	}

	getActiveLayout(): ScreenLayout | null {
		return this.layoutStore.getLayout();
	}

	handleVaultFileChanged(file: TAbstractFile): void {
		try {
			this.searchService.onVaultFileChanged(file);
		} catch (error) {
			new Notice(`GM Screen index update failed: ${asErrorMessage(error)}`);
		}
	}

	private uniqueScreenId(name: string): string {
		const slug =
			name
				.trim()
				.toLocaleLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || "screen";
		const existing = this.settingsService.get().screens;
		if (!existing[slug]) {
			return slug;
		}
		let candidate = slug;
		let suffix = 2;
		while (existing[candidate]) {
			candidate = `${slug}-${suffix}`;
			suffix += 1;
		}
		return candidate;
	}

	private getNextRow(layout: ScreenLayout): number {
		if (layout.cards.length === 0) {
			return 0;
		}
		return layout.cards.reduce((max, card) => Math.max(max, card.y + card.h), 0);
	}
}
