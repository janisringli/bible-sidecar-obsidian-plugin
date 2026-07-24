import { ItemView, WorkspaceLeaf, requestUrl, Notice, Platform } from "obsidian";

export const BibleViewType = "bible-view";

export type BibleProvider = "bolls" | "helloao";

export interface BibleProviderRoute {
	provider: BibleProvider;
	translationId: string;
}

interface BibleSidecarSettings {
	bibleVersion: string;
	copyFormat: string;
	copyVerseReference: boolean;
	verseReferenceStyle: string;
	verseReferenceFormat: string;
	verseReferenceInternalLinking: boolean;
	verseReferenceInternalLinkingFormat: string;
	bibleLanguage: string;
	showFootnotes: boolean;
}

interface BibleBook {
	id: number | string;
	code?: string;
	name: string;
	chapters: number;
	order: number;
}

interface BollsBook {
	bookid: number;
	name: string;
	chapters: number;
}

interface BollsVerse {
	verse: string;
	text: string;
}

interface HelloAOBook {
	id: string;
	name: string;
	numberOfChapters: number;
	order: number;
}

interface HelloAOBooksResponse {
	books: HelloAOBook[];
}

type HelloAOInlineContent =
	| string
	| { lineBreak: true }
	| { noteId: number }
	| { text: string; poem?: number; wordsOfJesus?: boolean };

interface HelloAOHeading {
	type: "heading";
	content: HelloAOInlineContent[];
}

interface HelloAOLineBreak {
	type: "line_break";
}

interface HelloAOHebrewSubtitle {
	type: "hebrew_subtitle";
	content: HelloAOInlineContent[];
}

interface HelloAOVerse {
	type: "verse";
	number: number;
	content: HelloAOInlineContent[];
}

interface HelloAOFootnote {
	noteId: number;
	caller: string;
	text: string;
}

interface HelloAOChapter {
	chapter: {
		content: Array<HelloAOHeading | HelloAOLineBreak | HelloAOHebrewSubtitle | HelloAOVerse>;
		footnotes?: HelloAOFootnote[];
	};
}

interface SelectedVerse {
	verse: number;
	text: string;
}

interface HelloAOFootnoteRenderContext {
	footnotes: Map<number, HelloAOFootnote>;
	footnoteNumbers: Map<number, number>;
	usedFootnotes: HelloAOFootnote[];
	showFootnotes: boolean;
}

const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "NLT",
	copyFormat: "plain",
	copyVerseReference: false,
	verseReferenceStyle: "- ",
	verseReferenceFormat: "full",
	verseReferenceInternalLinking: false,
	showFootnotes: false,
	bibleLanguage: "en",
};

export class BibleView extends ItemView {
	settings: BibleSidecarSettings;
	backButton: HTMLElement;
	previousButton: HTMLElement;
	nextButton: HTMLElement;
	private providerResolver: (language: string, version: string) => BibleProviderRoute = (
		_language,
		version
	) => ({ provider: "bolls", translationId: version });

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return BibleViewType;
	}

	getDisplayText(): string {
		return "Bible Sidecar";
	}

	getIcon(): string {
		return "book-open-text";
	}

	public load(): void {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, this.settings);
		super.load();
	}

	public setProviderResolver(
		resolver: (language: string, version: string) => BibleProviderRoute
	): void {
		this.providerResolver = resolver;
	}

	public updateSettings(newSettings: BibleSidecarSettings): void {
		this.settings = newSettings;
		void this.loadBible();
	}

	async onOpen(): Promise<void> {
		await this.loadBible();
	}

	async loadBible(): Promise<void> {
		const books = await this.generateBibleBooks();
		this.renderBooks(books);
	}

	async generateBibleBooks(): Promise<BibleBook[]> {
		const route = this.resolveProviderRoute();
		if (route.provider === "helloao") {
			const response = await requestUrl(
				`https://bible.helloao.org/api/${encodeURIComponent(route.translationId)}/books.json`
			);
			const payload: HelloAOBooksResponse = response.json;
			return payload.books.map((book) => ({
				id: book.id,
				code: book.id,
				name: book.name,
				chapters: book.numberOfChapters,
				order: book.order,
			}));
		}

		const response = await requestUrl(
			`https://bolls.life/get-books/${encodeURIComponent(route.translationId)}`
		);
		const books: BollsBook[] = response.json;
		return books.map((book) => ({
			id: book.bookid,
			name: book.name,
			chapters: book.chapters,
			order: book.bookid,
		}));
	}

	async getChapterContent(book: BibleBook, chapter: number): Promise<BollsVerse[] | HelloAOChapter> {
		const route = this.resolveProviderRoute();
		if (route.provider === "helloao") {
			if (!book.code) {
				throw new Error("HelloAO book is missing its provider book code.");
			}
			const response = await requestUrl(
				`https://bible.helloao.org/api/${encodeURIComponent(route.translationId)}/${encodeURIComponent(book.code)}/${chapter}.json`
			);
			const payload: HelloAOChapter = response.json;
			return payload;
		}

		if (typeof book.id !== "number") {
			throw new Error("Bolls book is missing its numeric book ID.");
		}
		const response = await requestUrl(
			`https://bolls.life/get-chapter/${encodeURIComponent(route.translationId)}/${book.id}/${chapter}`
		);
		const payload: BollsVerse[] = response.json;
		return payload;
	}

	private resolveProviderRoute(): BibleProviderRoute {
		return this.providerResolver(this.settings.bibleLanguage, this.settings.bibleVersion);
	}

	convertToSuperscript(number: string): string {
		const superscriptMap = {
			"0": "⁰",
			"1": "¹",
			"2": "²",
			"3": "³",
			"4": "⁴",
			"5": "⁵",
			"6": "⁶",
			"7": "⁷",
			"8": "⁸",
			"9": "⁹",
		};

		return String(number)
			.split("")
			.map((digit: keyof typeof superscriptMap) => superscriptMap[digit])
			.join("");
	}

	normalizeVerseText(verse: string): string {
		return verse
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?(?:i|b)>/gi, "")
			.replace(/<[^>]+>/g, "")
			.trimEnd();
	}

	appendVerseText(container: HTMLElement, verseText: string): void {
		const lines = this.normalizeVerseText(verseText).split("\n");
		lines.forEach((line, index) => {
			if (index > 0) {
				container.appendChild(document.createElement("br"));
			}
			container.appendChild(document.createTextNode(line));
		});
	}

	renderBooks(books: BibleBook[]): void {
		const { containerEl } = this;
		containerEl.empty();

		const chapterWrapper = containerEl.createEl("div", { cls: "bible-wrapper" });
		const chapterContainer = chapterWrapper.createEl("div", { cls: "chapter-container" });
		chapterContainer.createEl("div", { cls: "chapter-content" });

		for (const book of books) {
			if (book.order === 1) {
				chapterContainer.createEl("h4", {
					text: "Old Testament",
					cls: "book-divider",
				});
			}
			if (book.order === 40) {
				chapterContainer.createEl("hr", { cls: "book-divider" });
				chapterContainer.createEl("h4", {
					text: "New Testament",
					cls: "book-divider",
				});
			}
			chapterContainer
				.createEl("button", {
					text: book.name,
					attr: { id: String(book.id) },
				})
				.addEventListener("click", () => {
					void this.renderChapters(book, chapterContainer, books);
				});
		}
	}

	async renderChapters(
		book: BibleBook,
		chapterContainer: HTMLElement,
		books: BibleBook[]
	): Promise<void> {
		chapterContainer.empty();

		const header = chapterContainer.createDiv({ cls: "bible-header" });
		chapterContainer.createDiv({ cls: "controls-container" });
		this.backButton = header.createEl("button", {
			text: Platform.isMobileApp ? "Books" : "Back to books",
			cls: "back-button",
		});
		this.backButton.addEventListener("click", () => {
			void this.onOpen();
		});

		for (let chapter = 1; chapter <= book.chapters; chapter++) {
			chapterContainer
				.createEl("button", {
					text: chapter.toString(),
					cls: "chapter-button",
				})
				.addEventListener("click", () => {
					void this.openChapter(book, chapter, chapterContainer, books);
				});
		}
	}

	private async openChapter(
		book: BibleBook,
		chapter: number,
		chapterContainer: HTMLElement,
		books: BibleBook[]
	): Promise<void> {
		const content = await this.getChapterContent(book, chapter);
		chapterContainer.empty();
		this.processChapterContent(content, chapterContainer, book, chapter, books);
	}

	processChapterContent(
		chapter: BollsVerse[] | HelloAOChapter,
		chapterContainer: HTMLElement,
		book: BibleBook,
		chapterNumber: number,
		books: BibleBook[]
	): void {
		chapterContainer.createEl("h2", { text: `${book.name} ${chapterNumber}` });
		const controlsContainer = chapterContainer.createDiv({ cls: "controls-container" });

		this.previousButton = controlsContainer.createEl("button", {
			text: Platform.isMobileApp ? "Previous" : "Previous chapter",
			cls: "previous-button",
		});
		this.previousButton.addEventListener("click", () => {
			if (chapterNumber > 1) {
				void this.openChapter(book, chapterNumber - 1, chapterContainer, books);
			}
		});

		this.backButton = controlsContainer.createEl("button", {
			text: Platform.isMobileApp ? "Back" : "Back to books",
			cls: "back-button",
		});
		this.backButton.addEventListener("click", () => {
			void this.onOpen();
		});

		this.nextButton = controlsContainer.createEl("button", {
			text: Platform.isMobileApp ? "Next" : "Next chapter",
			cls: "next-button",
		});
		this.nextButton.addEventListener("click", () => {
			if (chapterNumber < book.chapters) {
				void this.openChapter(book, chapterNumber + 1, chapterContainer, books);
				return;
			}

			const nextBook = books[books.findIndex((candidate) => candidate.id === book.id) + 1];
			if (nextBook) {
				void this.openChapter(nextBook, 1, chapterContainer, books);
			}
		});

		const chapterContent = chapterContainer.createEl("div", { cls: "chapter-content" });
		const selectedVerses = new Map<number, string>();
		if (Array.isArray(chapter)) {
			this.renderBollsChapter(
				chapter,
				chapterContent,
				selectedVerses,
				book,
				chapterNumber
			);
			return;
		}
		this.renderHelloAOChapter(
			chapter,
			chapterContent,
			selectedVerses,
			book,
			chapterNumber
		);
	}

	private renderBollsChapter(
		chapter: BollsVerse[],
		container: HTMLElement,
		selectedVerses: Map<number, string>,
		book: BibleBook,
		chapterNumber: number
	): void {
		for (const verse of chapter) {
			const verseNumber = Number(verse.verse);
			if (Number.isNaN(verseNumber)) {
				continue;
			}
			const verseText = this.normalizeVerseText(verse.text);
			const formattedVerse = container.createEl("span", { cls: "verse" });
			formattedVerse.appendChild(
				document.createTextNode(`${this.convertToSuperscript(verse.verse)} `)
			);
			this.appendVerseText(formattedVerse, verse.text);
			this.bindVerseSelection(
				formattedVerse,
				verseNumber,
				verseText,
				selectedVerses,
				book,
				chapterNumber
			);
			container.appendChild(document.createTextNode(" "));
		}
	}

	private renderHelloAOChapter(
		chapter: HelloAOChapter,
		container: HTMLElement,
		selectedVerses: Map<number, string>,
		book: BibleBook,
		chapterNumber: number
	): void {
		const footnoteContext: HelloAOFootnoteRenderContext = {
			footnotes: new Map(
				(chapter.chapter.footnotes || []).map((footnote) => [footnote.noteId, footnote])
			),
			footnoteNumbers: new Map(),
			usedFootnotes: [],
			showFootnotes: this.settings.showFootnotes,
		};

		for (const block of chapter.chapter.content) {
			if (block.type === "heading") {
				container.createEl("h3", {
					text: this.getHelloAOInlineText(block.content),
				});
				continue;
			}
			if (block.type === "hebrew_subtitle") {
				container.createEl("h4", {
					text: this.getHelloAOInlineText(block.content),
					cls: "hebrew-subtitle",
				});
				continue;
			}
			if (block.type === "line_break") {
				container.createEl("div", { cls: "bible-block-break" });
				continue;
			}

			const verseText = this.getHelloAOInlineText(block.content);
			const formattedVerse = container.createEl("span", { cls: "verse" });
			formattedVerse.createEl("sup", { text: String(block.number) });
			formattedVerse.appendChild(document.createTextNode(" "));
			this.appendHelloAOInlineContent(formattedVerse, block.content, footnoteContext);
			this.bindVerseSelection(
				formattedVerse,
				block.number,
				verseText,
				selectedVerses,
				book,
				chapterNumber
			);
			container.appendChild(document.createTextNode(" "));
		}

		this.renderHelloAOFootnotes(container, footnoteContext);
	}

	private appendHelloAOInlineContent(
		container: HTMLElement,
		content: HelloAOInlineContent[],
		footnoteContext: HelloAOFootnoteRenderContext
	): void {
		for (const item of content) {
			if (typeof item === "string") {
				container.appendChild(document.createTextNode(item));
				continue;
			}
			if ("lineBreak" in item) {
				container.appendChild(document.createElement("br"));
				continue;
			}
			if ("text" in item) {
				const textEl = item.wordsOfJesus || item.poem
					? container.createEl("span", { cls: item.wordsOfJesus ? "words-of-jesus" : undefined })
					: container;
				if (item.poem) {
					textEl.addClass(`poetry-indent-${item.poem}`);
				}
				textEl.appendChild(document.createTextNode(item.text));
				continue;
			}

			this.appendHelloAOFootnoteMarker(container, item.noteId, footnoteContext);
			container.appendChild(document.createTextNode(" "));
		}
	}

	private appendHelloAOFootnoteMarker(
		container: HTMLElement,
		noteId: number,
		footnoteContext: HelloAOFootnoteRenderContext
	): void {
		if (!footnoteContext.showFootnotes) {
			return;
		}

		const footnote = footnoteContext.footnotes.get(noteId);
		if (!footnote) {
			return;
		}

		let footnoteNumber = footnoteContext.footnoteNumbers.get(noteId);
		if (!footnoteNumber) {
			footnoteNumber = footnoteContext.footnoteNumbers.size + 1;
			footnoteContext.footnoteNumbers.set(noteId, footnoteNumber);
			footnoteContext.usedFootnotes.push(footnote);
		}

		container.createEl("sup", {
			text: this.getFootnoteLabel(footnoteNumber),
			cls: "helloao-footnote-ref",
		});
	}

	private getFootnoteLabel(footnoteNumber: number): string {
		let label = "";
		let value = footnoteNumber;

		while (value > 0) {
			value--;
			label = String.fromCharCode(97 + (value % 26)) + label;
			value = Math.floor(value / 26);
		}

		return label;
	}

	private renderHelloAOFootnotes(
		container: HTMLElement,
		footnoteContext: HelloAOFootnoteRenderContext
	): void {
		if (!footnoteContext.showFootnotes || footnoteContext.usedFootnotes.length === 0) {
			return;
		}

		const footnotesSection = container.createDiv({ cls: "helloao-footnotes" });
		footnotesSection.createEl("hr", { cls: "helloao-footnotes-divider" });
		footnotesSection.createEl("h3", {
			text: "Footnotes",
			cls: "helloao-footnotes-heading",
		});
		const footnotesList = footnotesSection.createEl("div", {
			cls: "helloao-footnotes-list",
		});
		for (const footnote of footnoteContext.usedFootnotes) {
			const footnoteNumber = footnoteContext.footnoteNumbers.get(footnote.noteId);
			if (!footnoteNumber) {
				continue;
			}

			const footnoteEl = footnotesList.createDiv({ cls: "helloao-footnote" });
			footnoteEl.createEl("span", {
				text: `${this.getFootnoteLabel(footnoteNumber)}.`,
				cls: "helloao-footnote-label",
			});
			footnoteEl.createEl("span", {
				text: ` ${footnote.text}`,
				cls: "helloao-footnote-text",
			});
		}
	}

	private getHelloAOInlineText(content: HelloAOInlineContent[]): string {
		const text = content
			.map((item) => {
				if (typeof item === "string") {
					return item;
				}
				if ("text" in item) {
					return item.text;
				}
				if ("noteId" in item) {
					return " ";
				}
				return "lineBreak" in item ? "\n" : "";
			})
			.join("");

		return text
			.replace(/[ \t]+/g, " ")
			.replace(/\s+([,.;:!?])/g, "$1")
			.replace(/\n[ \t]+/g, "\n")
			.trim();
	}

	private bindVerseSelection(
		element: HTMLElement,
		verseNumber: number,
		verseText: string,
		selectedVerses: Map<number, string>,
		book: BibleBook,
		chapterNumber: number
	): void {
		element.addEventListener("click", () => {
			element.classList.toggle("active-verse");
			if (element.classList.contains("active-verse")) {
				selectedVerses.set(verseNumber, verseText);
			} else {
				selectedVerses.delete(verseNumber);
			}
			this.renderCopyMessage(
				book,
				chapterNumber,
				[...selectedVerses.entries()].map(([verse, text]) => ({ verse, text }))
			);
		});
	}

	renderCopyMessage(book: BibleBook, chapter: number, selectedVerses: SelectedVerse[]): void {
		if (!selectedVerses.length) {
			return;
		}

		const verses = [...selectedVerses].sort((a, b) => a.verse - b.verse);
		const prefix = this.settings.copyFormat === "callout" ? "> " : "";
		const copiedVerseText = verses
			.map(
				(verse) =>
					`${prefix}${this.convertToSuperscript(String(verse.verse))} ${verse.text}`
			)
			.join("\n");
		const referenceText = this.settings.copyVerseReference
			? this.getCopyReference(book, chapter, verses)
			: "";
		const copiedText = [copiedVerseText, referenceText].filter(Boolean).join("\n\n");

		void navigator.clipboard.writeText(copiedText.trim());
		new Notice(`Copied ${book.name} ${chapter}:${this.getVerseRangeLabel(verses)}`);
	}

	private getCopyReference(book: BibleBook, chapter: number, verses: SelectedVerse[]): string {
		const referenceBook = this.settings.verseReferenceInternalLinking
			? `[[${book.name}]]`
			: book.name;
		return `${this.settings.copyFormat === "callout" ? "> " : ""}${this.settings.verseReferenceStyle} ${referenceBook} ${chapter}:${this.getVerseRangeLabel(verses)}`;
	}

	private getVerseRangeLabel(verses: SelectedVerse[]): string {
		return verses.length === 1
			? String(verses[0].verse)
			: `${verses[0].verse}-${verses[verses.length - 1].verse}`;
	}
}
