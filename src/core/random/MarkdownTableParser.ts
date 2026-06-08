export type ParsedTable = {
	headers: string[];
	rows: string[][];
};

export class MarkdownTableParser {
	parseAll(markdown: string): ParsedTable[] {
		const lines = markdown.split("\n");
		const tables: ParsedTable[] = [];

		for (let i = 0; i < lines.length - 2; i++) {
			const headerCandidate = lines[i];
			const separatorCandidate = lines[i + 1];
			if (headerCandidate === undefined || separatorCandidate === undefined) {
				continue;
			}
			const headerLine = headerCandidate.trim();
			const separatorLine = separatorCandidate.trim();

			if (!this.looksLikeTableHeader(headerLine) || !this.looksLikeSeparator(separatorLine)) {
				continue;
			}

			let headers = this.splitRow(headerLine);
			const rows: string[][] = [];
			let cursor = i + 2;

			while (cursor < lines.length) {
				const rowLine = lines[cursor];
				if (rowLine === undefined || !this.looksLikeTableRow(rowLine)) {
					break;
				}
				const cells = this.splitRow(rowLine);
				// Pad or trim to header count so indices always align
				const aligned = headers.map((_, idx) => cells[idx] ?? "");
				rows.push(aligned);
				cursor += 1;
			}

			// Some tables leave the header row blank and put real column names in
			// the first body row. Promote it so cells get meaningful labels.
			if (rows.length > 1 && headers.every((h) => h === "")) {
				headers = rows.shift()!;
			}

			if (rows.length > 0) {
				tables.push({ headers, rows });
				i = cursor - 1;
			}
		}

		return tables;
	}

	parseFirst(markdown: string): ParsedTable | null {
		return this.parseAll(markdown)[0] ?? null;
	}

	private splitRow(row: string): string[] {
		// Strip optional leading/trailing pipes then split on remaining pipes
		const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
		return trimmed.split("|").map((cell) => this.cleanCell(cell));
	}

	private cleanCell(cell: string): string {
		return cell
			.trim()
			// strip bold/italic markdown markers
			.replace(/\*\*(.+?)\*\*/g, "$1")
			.replace(/\*(.+?)\*/g, "$1")
			.replace(/__(.+?)__/g, "$1")
			.replace(/_(.+?)_/g, "$1")
			.trim();
	}

	private looksLikeTableHeader(line: string): boolean {
		return line.includes("|");
	}

	private looksLikeSeparator(line: string): boolean {
		if (!line.includes("|")) {
			return false;
		}
		const cells = this.splitRow(line);
		return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell));
	}

	private looksLikeTableRow(line: string): boolean {
		// Any line containing a pipe that isn't a separator qualifies
		const trimmed = line.trim();
		return trimmed.includes("|") && !this.looksLikeSeparator(trimmed);
	}
}
