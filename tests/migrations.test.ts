import { describe, expect, it } from "vitest";
import { migrateLayout } from "../src/core/layout/migrations";

describe("layout migrations", () => {
	it("accepts v1 layouts", () => {
		const migrated = migrateLayout({
			version: 1,
			id: "screen",
			name: "Screen",
			cards: []
		});
		expect(migrated.version).toBe(1);
	});

	it("rejects future versions", () => {
		expect(() => migrateLayout({ version: 99, id: "x", name: "X", cards: [] })).toThrow();
	});
});
