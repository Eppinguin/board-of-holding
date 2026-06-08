import { CardRegistry } from "../core/cards/CardRegistry";
import {
	parseNoteCardConfig,
	parseRandomCardConfig,
	parseSearchCardConfig,
	parseWebEmbedCardConfig
} from "../core/cards/card-config-schemas";
import NoteCard from "../ui/cards/NoteCard.svelte";
import SearchCard from "../ui/cards/SearchCard.svelte";
import RandomCard from "../ui/cards/RandomCard.svelte";
import WebEmbedCard from "../ui/cards/WebEmbedCard.svelte";

export function createCardRegistry(): CardRegistry {
	const registry = new CardRegistry();

	registry.register({
		type: "note",
		name: "Note Display",
		defaultSize: { w: 5, h: 5 },
		defaultConfig: {
			source: "",
			showTitle: true,
			compact: false
		},
		component: NoteCard,
		validateConfig: parseNoteCardConfig
	});

	registry.register({
		type: "search",
		name: "Search",
		defaultSize: { w: 6, h: 6 },
		defaultConfig: {
			folders: [],
			limit: 20,
			showSnippets: true
		},
		component: SearchCard,
		validateConfig: parseSearchCardConfig
	});

	registry.register({
		type: "random",
		name: "Random Generator",
		defaultSize: { w: 4, h: 5 },
		defaultConfig: {
			label: "",
			source: "",
			folder: "",
			count: 1,
			showHistory: true,
			showHeaders: true,
			generatorType: null,
			tableAxis: "rows",
			columns: []
		},
		component: RandomCard,
		validateConfig: parseRandomCardConfig
	});

	registry.register({
		type: "webEmbed",
		name: "Web Embed",
		defaultSize: { w: 6, h: 6 },
		defaultConfig: {
			url: "",
			title: "",
			allowScripts: false
		},
		component: WebEmbedCard,
		validateConfig: parseWebEmbedCardConfig
	});

	return registry;
}
