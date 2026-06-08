import { GridStack, type GridStackNode } from "gridstack";
import type { ScreenCard } from "../cards/card-types";

export type LayoutChange = {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
};

export class GridLayoutAdapter {
	private readonly container: HTMLElement;
	private readonly onLayoutChange: (changes: LayoutChange[]) => void;
	private readonly widgetElements = new Map<string, HTMLElement>();
	private grid: GridStack | null = null;
	private isSyncing = false;
	private isLocked = false;

	constructor(container: HTMLElement, onLayoutChange: (changes: LayoutChange[]) => void) {
		this.container = container;
		this.onLayoutChange = onLayoutChange;
	}

	init(): void {
		if (this.grid) {
			return;
		}

		this.grid = GridStack.init(
			{
				float: true,
				margin: 8,
				column: 12,
				cellHeight: 90,
				cellHeightThrottle: 100,
				minRow: 1,
				disableDrag: this.isLocked,
				disableResize: this.isLocked,
				columnOpts: {
					breakpoints: [
						{ w: 700, c: 6 },
						{ w: 480, c: 2 },
						{ w: 320, c: 1 }
					],
					layout: "moveScale"
				}
			},
			this.container
		);

		this.grid.on("change", (_event: Event, items: GridStackNode[]) => {
			if (this.isSyncing || !items.length) {
				return;
			}
			const changes: LayoutChange[] = [];
			for (const item of items) {
				if (!item.id) {
					continue;
				}
				changes.push({
					id: item.id,
					x: item.x ?? 0,
					y: item.y ?? 0,
					w: item.w ?? 1,
					h: item.h ?? 1
				});
			}
			if (changes.length > 0) {
				this.onLayoutChange(changes);
			}
		});
	}

	sync(cards: ScreenCard[]): void {
		if (!this.grid) {
			return;
		}

		this.isSyncing = true;
		const desiredIds = new Set(cards.map((card) => card.id));

		for (const [cardId, widgetElement] of this.widgetElements.entries()) {
			if (!desiredIds.has(cardId)) {
				this.grid.removeWidget(widgetElement);
				this.widgetElements.delete(cardId);
			}
		}

		for (const card of cards) {
			const element = this.container.querySelector<HTMLElement>(`.grid-stack-item[data-card-id="${card.id}"]`);
			if (!element) {
				continue;
			}

			// GridStack sets el.gridstackNode on widgets it has already initialised
			const alreadyManaged = this.widgetElements.has(card.id) || (element as any).gridstackNode;

			if (!alreadyManaged) {
				this.grid.makeWidget(element, {
					id: card.id,
					x: card.x,
					y: card.y,
					w: card.w,
					h: card.h,
					minW: 1,
					minH: 2,
					noMove: this.isLocked,
					noResize: this.isLocked
				});
			} else {
				this.grid.update(element, {
					id: card.id,
					x: card.x,
					y: card.y,
					w: card.w,
					h: card.h,
					minW: 1,
					minH: 2
				});
			}
			this.widgetElements.set(card.id, element);
		}

		this.isSyncing = false;
	}

	setLocked(locked: boolean): void {
		this.isLocked = locked;
		if (!this.grid) {
			return;
		}
		if (locked) {
			this.grid.disable();
		} else {
			this.grid.enable();
		}
	}

	destroy(): void {
		if (!this.grid) {
			return;
		}
		this.grid.destroy(false);
		this.grid = null;
		this.widgetElements.clear();
	}
}
