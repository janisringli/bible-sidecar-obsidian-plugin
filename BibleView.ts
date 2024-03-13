import { ItemView, WorkspaceLeaf, requestUrl } from "obsidian";
import { BibleSidecarSettingsTab } from "./settings";

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
        console.log(this.settings.bibleVersion);
        const books = await this.generateBibleBooks();
        this.renderBooks(books);
    }

    async generateBibleBooks() {
        const url = `https://bolls.life/get-books/${this.settings.bibleVersion}`;
        const response = await requestUrl(url);
        return response.json;
    }

    async getChapterContent(bookid: number, chapter: number,) {
        const url = `https://bolls.life/get-chapter/${this.settings.bibleVersion}/${bookid}/${chapter}`;
        console.log(url);
        const response = await requestUrl(url);
        console.log(response.json);
        return response.json;
    }

    convertToSuperscript(number: any) {
        const superscriptMap = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
        };

        const digits = String(number).split('');
        const superscriptedDigits = digits.map(digit => superscriptMap[digit]);
        return superscriptedDigits.join('');
    }

    renderBooks(books: any[]) {
        const { containerEl } = this;
        containerEl.empty();

        const ChapterWrapper = containerEl.createEl("div", { cls: "bible-wrapper" });
        const chapterContainer = ChapterWrapper.createEl("div", { cls: "chapter-container" });
		const chapterContent = chapterContainer.createEl("div", { cls: "chapter-content" });

        for (const book of books) {
			if (book.bookid === 1) {
				chapterContainer.createEl("h4", { text: "Old Testament", cls: "book-divider" });
			}
			if (book.bookid === 40) {
				chapterContainer.createEl("hr", { cls: "book-divider" });
				chapterContainer.createEl("h4", { text: "New Testament", cls: "book-divider" });
			}
            chapterContainer
                .createEl("button", { text: book.name, attr: { id: book.bookid } })
                .addEventListener("click", async () => {
                    await this.renderChapters(book, chapterContainer, books);
                });
        }
    }

    async renderChapters(book: any, chapterContainer: HTMLElement, books: any[]) {
        chapterContainer.empty();
		
        // Header with back button
        const header = chapterContainer.createDiv({ cls: "bible-header" });
		const controlsContainer = chapterContainer.createDiv({ cls: "controls-container" });
		
        this.backButton = header.createEl("button", { text: "Back to Books", cls: "back-button" });
        this.backButton.addEventListener("click", () => {
            this.onOpen();
        });

        for (let i = 1; i <= book.chapters; i++) {
            chapterContainer
                .createEl("button", { text: i.toString(), cls: "chapter-button" })
                .addEventListener("click", async () => {
                    const chapterContentArray = await this.getChapterContent(book.bookid, i);
                    chapterContainer.empty();
                    
                    this.processChapterContent(chapterContentArray, chapterContainer, book, i,books);
                });
        }
    }
	processChapterContent(chapter: { verse: string; text: string }[], chapterContainer: HTMLElement, book: any, i: number, books: any[]) {
		console.log("chapter number at start of processChapterContent", i);
		console.log("book")
		console.log(book)
		chapterContainer.createEl("h2", { text: `${book.name} ${i}` });
		const controlsContainer = chapterContainer.createDiv({ cls: "controls-container" });
					this.previousButton = controlsContainer.createEl("button", { text: "Previous chapter", cls: "back-button" });
					this.previousButton.addEventListener("click", async () => {
						let newChapter = i - 1;
						if (newChapter < 1) {
							newChapter = 1;
						} else {
						
						let previousChapterContent = await this.getChapterContent(book.bookid, newChapter);
						console.log(previousChapterContent)
						chapterContainer.empty();
						this.processChapterContent(previousChapterContent, chapterContainer,book, newChapter, books);
						}

					});
					this.backButton = controlsContainer.createEl("button", { text: "Back to Books", cls: "back-button" });
					this.backButton.addEventListener("click", () => {
						this.onOpen();
					});
					this.nextButton = controlsContainer.createEl("button", { text: "Next chapter", cls: "back-button" });
					this.nextButton.addEventListener("click", async () => {
						//todo: add logic to go to next chapter
						let newChapter = i + 1;
						if (newChapter > book.chapters) {

							let newBookId = book.bookid + 1;
							let newBook = books[newBookId - 1];
							newChapter = 1;
							let nextChapterContent = await this.getChapterContent(newBookId, newChapter);
							chapterContainer.empty();
							this.processChapterContent(nextChapterContent, chapterContainer,newBook, newChapter, books);
						}else{
						const nextChapterContent = await this.getChapterContent(book.bookid, newChapter);
						console.log("next chapter content", nextChapterContent);
						
						chapterContainer.empty();
						this.processChapterContent(nextChapterContent, chapterContainer,book, newChapter, books);
						}
					});
		const chapterContent = chapterContainer.createEl("div", { cls: "chapter-content" });
		chapterContent.empty();
		
					
		let scriptureRaw: string = '';
		
		for (const verse of chapter) {
			let formattedVerseNumber = this.convertToSuperscript(verse.verse);
			scriptureRaw += `${formattedVerseNumber} ${verse.text} `;
		}
		let editedScripture = scriptureRaw.replace(/<br>/g, "\n");
		const scripture = chapterContent.createEl("p", { text: editedScripture });
	
		
	}
	
	
}
