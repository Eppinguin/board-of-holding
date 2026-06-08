export type CardType = "note" | "search" | "random" | "webEmbed";

export type NoteCardConfig = {
	/** Note reference. May include a heading (`Note#Heading`) or block (`Note#^id`); the target is parsed from this. */
	source: string;
	showTitle: boolean;
	compact: boolean;
};

export type SearchCardConfig = {
	folders: string[];
	limit: number;
	showSnippets: boolean;
};

export type RandomGeneratorType = "list" | "table" | "sections" | "files";

/** null = auto-detect; a specific value overrides detection. */
export type RandomGeneratorTypeOverride = RandomGeneratorType | null;

/** For table sources: roll whole rows, or roll a value from a single column. */
export type RandomTableAxis = "rows" | "columns";

export type RandomCardConfig = {
	/** Display label shown above the roll button. Empty = derive from the detected source. */
	label: string;
	/** Note path / wikilink (optionally `#heading` / `#^block`), or a folder path. The generator is inferred from what this points at. */
	source: string;
	/** Folder path. Set when the source is a folder. */
	folder: string;
	/** How many results to draw per roll (1-20). */
	count: number;
	/** Keep previous results visible below the latest one. */
	showHistory: boolean;
	/** Show column headers above each cell value in table results. */
	showHeaders: boolean;
	/** Overrides auto-detection of the generator type. null = auto. */
	generatorType: RandomGeneratorTypeOverride;
	/** Table sources: roll entire rows, or a random value from one column. */
	tableAxis: RandomTableAxis;
	/**
	 * Table sources: restrict output to these column headers (empty = all).
	 * In "rows" mode these are the fields shown per row; in "columns" mode the
	 * columns eligible to be rolled.
	 */
	columns: string[];
};

export type WebEmbedCardConfig = {
	url: string;
	title?: string;
	allowScripts?: boolean;
};

export type CardConfigMap = {
	note: NoteCardConfig;
	search: SearchCardConfig;
	random: RandomCardConfig;
	webEmbed: WebEmbedCardConfig;
};

export type ScreenCard<TType extends CardType = CardType> = {
	id: string;
	type: TType;
	x: number;
	y: number;
	w: number;
	h: number;
	config: CardConfigMap[TType];
};

export type ScreenLayout = {
	version: number;
	id: string;
	name: string;
	cards: ScreenCard[];
};

export type CardDefinition<TConfig> = {
	type: CardType;
	name: string;
	defaultSize: { w: number; h: number };
	defaultConfig: TConfig;
	component: unknown;
	validateConfig: (value: unknown) => TConfig;
};
