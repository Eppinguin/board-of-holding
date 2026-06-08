import { z } from "zod";
import type {
	CardConfigMap,
	CardType,
	NoteCardConfig,
	RandomCardConfig,
	SearchCardConfig,
	WebEmbedCardConfig
} from "./card-types";

export const noteCardConfigSchema = z.object({
	source: z.string().default(""),
	showTitle: z.boolean().default(true),
	compact: z.boolean().default(false)
});

export const searchCardConfigSchema = z.object({
	folders: z.array(z.string()).default([]),
	limit: z.number().int().min(1).max(200).default(20),
	showSnippets: z.boolean().default(true)
});

export const randomCardConfigSchema = z.object({
	label: z.string().default(""),
	source: z.string().default(""),
	folder: z.string().default(""),
	count: z.number().int().min(1).max(20).default(1),
	showHistory: z.boolean().default(true),
	showHeaders: z.boolean().default(true),
	generatorType: z.enum(["list", "table", "sections", "files"]).nullable().default(null),
	tableAxis: z.enum(["rows", "columns"]).default("rows"),
	columns: z.array(z.string()).default([])
});

export const webEmbedCardConfigSchema = z.object({
	url: z.string().default(""),
	title: z.string().optional(),
	allowScripts: z.boolean().default(false)
});

export const cardConfigSchemas: { [K in CardType]: z.ZodType<CardConfigMap[K]> } = {
	note: noteCardConfigSchema,
	search: searchCardConfigSchema,
	random: randomCardConfigSchema,
	webEmbed: webEmbedCardConfigSchema
};

export function parseCardConfig<TType extends CardType>(type: TType, value: unknown): CardConfigMap[TType] {
	return cardConfigSchemas[type].parse(value);
}

export function parseNoteCardConfig(value: unknown): NoteCardConfig {
	return noteCardConfigSchema.parse(value);
}

export function parseSearchCardConfig(value: unknown): SearchCardConfig {
	return searchCardConfigSchema.parse(value);
}

export function parseRandomCardConfig(value: unknown): RandomCardConfig {
	return randomCardConfigSchema.parse(value);
}

export function parseWebEmbedCardConfig(value: unknown): WebEmbedCardConfig {
	return webEmbedCardConfigSchema.parse(value);
}
