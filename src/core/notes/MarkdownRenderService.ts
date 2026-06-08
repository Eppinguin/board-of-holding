import { Component, MarkdownRenderer, type App } from "obsidian";

export class MarkdownRenderService {
	private readonly app: App;

	constructor(app: App) {
		this.app = app;
	}

	async renderMarkdown(
		markdown: string,
		containerEl: HTMLElement,
		sourcePath: string,
		component: Component
	): Promise<void> {
		containerEl.empty();
		await MarkdownRenderer.render(this.app, markdown, containerEl, sourcePath, component);
	}
}
