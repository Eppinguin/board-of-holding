export class SectionExtractor {
	extractFullNote(markdown: string): string {
		return markdown.trim();
	}

	extractHeadingSection(markdown: string, heading: string): string | null {
		const lines = markdown.split("\n");
		const path = this.normalizeHeadingPath(heading);
		if (path.length === 0) {
			return null;
		}

		let startLine = -1;
		let targetLevel = 0;
		const stack: string[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) {
				continue;
			}
			const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
			if (!headingMatch) {
				continue;
			}

			const levelToken = headingMatch[1];
			const textToken = headingMatch[2];
			if (!levelToken || textToken === undefined) {
				continue;
			}
			const level = levelToken.length;
			const text = textToken.trim();

			stack.splice(level - 1);
			stack[level - 1] = text;

			if (this.matchHeadingPath(stack, path)) {
				startLine = i;
				targetLevel = level;
				break;
			}
		}

		if (startLine === -1) {
			return null;
		}

		let endLine = lines.length;
		for (let i = startLine + 1; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) {
				continue;
			}
			const headingMatch = /^(#{1,6})\s+/.exec(line);
			if (!headingMatch) {
				continue;
			}
			const levelToken = headingMatch[1];
			if (!levelToken) {
				continue;
			}
			const level = levelToken.length;
			if (level <= targetLevel) {
				endLine = i;
				break;
			}
		}

		return lines.slice(startLine, endLine).join("\n").trim();
	}

	extractBlock(markdown: string, blockId: string): string | null {
		const lines = markdown.split("\n");
		const normalizedBlockId = blockId.trim().replace(/^\^/, "");
		if (!normalizedBlockId) {
			return null;
		}

		const blockPattern = new RegExp(`\\^${this.escapeRegExp(normalizedBlockId)}\\s*$`);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined || !blockPattern.test(line)) {
				continue;
			}

			const start = this.findBlockStart(lines, i);
			const end = this.findBlockEnd(lines, i);
			return lines.slice(start, end).join("\n").trim();
		}

		return null;
	}

	private normalizeHeadingPath(heading: string): string[] {
		return heading
			.split(">")
			.map((value) => value.trim())
			.filter((value) => value.length > 0);
	}

	private matchHeadingPath(current: string[], target: string[]): boolean {
		if (current.length < target.length) {
			return false;
		}

		if (target.length === 1) {
			const leaf = current[current.length - 1];
			const targetLeaf = target[0];
			return leaf !== undefined && targetLeaf !== undefined && leaf.toLocaleLowerCase() === targetLeaf.toLocaleLowerCase();
		}

		for (let i = 0; i < target.length; i++) {
			const currentPart = current[i];
			const targetPart = target[i];
			if (currentPart === undefined || targetPart === undefined || currentPart.toLocaleLowerCase() !== targetPart.toLocaleLowerCase()) {
				return false;
			}
		}

		return true;
	}

	private findBlockStart(lines: string[], matchLine: number): number {
		for (let i = matchLine; i >= 0; i--) {
			const line = lines[i];
			if (line === undefined) {
				continue;
			}
			if (i !== matchLine && line.trim() === "") {
				return i + 1;
			}
		}
		return 0;
	}

	private findBlockEnd(lines: string[], matchLine: number): number {
		for (let i = matchLine + 1; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) {
				continue;
			}
			if (line.trim() === "") {
				return i;
			}
		}
		return lines.length;
	}

	private escapeRegExp(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
}
