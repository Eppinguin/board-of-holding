import { normalizePath, Notice, TFile, TFolder, type App, type Component, type TAbstractFile } from "obsidian";
import type { CardType, ScreenCard, ScreenLayout } from "../core/cards/card-types";
import { LayoutStore } from "../core/layout/layout-store";
import { SectionExtractor } from "../core/notes/SectionExtractor";
import { NoteResolver } from "../core/notes/NoteResolver";
import { MarkdownRenderService } from "../core/notes/MarkdownRenderService";
import { SearchService } from "../core/search/SearchService";
import { GeneratorService } from "../core/random/GeneratorService";
import { ScreenRepository } from "../core/storage/ScreenRepository";
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
	private readonly screenRepository: ScreenRepository;
	private readonly noteResolver: NoteResolver;
	private readonly markdownRenderService: MarkdownRenderService;
	private readonly searchService: SearchService;
	private readonly generatorService: GeneratorService;

	constructor(app: App, settingsService: SettingsService) {
		this.app = app;
		this.settingsService = settingsService;
		this.screenRepository = new ScreenRepository(app);
		const sectionExtractor = new SectionExtractor();
		this.noteResolver = new NoteResolver(app, sectionExtractor);
		this.markdownRenderService = new MarkdownRenderService(app);
		this.searchService = new SearchService(app, {
			preferredFolders: settingsService.get().preferredSearchFolders,
			penalizedFolders: settingsService.get().archiveFolders
		});
		this.generatorService = new GeneratorService(app, this.noteResolver, sectionExtractor);
	}

	async loadInitialLayout(): Promise<void> {
		const settings = this.settingsService.get();
		await this.screenRepository.ensureLayoutFolder(settings.layoutFolder);

		if (settings.lastOpenedScreenId) {
			const existing = await this.screenRepository.loadLayoutById(settings.layoutFolder, settings.lastOpenedScreenId);
			if (existing) {
				this.layoutStore.setLayout(existing);
				await this.searchService.rebuildIndex(settings.searchFolders);
				return;
			}
		}

		const layouts = await this.screenRepository.listLayouts(settings.layoutFolder);
		const firstLayoutMeta = layouts[0];
		if (firstLayoutMeta) {
			const firstLayout = await this.screenRepository.loadLayoutById(settings.layoutFolder, firstLayoutMeta.id);
			if (firstLayout) {
				this.layoutStore.setLayout(firstLayout);
				await this.settingsService.update({ lastOpenedScreenId: firstLayout.id });
				await this.searchService.rebuildIndex(settings.searchFolders);
				return;
			}
		}

		await this.createScreen("GM Screen");
		await this.searchService.rebuildIndex(settings.searchFolders);
	}

	async saveLayout(): Promise<void> {
		const layout = this.layoutStore.getLayout();
		if (!layout) {
			return;
		}
		const folder = this.settingsService.get().layoutFolder;
		await this.screenRepository.saveLayout(folder, layout);
		await this.settingsService.update({ lastOpenedScreenId: layout.id });
	}

	async createScreen(name = "GM Screen"): Promise<void> {
		const safeName = name.trim() || "GM Screen";
		const id = this.slugifyName(safeName);
		const layout = this.screenRepository.createEmptyLayout(safeName, id);
		this.layoutStore.setLayout(layout);
		await this.saveLayout();
	}

	async openScreen(id: string): Promise<void> {
		const folder = this.settingsService.get().layoutFolder;
		const layout = await this.screenRepository.loadLayoutById(folder, id);
		if (!layout) {
			throw new Error(`Screen not found: ${id}`);
		}
		this.layoutStore.setLayout(layout);
		await this.settingsService.update({ lastOpenedScreenId: id });
	}

	async listScreens(): Promise<{ id: string; name: string; path: string }[]> {
		return this.screenRepository.listLayouts(this.settingsService.get().layoutFolder);
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

	getLayoutFolder(): string {
		return this.settingsService.get().layoutFolder;
	}

	handleVaultFileChanged(file: TAbstractFile): void {
		try {
			this.searchService.onVaultFileChanged(file, this.settingsService.get().searchFolders);
		} catch (error) {
			new Notice(`GM Screen index update failed: ${asErrorMessage(error)}`);
		}
	}

	private slugifyName(name: string): string {
		const slug = name
			.trim()
			.toLocaleLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
		return slug || createId("screen");
	}

	private getNextRow(layout: ScreenLayout): number {
		if (layout.cards.length === 0) {
			return 0;
		}
		return layout.cards.reduce((max, card) => Math.max(max, card.y + card.h), 0);
	}
}
