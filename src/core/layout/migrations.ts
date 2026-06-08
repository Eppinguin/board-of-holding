import type { ScreenLayout } from "../cards/card-types";
import { parseScreenLayout } from "./layout-schema";

export const LAYOUT_SCHEMA_VERSION = 1;

export function migrateLayout(raw: unknown): ScreenLayout {
	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid layout payload");
	}

	const withVersion = raw as { version?: number };
	const version = withVersion.version ?? 1;

	if (version > LAYOUT_SCHEMA_VERSION) {
		throw new Error(`Unsupported layout version: ${version}`);
	}

	// v1 is current schema, but this switch keeps migrations explicit.
	switch (version) {
		case 1:
			return parseScreenLayout(raw);
		default:
			throw new Error(`Unknown layout version: ${version}`);
	}
}
