import { z } from "zod";
import {
	noteCardConfigSchema,
	randomCardConfigSchema,
	searchCardConfigSchema,
	webEmbedCardConfigSchema
} from "../cards/card-config-schemas";
import type { ScreenLayout } from "../cards/card-types";

const numericGridCoord = z.number().int().min(0);
const gridSize = z.number().int().min(1);

const noteCardSchema = z.object({
	id: z.string().min(1),
	type: z.literal("note"),
	x: numericGridCoord,
	y: numericGridCoord,
	w: gridSize,
	h: gridSize,
	config: noteCardConfigSchema
});

const searchCardSchema = z.object({
	id: z.string().min(1),
	type: z.literal("search"),
	x: numericGridCoord,
	y: numericGridCoord,
	w: gridSize,
	h: gridSize,
	config: searchCardConfigSchema
});

const randomCardSchema = z.object({
	id: z.string().min(1),
	type: z.literal("random"),
	x: numericGridCoord,
	y: numericGridCoord,
	w: gridSize,
	h: gridSize,
	config: randomCardConfigSchema
});

const webEmbedCardSchema = z.object({
	id: z.string().min(1),
	type: z.literal("webEmbed"),
	x: numericGridCoord,
	y: numericGridCoord,
	w: gridSize,
	h: gridSize,
	config: webEmbedCardConfigSchema
});

export const screenCardSchema = z.discriminatedUnion("type", [
	noteCardSchema,
	searchCardSchema,
	randomCardSchema,
	webEmbedCardSchema
]);

export const screenLayoutSchema = z.object({
	version: z.number().int().min(1),
	id: z.string().min(1),
	name: z.string().min(1),
	cards: z.array(screenCardSchema)
});

export function parseScreenLayout(value: unknown): ScreenLayout {
	return screenLayoutSchema.parse(value);
}
