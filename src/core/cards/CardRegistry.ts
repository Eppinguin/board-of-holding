import type { CardConfigMap, CardDefinition, CardType } from "./card-types";

export class CardRegistry {
	private readonly definitions = new Map<CardType, CardDefinition<CardConfigMap[CardType]>>();

	register<TType extends CardType>(
		definition: CardDefinition<CardConfigMap[TType]> & { type: TType }
	): void {
		if (this.definitions.has(definition.type)) {
			throw new Error(`Card type already registered: ${definition.type}`);
		}
		this.definitions.set(definition.type, definition as CardDefinition<CardConfigMap[CardType]>);
	}

	get<TType extends CardType>(type: TType): CardDefinition<CardConfigMap[TType]> {
		const definition = this.definitions.get(type);
		if (!definition) {
			throw new Error(`Unknown card type: ${type}`);
		}
		return definition as CardDefinition<CardConfigMap[TType]>;
	}

	list(): CardDefinition<CardConfigMap[CardType]>[] {
		return Array.from(this.definitions.values());
	}

	isRegistered(type: CardType): boolean {
		return this.definitions.has(type);
	}

	validateConfig<TType extends CardType>(type: TType, value: unknown): CardConfigMap[TType] {
		return this.get(type).validateConfig(value);
	}
}
