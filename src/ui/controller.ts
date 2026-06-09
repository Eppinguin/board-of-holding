import type { Component, TFile } from "obsidian";
import type { CardRegistry } from "../core/cards/CardRegistry";
import type {
	CardConfigMap,
	CardType,
	NoteCardConfig,
	RandomCardConfig,
	ScreenLayout,
	SearchCardConfig
} from "../core/cards/card-types";
import type { LayoutStore } from "../core/layout/layout-store";
import type { SearchResult } from "../core/search/SearchTypes";
import type { RollResult } from "../core/random/GeneratorService";

export type GMScreenController = {
	cardRegistry: CardRegistry;
	layoutStore: LayoutStore;
	loadInitialLayout: () => Promise<void>;
	saveLayout: () => Promise<void>;
	createScreen: (name?: string) => Promise<void>;
	openScreen: (id: string) => Promise<void>;
	listScreens: () => Promise<{ id: string; name: string; path: string }[]>;
	addCard: <TType extends CardType>(type: TType, config?: Partial<CardConfigMap[TType]>) => void;
	removeCard: (cardId: string) => void;
	updateCardConfig: <TType extends CardType>(cardId: string, type: TType, config: unknown) => void;
	updateCardPosition: (cardId: string, x: number, y: number, w: number, h: number) => void;
	resolveNoteCard: (config: NoteCardConfig) => Promise<{ path: string; title: string; markdown: string }>;
	renderMarkdown: (markdown: string, containerEl: HTMLElement, sourcePath: string, component: Component) => Promise<void>;
	search: (query: string, config: SearchCardConfig) => SearchResult[];
	rollRandom: (config: RandomCardConfig) => Promise<RollResult>;
	detectGenerator: (config: RandomCardConfig) => Promise<import("../core/cards/card-types").RandomGeneratorType>;
	resolveGeneratorType: (config: RandomCardConfig) => Promise<import("../core/cards/card-types").RandomGeneratorType>;
	detectAvailableTypes: (config: RandomCardConfig) => Promise<import("../core/cards/card-types").RandomGeneratorType[]>;
	getTableColumns: (config: RandomCardConfig) => Promise<string[]>;
	openFileInLeaf: (path: string, heading?: string) => Promise<void>;
	pinSearchResultAsNoteCard: (path: string, heading?: string) => void;
	getApp: () => import("obsidian").App;
	listMarkdownFiles: () => TFile[];
	listFolders: () => string[];
	getActiveLayout: () => ScreenLayout | null;
	getLayoutFolder: () => string;
};
