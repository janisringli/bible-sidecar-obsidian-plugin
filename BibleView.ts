import { ItemView, WorkspaceLeaf, requestUrl, Notice } from "obsidian";

export const BibleViewType = "bible-view";

interface BibleSidecarSettings {
	bibleVersion: string;
}

const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "NLT",


};

export class BibleView extends ItemView {
	settings: BibleSidecarSettings;
	backButton: HTMLElement;
	previousButton: HTMLElement;
	nextButton: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return BibleViewType;
	}

	getDisplayText() {
		return "Bible Sidecar";
	}

	getIcon() {
		return "book-open-text";
	}

	public load(): void {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, this.settings);
		super.load();
	}

	async onOpen() {
		const books = await this.generateBibleBooks();
		this.renderBooks(books);
	}

	async generateBibleBooks() {
		const url = `https://bolls.life/get-books/${this.settings.bibleVersion}`;
		const response = await requestUrl(url);
		return response.json;
	}

	async getChapterContent(bookid: number, chapter: number) {
		const url = `https://bolls.life/get-chapter/${this.settings.bibleVersion}/${bookid}/${chapter}`;
		const response = await requestUrl(url);
		return response.json;
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

		const digits = String(number).split("");
		const superscriptedDigits = digits.map(
			(digit: keyof typeof superscriptMap) => superscriptMap[digit]
		);
		return superscriptedDigits.join("");
	}
	convertToNumber(superscriptNumber: string): number {
		const superscriptMap = {
			"⁰": "0",
			"¹": "1",
			"²": "2",
			"³": "3",
			"⁴": "4",
			"⁵": "5",
			"⁶": "6",
			"⁷": "7",
			"⁸": "8",
			"⁹": "9",
		};
		const digits = superscriptNumber
			.split("")
			.map(
				(digit) => superscriptMap[digit as keyof typeof superscriptMap]
			);
		return parseInt(digits.join(""), 10);
	}

	renderBooks(books: any[]) {
		const { containerEl } = this;
		containerEl.empty();

		const ChapterWrapper = containerEl.createEl("div", {
			cls: "bible-wrapper",
		});
		const chapterContainer = ChapterWrapper.createEl("div", {
			cls: "chapter-container",
		});
		chapterContainer.createEl("div", {
			cls: "chapter-content",
		});

		for (const book of books) {
			if (book.bookid === 1) {
				chapterContainer.createEl("h4", {
					text: "Old Testament",
					cls: "book-divider",
				});
			}
			if (book.bookid === 40) {
				chapterContainer.createEl("hr", { cls: "book-divider" });
				chapterContainer.createEl("h4", {
					text: "New Testament",
					cls: "book-divider",
				});
			}
			chapterContainer
				.createEl("button", {
					text: book.name,
					attr: { id: book.bookid },
				})
				.addEventListener("click", async () => {
					await this.renderChapters(book, chapterContainer, books);
				});
		}
	}

	async renderChapters(
		book: any,
		chapterContainer: HTMLElement,
		books: any[]
	) {
		chapterContainer.empty();

		// Header with back button
		const header = chapterContainer.createDiv({ cls: "bible-header" });
		chapterContainer.createDiv({
			cls: "controls-container",
		});

		this.backButton = header.createEl("button", {
			text: "Back to Books",
			cls: "back-button",
		});
		this.backButton.addEventListener("click", () => {
			this.onOpen();
		});

		for (let i = 1; i <= book.chapters; i++) {
			chapterContainer
				.createEl("button", {
					text: i.toString(),
					cls: "chapter-button",
				})
				.addEventListener("click", async () => {
					const chapterContentArray = await this.getChapterContent(
						book.bookid,
						i
					);
					chapterContainer.empty();

					this.processChapterContent(
						chapterContentArray,
						chapterContainer,
						book,
						i,
						books
					);
				});
		}
	}
	processChapterContent(
		chapter: { verse: string; text: string }[],
		chapterContainer: HTMLElement,
		book: any,
		i: number,
		books: any[]
	) {
		chapterContainer.createEl("h2", { text: `${book.name} ${i}` });
		const controlsContainer = chapterContainer.createDiv({
			cls: "controls-container",
		});
		this.previousButton = controlsContainer.createEl("button", {
			text: "Previous chapter",
			cls: "back-button",
		});
		this.previousButton.addEventListener("click", async () => {
			let newChapter = i - 1;
			if (newChapter < 1) {
				newChapter = 1;
			} else {
				const previousChapterContent = await this.getChapterContent(
					book.bookid,
					newChapter
				);
				chapterContainer.empty();
				this.processChapterContent(
					previousChapterContent,
					chapterContainer,
					book,
					newChapter,
					books
				);
			}
		});
		this.backButton = controlsContainer.createEl("button", {
			text: "Back to Books",
			cls: "back-button",
		});
		this.backButton.addEventListener("click", () => {
			this.onOpen();
		});
		this.nextButton = controlsContainer.createEl("button", {
			text: "Next chapter",
			cls: "back-button",
		});
		this.nextButton.addEventListener("click", async () => {
			//todo: add logic to go to next chapter
			let newChapter = i + 1;
			if (newChapter > book.chapters) {
				const newBookId = book.bookid + 1;
				const newBook = books[newBookId - 1];
				newChapter = 1;
				const nextChapterContent = await this.getChapterContent(
					newBookId,
					newChapter
				);
				chapterContainer.empty();
				this.processChapterContent(
					nextChapterContent,
					chapterContainer,
					newBook,
					newChapter,
					books
				);
			} else {
				const nextChapterContent = await this.getChapterContent(
					book.bookid,
					newChapter
				);

				chapterContainer.empty();
				this.processChapterContent(
					nextChapterContent,
					chapterContainer,
					book,
					newChapter,
					books
				);
			}
		});
		const chapterContent = chapterContainer.createEl("div", {
			cls: "chapter-content",
		});
		chapterContent.empty();

		let scriptureRaw = "";
		let accumulatedVerseText = "";

		function filterVerse(verse: string): string {
			return verse.replace(/<br\s*\/?>|<\/?i>|<\/?b>/gi, "\n");
		}

		for (const verse of chapter) {
			const formattedVerseNumber = this.convertToSuperscript(verse.verse);
			const filteredVerseText = filterVerse(verse.text);

			scriptureRaw += `${formattedVerseNumber} ${filteredVerseText} `;

			const formattedVerse = chapterContent.createEl("span", {
				cls: "verse", // other properties if needed
			});

			formattedVerse.appendChild(
				document.createTextNode(
					`${formattedVerseNumber} ${filteredVerseText}`
				)
			);

			formattedVerse.addEventListener("click", () => {
				formattedVerse.classList.toggle("active-verse");

				const verseIdentifier = `${formattedVerseNumber} ${verse.text}`;

				if (formattedVerse.classList.contains("active-verse")) {
					accumulatedVerseText += verseIdentifier + " ";
				} else {
					accumulatedVerseText = accumulatedVerseText.replace(
						verseIdentifier + " ",
						""
					);
				}
				this.renderCopyMessage(book, i, accumulatedVerseText, verse);
			});

			chapterContent.appendChild(formattedVerse);
		}

		const editedScripture = scriptureRaw;
		chapterContent.appendChild(document.createTextNode(editedScripture));

		// Now that scriptureRaw is built, perform the replacement

		// Important: Append the formattedVerse to the DOM somewhere here.
		// For example:  someContainer.appendChild(formattedVerse);
	}
	renderCopyMessage(
		book: any,
		chapter: number,
		accumulatedVerseText: string,
		verse: { verse: string; text: string }
	) {
		const regex = /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/g;
		const verses = accumulatedVerseText
			.split("\n")
			.flatMap((verse) => {
				const matches = Array.from(verse.matchAll(regex));

				if (matches.length === 0) {
					return [{ verse: 0, text: verse.trim() }];
				}

				return matches.map((match) => {
					const verseNumber = this.convertToNumber(match[0]);
					const verseStart = match.index + match[0].length;
					const verseEnd =
						matches.indexOf(match) === matches.length - 1
							? verse.length
							: Array.from(verse.matchAll(regex))[
									matches.indexOf(match) + 1].index;
					const verseText = verse
						.substring(verseStart, verseEnd)
						.trim();

					return {
						verse: verseNumber,
						text: verseText,
					};
				});
			})
			.sort((a, b) => {
				return (a?.verse ?? 0) - (b?.verse ?? 0); // Simplified comparison
			});
		
		for (const verse of verses) {
			let verseRangeStart = 0;
			let verseRangeEnd = 0;
			let sortedText = "";

			verses.forEach((verse, index) => {
				if (verseRangeStart === 0) {
					verseRangeStart = verse.verse;
				}

				// Check if the current verse is NOT consecutive to the previous one
				if (index > 0 && verses[index - 1].verse !== verse.verse - 1) {
					verseRangeEnd = verses[index - 1].verse; // End range at the *previous* verse
					sortedText += ` \n-${book.name} ${chapter}:${ 
						verseRangeStart === verseRangeEnd
							? verseRangeStart
							: verseRangeStart + "-" + verseRangeEnd
					}  \n\n`; // Add range to sortedText
					verseRangeStart = verse.verse; // Start a new range with the current verse
				}

				sortedText += `${this.convertToSuperscript(
					verse.verse.toString()
				)} ${verse.text}`;

				// Handle the last verse
				if (index === verses.length - 1) {
					verseRangeEnd = verse.verse;
					sortedText +=  ` \n-${book.name} ${chapter}:${ 
						verseRangeStart === verseRangeEnd
							? verseRangeStart
							: verseRangeStart + "-" + verseRangeEnd
					} `; // Add the last range or single verse
				}
			});
			
	
			navigator.clipboard.writeText(sortedText.trim());

			new Notice(
				`Copied ${book.name} ${chapter}:${verse.verse} to clipboard`
			);
		}
	}
}
