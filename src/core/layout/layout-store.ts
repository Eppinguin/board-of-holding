import type { ScreenCard, ScreenLayout } from "../cards/card-types";

export type LayoutSubscriber = (layout: ScreenLayout | null) => void;

export class LayoutStore {
	private activeLayout: ScreenLayout | null = null;
	private readonly subscribers = new Set<LayoutSubscriber>();

	subscribe(subscriber: LayoutSubscriber): () => void {
		this.subscribers.add(subscriber);
		subscriber(this.activeLayout);
		return () => {
			this.subscribers.delete(subscriber);
		};
	}

	getLayout(): ScreenLayout | null {
		return this.activeLayout;
	}

	setLayout(layout: ScreenLayout): void {
		this.activeLayout = {
			...layout,
			cards: [...layout.cards]
		};
		this.emit();
	}

	updateLayout(updater: (layout: ScreenLayout) => ScreenLayout): void {
		if (!this.activeLayout) {
			return;
		}
		this.activeLayout = updater(this.activeLayout);
		this.emit();
	}

	addCard(card: ScreenCard): void {
		if (!this.activeLayout) {
			return;
		}
		this.activeLayout = {
			...this.activeLayout,
			cards: [...this.activeLayout.cards, card]
		};
		this.emit();
	}

	removeCard(cardId: string): void {
		if (!this.activeLayout) {
			return;
		}
		this.activeLayout = {
			...this.activeLayout,
			cards: this.activeLayout.cards.filter((card) => card.id !== cardId)
		};
		this.emit();
	}

	updateCard(cardId: string, updater: (card: ScreenCard) => ScreenCard): void {
		if (!this.activeLayout) {
			return;
		}
		this.activeLayout = {
			...this.activeLayout,
			cards: this.activeLayout.cards.map((card) => (card.id === cardId ? updater(card) : card))
		};
		this.emit();
	}

	updateCardPosition(cardId: string, x: number, y: number, w: number, h: number): void {
		this.updateCard(cardId, (card) => ({ ...card, x, y, w, h }));
	}

	private emit(): void {
		for (const subscriber of this.subscribers) {
			subscriber(this.activeLayout);
		}
	}
}
