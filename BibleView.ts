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

    async getChapterContent(bookid: number, chapter: number) {
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

        for (const book of books) {
            console.log(book.name);
			if (book.bookid === 40) {
				chapterContainer.createEl("hr", { cls: "book-divider" });
			}
            chapterContainer
                .createEl("button", { text: book.name, attr: { id: book.bookid } })
                .addEventListener("click", async () => {
                    await this.renderChapters(book, chapterContainer);
                });
        }
    }

    async renderChapters(book: any, chapterContainer: HTMLElement) {
        let scriptureRaw: string = "";
        chapterContainer.empty();

        // Header with back button
        const header = chapterContainer.createDiv({ cls: "bible-header" });
        this.backButton = header.createEl("button", { text: "Back to Books", cls: "back-button" });
        this.backButton.addEventListener("click", () => {
            this.onOpen();
        });

        for (let i = 1; i <= book.chapters; i++) {
            chapterContainer
                .createEl("button", { text: i.toString(), cls: "chapter-button" })
                .addEventListener("click", async () => {
                    const chapterContent = await this.getChapterContent(book.bookid, i);
                    chapterContainer.empty();
                    chapterContainer.createEl("h2", { text: `${book.name} ${i}` });
                    for (const verse of chapterContent) {
                        let formattedVerseNumber = this.convertToSuperscript(verse.verse);
                        scriptureRaw += `${formattedVerseNumber} ${verse.text} `;
                    }
                    console.log(scriptureRaw);
                    let editedScripture = scriptureRaw.replace(/<br>/g, "\n");
                    console.log(editedScripture);
                    chapterContainer.createEl("p", { text: editedScripture });
                });
        }
    }
}
