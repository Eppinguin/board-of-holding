import { describe, expect, it } from "vitest";
import { CardRegistry } from "../src/core/cards/CardRegistry";

describe("CardRegistry", () => {
	it("registers and fetches cards", () => {
		const registry = new CardRegistry();
		registry.register({
			type: "note",
			name: "Note",
			defaultSize: { w: 4, h: 4 },
			defaultConfig: { source: "", showTitle: true, compact: false },
			component: {},
			validateConfig: (value) => value as never
		});
		expect(registry.get("note").name).toBe("Note");
	});

	it("prevents duplicate registration", () => {
		const registry = new CardRegistry();
		const definition = {
			type: "search" as const,
			name: "Search",
			defaultSize: { w: 4, h: 4 },
			defaultConfig: { folders: [], limit: 10, showSnippets: true },
			component: {},
			validateConfig: (value: unknown) => value as never
		};
		registry.register(definition);
		expect(() => registry.register(definition)).toThrow();
	});
});
