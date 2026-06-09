import { type App, type TAbstractFile, TFile } from "obsidian";
import type { SearchCardConfig } from "../cards/card-types";
import { MiniSearchProvider } from "./MiniSearchProvider";
import { SearchIndexBuilder } from "./SearchIndexBuilder";
import { createSnippet } from "./SnippetGenerator";
import type { SearchDocument, SearchResult } from "./SearchTypes";
import { rerankCandidates } from "./rerank";

export class SearchService {
	private readonly app: App;
	private readonly indexBuilder: SearchIndexBuilder;
	private readonly miniSearch: MiniSearchProvider;
	private indexedDocs: SearchDocument[] = [];
	private rebuildTimer: number | null = null;
	private isIndexing = false;

	constructor(app: App) {
		this.app = app;
		this.indexBuilder = new SearchIndexBuilder(app);
		this.miniSearch = new MiniSearchProvider();
	}

	getIndexState(): { isIndexing: boolean; totalDocs: number } {
		return {
			isIndexing: this.isIndexing,
			totalDocs: this.indexedDocs.length
		};
	}

	async rebuildIndex(): Promise<void> {
		this.isIndexing = true;
		try {
			this.indexedDocs = await this.indexBuilder.build([]);
			this.miniSearch.rebuild(this.indexedDocs);
		} finally {
			this.isIndexing = false;
		}
	}

	scheduleRebuild(delayMs = 500): void {
		if (this.rebuildTimer) {
			clearTimeout(this.rebuildTimer);
		}
		this.rebuildTimer = window.setTimeout(() => {
			void this.rebuildIndex();
			this.rebuildTimer = null;
		}, delayMs);
	}

	onVaultFileChanged(file: TAbstractFile): void {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return;
		}
		this.scheduleRebuild();
	}

	search(query: string, config: SearchCardConfig): SearchResult[] {
		const limit = Math.max(1, config.limit);
		const candidates = this.miniSearch.search(query, limit);
		const folderFiltered = candidates.filter((candidate) => this.isCandidateIncluded(candidate.doc, config));

		const reranked = rerankCandidates(query, folderFiltered, {}).slice(0, limit);

		return reranked.map((candidate) => ({
			doc: candidate.doc,
			score: candidate.score,
			snippet: config.showSnippets ? createSnippet(candidate.doc.body, query) : ""
		}));
	}

	private isCandidateIncluded(doc: SearchDocument, config: SearchCardConfig): boolean {
		const normalizedFolders = config.folders.map((folder) => folder.toLocaleLowerCase());

		if (normalizedFolders.length === 0) {
			return true;
		}

		const candidatePath = doc.filePath.toLocaleLowerCase();
		return normalizedFolders.some((folder) => candidatePath === folder || candidatePath.startsWith(`${folder}/`));
	}
}
