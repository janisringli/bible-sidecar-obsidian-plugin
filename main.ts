import {
	Notice,
	Platform,
	Plugin,
	requestUrl,
	WorkspaceLeaf,
} from "obsidian";
import { BibleView, BibleViewType } from "BibleView";
import type { BibleLanguageOption, BibleProviderRoute } from "BibleView";
import { BibleSidecarSettingsTab } from "./settings";
import { buildBibleReferenceEditorExtension } from "./referenceEditorExtension";
import {
	BIBLE_REFERENCE_CLASS,
	BibleReference,
	processBibleReferencesInElement,
	readBibleReferenceFromElement,
} from "./references";

export interface BibleSidecarSettings {
	bibleVersion: string;
	copyFormat: string;
	copyVerseReference: boolean;
	verseReferenceStyle: string;
	verseReferenceFormat: string;
	verseReferenceInternalLinking: boolean;
	verseReferenceInternalLinkingFormat: string;
	bibleLanguage: string;
	showFootnotes: boolean;
	referencePreviewsEnabled: boolean;
	referencePreviewTrigger: "hover" | "click";
}

export interface BollsTranslation {
	short_name: string;
	full_name: string;
	updated?: number;
	dir?: string;
}

export interface BollsLanguageGroup {
	language: string;
	translations: BollsTranslation[];
}

interface HelloAOTranslation {
	id: string;
	name: string;
	shortName: string;
	englishName: string;
	language: string;
	languageName: string;
	languageEnglishName: string;
}

interface HelloAOCatalog {
	translations: HelloAOTranslation[];
}

export interface BibleTranslationChoice {
	short_name: string;
	full_name: string;
}

interface NormalizedBibleTranslation extends BibleTranslationChoice {
	bollsTranslationId?: string;
	helloAOTranslationId?: string;
}

interface NormalizedBibleLanguageGroup {
	key: string;
	label: string;
	bollsLanguage?: string;
	translations: NormalizedBibleTranslation[];
}

interface PreviewBibleBook {
	id: number | string;
	code?: string;
	name: string;
	chapters: number;
	order: number;
}

interface PreviewBollsVerse {
	verse: string;
	text: string;
}

interface PreviewBollsBook {
	bookid: number;
	name: string;
	chapters: number;
}

type PreviewHelloAOInlineContent =
	| string
	| { lineBreak: true }
	| { noteId: number }
	| { text: string; poem?: number; wordsOfJesus?: boolean };

interface PreviewHelloAOChapter {
	chapter: {
		content: Array<{
			type: string;
			number?: number;
			content?: PreviewHelloAOInlineContent[];
		}>;
	};
}

interface PreviewHelloAOBook {
	id: string;
	name: string;
	numberOfChapters: number;
	order: number;
}

interface PreviewHelloAOBooksResponse {
	books: PreviewHelloAOBook[];
}

interface ReferencePreviewTranslationState {
	language: string;
	version: string;
}

type ReferencePopoverMode = "selection" | "chapter";

interface ReaderVerse {
	verse: number;
	text: string;
}

const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "NLT",
	copyFormat: "plain",
	copyVerseReference: false,
	verseReferenceStyle: "- ",
	verseReferenceFormat: "full",
	verseReferenceInternalLinking: false,
	verseReferenceInternalLinkingFormat: "short",
	bibleLanguage: "en",
	showFootnotes: false,
	referencePreviewsEnabled: true,
	referencePreviewTrigger: "hover",
};

const REFERENCE_HOVER_DELAY_MS = 120;
const TRANSLATION_OPTION_SEPARATOR = "\u0000";

const LANGUAGE_DEFAULT_VERSIONS: Record<string, string> = {
	en: "NLT",
	de: "ELB",
	fr: "NBS",
	es: "BTX3",
	pt: "ARA",
	it: "NR06",
	nl: "NLD",
	ru: "SYNOD",
	ar: "SVD",
	in: "TB",
};

const BOLLS_CATALOG_URL = "https://bolls.life/static/bolls/app/views/languages.json";
const HELLO_AO_CATALOG_URL = "https://bible.helloao.org/api/available_translations.json";

const LEGACY_LANGUAGE_KEYS: Record<string, string> = {
	en: "English",
	de: "German Deutsch",
	fr: "French Français",
	es: "Spanish Español",
	pt: "Portuguese",
	it: "Latin / Italian",
	nl: "Dutch Nederlands",
	ru: "russian русский",
	ar: "Arabic العربية",
	in: "Indonesian",
};

const HELLO_AO_LANGUAGE_KEYS: Record<string, string> = {
	eng: "en",
	deu: "de",
	ger: "de",
	fra: "fr",
	fre: "fr",
	spa: "es",
	por: "pt",
	ita: "it",
	nld: "nl",
	dut: "nl",
	rus: "ru",
	ara: "ar",
	ind: "in",
};

const HELLO_AO_SAFE_ALIASES: Record<string, string> = {
	ASV: "eng_asv",
	BSB: "BSB",
	DRB: "eng_dra",
	GNV: "eng_gnv",
	KJV: "eng_kjv",
	LSV: "eng_lsv",
	NET: "eng_net",
	WEB: "ENGWEBP",
	YLT: "eng_ylt",
};

const BOLLS_ONLY_VERSION_CODES = new Set([
	"AMP",
	"CSB17",
	"ESV",
	"MSG",
	"NASB",
	"NIV",
	"NIV2011",
	"NKJV",
	"NLT",
]);

const normalizeForComparison = (value: string): string =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "");

export default class BibleSidecarPlugin extends Plugin {
	settings: BibleSidecarSettings;
	private view: BibleView | undefined;
	bollsCatalog: BollsLanguageGroup[] = [];
	helloAOCatalog: HelloAOTranslation[] = [];
	mergedCatalog: NormalizedBibleLanguageGroup[] = [];
	bollsCatalogLoadError: string | null = null;
	helloAOCatalogLoadError: string | null = null;
	private popover: HTMLElement | null = null;
	private popoverTarget: HTMLElement | null = null;
	private popoverToken: symbol | null = null;
	private hoverElement: HTMLElement | null = null;
	private referenceHovered = false;
	private popoverHovered = false;
	private showTimer: number | null = null;
	private hideTimer: number | null = null;
	private previewBooksCache = new Map<string, Promise<PreviewBibleBook[]>>();
	private referencePreviewSessionTranslation: ReferencePreviewTranslationState | null = null;

	async onload() {
		await this.loadSettings();
		await Promise.all([this.loadBollsCatalog(), this.loadHelloAOCatalog()]);
		this.buildMergedCatalog();

		this.addSettingTab(new BibleSidecarSettingsTab(this.app, this));

		this.registerView(
			BibleViewType,
			(leaf: WorkspaceLeaf) => {
				const view = new BibleView(leaf);
				this.view = view;
				view.settings = this.settings;
				view.setTranslationOptionsResolver((language) => ({
					translations: this.getBibleTranslationsForLanguage(language),
					defaultVersion: this.getDefaultBibleVersion(language),
				}));
				view.setLanguageOptionsResolver(() => this.getBibleViewLanguageOptions());
				view.setProviderResolver((language, version) =>
					this.resolveBibleProvider(language, version)
				);
				return view;
			}
		);

		this.addRibbonIcon(
			"book-open-text",
			"Bible Sidecar",
			() => {
				this.toggleBibleSidecarView();
			}
		);

		this.addCommand({
			id: "open-bible-sidecar",
			name: "Open Bible Sidecar",
			callback: this.toggleBibleSidecarView,
			icon: "book-open-text",
		});

		this.setupReferencePreviews();

		this.initLeaf();
	}

	onunload(): void {
		this.clearReferenceTimers();
		this.popover?.remove();
		this.popover = null;
	}

	private readonly toggleBibleSidecarView = async (): Promise<void> => {
		const existing = this.app.workspace.getLeavesOfType(BibleViewType);
		if (existing.length) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			await rightLeaf.setViewState({
				type: BibleViewType,
				active: true,
			});
		}

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(BibleViewType)[0]
		);
	};

	initLeaf(): void {
		if (this.app.workspace.getLeavesOfType(BibleViewType).length) {
			console.log("Bible view already open");
		}
	}

	private setupReferencePreviews(): void {
		this.popover = document.body.createDiv({ cls: "bible-sidecar-ref-popover" });
		this.popover.setAttr("role", "tooltip");
		this.popover.addEventListener("mouseenter", () => {
			this.popoverHovered = true;
		});
		this.popover.addEventListener("mouseleave", () => {
			this.popoverHovered = false;
			if (this.isChapterReaderOpen()) {
				return;
			}
			this.scheduleHidePopover();
		});

		this.registerMarkdownPostProcessor((element) => {
			if (this.settings.referencePreviewsEnabled) {
				processBibleReferencesInElement(element);
			}
		});
		this.registerEditorExtension(buildBibleReferenceEditorExtension());

		if (!Platform.isMobileApp) {
			this.registerDomEvent(document, "mouseover", (event: MouseEvent) => {
				if (this.isChapterReaderOpen()) {
					return;
				}
				if (!this.shouldUseHoverPreviews()) {
					return;
				}
				const target = this.getReferenceTarget(event.target);
				if (!target || target === this.hoverElement) {
					return;
				}
				this.hoverElement = target;
				const reference = readBibleReferenceFromElement(target);
				if (reference) {
					this.scheduleShowPopover(target, reference);
				}
			});

			this.registerDomEvent(document, "mouseout", (event: MouseEvent) => {
				if (this.isChapterReaderOpen()) {
					return;
				}
				if (!this.shouldUseHoverPreviews()) {
					return;
				}
				const target = this.getReferenceTarget(event.target);
				if (!target || target !== this.hoverElement) {
					return;
				}
				if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) {
					return;
				}
				this.hoverElement = null;
				this.referenceHovered = false;
				this.scheduleHidePopover();
			});
		}

		this.registerDomEvent(document, "click", (event: MouseEvent) => {
			const target = this.getReferenceTarget(event.target);
			if (!target) {
				if (this.popover?.contains(event.target instanceof Node ? event.target : null)) {
					return;
				}
				this.hidePopover();
				return;
			}
			if (!this.settings.referencePreviewsEnabled) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const reference = readBibleReferenceFromElement(target);
			if (!reference) {
				return;
			}
			if (Platform.isMobileApp || this.settings.referencePreviewTrigger === "click") {
				void this.showPopover(target, reference);
				return;
			}
			void this.openBibleReference(reference);
		});

		this.registerDomEvent(document, "keydown", (event: KeyboardEvent) => {
			const target = this.getReferenceTarget(event.target);
			if (event.key === "Escape") {
				this.hidePopover();
				return;
			}
			if (!target || !this.settings.referencePreviewsEnabled) {
				return;
			}
			if (event.key !== "Enter" && event.key !== " ") {
				return;
			}
			event.preventDefault();
			const reference = readBibleReferenceFromElement(target);
			if (!reference) {
				return;
			}
			if (Platform.isMobileApp || this.settings.referencePreviewTrigger === "click") {
				void this.showPopover(target, reference);
				return;
			}
			void this.openBibleReference(reference);
		});

		this.registerDomEvent(window, "scroll", (event: Event) => {
			if (!this.popover?.hasClass("is-visible")) {
				return;
			}
			if (event.target instanceof Node && this.popover.contains(event.target)) {
				return;
			}
			if (this.isChapterReaderOpen()) {
				this.positionPopover(this.popoverTarget || this.popover);
				return;
			}
			const target = this.popoverTarget;
			if (!target?.isConnected) {
				this.hidePopover();
				return;
			}
			const rect = target.getBoundingClientRect();
			if (rect.bottom < 0 || rect.top > window.innerHeight) {
				this.hidePopover();
				return;
			}
			this.positionPopover(target);
		}, true);

		this.registerEvent(this.app.workspace.on("layout-change", () => {
			if (this.isChapterReaderOpen() && this.popover) {
				this.positionPopover(this.popoverTarget || this.popover);
				return;
			}
			this.hidePopover();
		}));
	}

	private shouldUseHoverPreviews(): boolean {
		return this.settings.referencePreviewsEnabled && this.settings.referencePreviewTrigger === "hover";
	}

	private getReferenceTarget(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) {
			return null;
		}
		const reference = target.closest(`.${BIBLE_REFERENCE_CLASS}`);
		return reference instanceof HTMLElement ? reference : null;
	}

	private scheduleShowPopover(target: HTMLElement, reference: BibleReference): void {
		this.referenceHovered = true;
		this.clearTimer("show");
		this.clearTimer("hide");
		this.showTimer = window.setTimeout(() => {
			void this.showPopover(target, reference);
		}, REFERENCE_HOVER_DELAY_MS);
	}

	private scheduleHidePopover(): void {
		if (this.isChapterReaderOpen()) {
			return;
		}
		this.clearTimer("hide");
		this.hideTimer = window.setTimeout(() => {
			if (!this.referenceHovered && !this.popoverHovered && !this.isChapterReaderOpen()) {
				this.hidePopover();
			}
		}, 260);
	}

	private hidePopover(): void {
		this.clearTimer("show");
		this.popover?.removeClass("is-visible");
		this.popover?.removeClass("is-chapter-reader");
		this.popoverToken = null;
		this.popoverTarget = null;
	}

	private isChapterReaderOpen(): boolean {
		return Boolean(this.popover?.hasClass("is-visible") && this.popover.hasClass("is-chapter-reader"));
	}

	private clearReferenceTimers(): void {
		this.clearTimer("show");
		this.clearTimer("hide");
	}

	private clearTimer(type: "show" | "hide"): void {
		const timer = type === "show" ? this.showTimer : this.hideTimer;
		if (timer !== null) {
			window.clearTimeout(timer);
		}
		if (type === "show") {
			this.showTimer = null;
			return;
		}
		this.hideTimer = null;
	}

	private async showPopover(target: HTMLElement, reference: BibleReference): Promise<void> {
		if (!this.popover) {
			return;
		}
		const token = Symbol(reference.ref);
		this.popoverToken = token;
		this.popoverTarget = target;
		this.popover.empty();

		const header = this.popover.createDiv({ cls: "bible-sidecar-ref-popover-header" });
		header.createSpan({ text: reference.ref, cls: "bible-sidecar-ref-popover-title" });
		header.appendChild(
			this.createReferencePreviewTranslationSelect(target, reference)
		);

		const body = this.popover.createDiv({ cls: "bible-sidecar-ref-popover-body" });
		body.dataset.previewMode = "selection";
		body.setText("Loading…");

		const footer = this.popover.createDiv({ cls: "bible-sidecar-ref-popover-footer" });
		const readChapterButton = footer.createEl("button", {
			text: "Read full chapter",
			cls: "bible-sidecar-ref-popover-link bible-sidecar-ref-popover-mode-link",
		});
		readChapterButton.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (body.dataset.previewMode === "chapter") {
				this.hidePopover();
				return;
			}
			const nextMode: ReferencePopoverMode = "chapter";
			const token = Symbol(`${reference.ref}:chapter`);
			this.popoverToken = token;
			body.dataset.previewMode = nextMode;
			body.setText("Loading…");
			void this.renderPopoverPreviewBody(target, reference, body, token, nextMode);
		});
		const openButton = footer.createEl("button", {
			text: "Open in Bible Sidecar",
			cls: "bible-sidecar-ref-popover-link",
		});
		openButton.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			void this.openBibleReference(reference);
		});

		this.positionPopover(target);
		this.popover.addClass("is-visible");

		await this.renderPopoverPreviewBody(target, reference, body, token, "selection");
	}

	private createReferencePreviewTranslationSelect(
		target: HTMLElement,
		reference: BibleReference
	): HTMLSelectElement {
		const select = document.createElement("select");
		select.className = "bible-sidecar-ref-popover-select";
		select.setAttr("aria-label", "Bible translation for previews");
		const activeState = this.getReferencePreviewTranslationState();
		const activeValue = this.encodeTranslationOptionValue(activeState);

		for (const language of this.mergedCatalog) {
			const group = select.createEl("optgroup");
			group.label = language.label;
			for (const translation of language.translations) {
				group.createEl("option", {
					text: translation.short_name,
					attr: {
						value: this.encodeTranslationOptionValue({
							language: language.key,
							version: translation.short_name,
						}),
						title: `${translation.short_name} - ${translation.full_name}`,
					},
				});
			}
		}

		if (Array.from(select.options).some((option) => option.value === activeValue)) {
			select.value = activeValue;
		}

		select.addEventListener("click", (event) => {
			event.stopPropagation();
		});
		select.addEventListener("change", () => {
			const next = this.decodeTranslationOptionValue(select.value);
			const body = this.popover?.querySelector(".bible-sidecar-ref-popover-body");
			if (!(body instanceof HTMLElement) || !next) {
				return;
			}
			const mode = this.getPopoverBodyMode(body);
			const token = Symbol(`${reference.ref}:${select.value}`);
			this.popoverToken = token;
			body.setText("Loading…");
			void this.setReferencePreviewTranslationState(next)
				.then(() => this.renderPopoverPreviewBody(target, reference, body, token, mode))
				.catch((error) => {
					if (this.popoverToken !== token) {
						return;
					}
					body.setText("Could not switch translations.");
					console.warn("Bible Sidecar: failed to switch preview translation", error);
				});
		});

		return select;
	}

	private async renderPopoverPreviewBody(
		target: HTMLElement,
		reference: BibleReference,
		body: HTMLElement,
		token: symbol,
		mode: ReferencePopoverMode
	): Promise<void> {
		try {
			this.applyPopoverMode(body, mode);
			if (mode === "chapter") {
				await this.renderBibleReferenceChapter(reference, body);
			} else {
				await this.renderBibleReferencePreview(reference, body);
			}
			if (this.popoverToken !== token) {
				return;
			}
			this.positionPopover(target);
		} catch (error) {
			if (this.popoverToken !== token) {
				return;
			}
			body.setText("Could not load this passage.");
			console.warn("Bible Sidecar: failed to render reference preview", error);
		}
	}

	private getPopoverBodyMode(body: HTMLElement): ReferencePopoverMode {
		return body.dataset.previewMode === "chapter" ? "chapter" : "selection";
	}

	private applyPopoverMode(body: HTMLElement, mode: ReferencePopoverMode): void {
		body.dataset.previewMode = mode;
		body.classList.toggle("is-chapter-reader", mode === "chapter");
		this.popover?.classList.toggle("is-chapter-reader", mode === "chapter");
		const modeButton = this.popover?.querySelector(".bible-sidecar-ref-popover-mode-link");
		if (modeButton instanceof HTMLElement) {
			modeButton.setText(mode === "chapter" ? "Close" : "Read full chapter");
		}
	}

	private positionPopover(target: HTMLElement): void {
		if (!this.popover) {
			return;
		}
		const margin = 8;
		const isChapterReader = this.popover.classList.contains("is-chapter-reader");
		const maxPopoverWidth = isChapterReader ? 560 : 380;
		this.popover.style.maxWidth = `${Math.min(maxPopoverWidth, window.innerWidth - margin * 2)}px`;
		const popoverWidth = this.popover.offsetWidth;
		const popoverHeight = this.popover.offsetHeight;

		if (isChapterReader) {
			const left = Math.max(margin, (window.innerWidth - popoverWidth) / 2);
			const top = Math.max(margin, (window.innerHeight - popoverHeight) / 2);
			this.popover.style.left = `${Math.round(left)}px`;
			this.popover.style.top = `${Math.round(top)}px`;
			return;
		}

		const rect = target.getBoundingClientRect();
		let left = rect.left;
		if (left + popoverWidth > window.innerWidth - margin) {
			left = window.innerWidth - margin - popoverWidth;
		}
		if (left < margin) {
			left = margin;
		}

		let top = rect.bottom + 6;
		if (top + popoverHeight > window.innerHeight - margin && rect.top - popoverHeight - 6 > margin) {
			top = rect.top - popoverHeight - 6;
		}
		this.popover.style.left = `${Math.round(left)}px`;
		this.popover.style.top = `${Math.round(top)}px`;
	}

	updateBibleViewSettings = (newSettings: BibleSidecarSettings): void => {
		if (this.view) {
			this.view.updateSettings(newSettings);
		}
	};

	public async openBibleReference(reference: BibleReference): Promise<void> {
		const existingView = this.getRegisteredBibleView();
		const translationState = existingView ? null : this.referencePreviewSessionTranslation;
		this.hidePopover();
		const view = existingView || (await this.ensureBibleView());
		if (!view) {
			new Notice("Could not open Bible Sidecar.");
			return;
		}
		if (translationState) {
			await view.setActiveTranslationState(translationState);
		}
		await view.openReference(reference);
	}

	public async renderBibleReferencePreview(
		reference: BibleReference,
		container: HTMLElement
	): Promise<void> {
		const activeView = this.getRegisteredBibleView();
		if (activeView) {
			await activeView.renderReferencePreview(reference, container);
			return;
		}

		const { language, version } = this.getReferencePreviewTranslationState();
		const route = this.resolveBibleProvider(language, version);
		const books = await this.getPreviewBooks(route);
		const book = books.find((candidate) => candidate.order === reference.order);
		if (!book) {
			container.setText("Could not find this book in the selected Bible.");
			return;
		}

		if (route.provider === "helloao") {
			await this.renderHelloAOPreview(route, book, reference, container);
			return;
		}
		await this.renderBollsPreview(route, book, reference, container);
	}

	private async renderBibleReferenceChapter(
		reference: BibleReference,
		container: HTMLElement
	): Promise<void> {
		const { language, version } = this.getReferencePreviewTranslationState();
		const route = this.resolveBibleProvider(language, version);
		const books = await this.getPreviewBooks(route);
		const book = books.find((candidate) => candidate.order === reference.order);
		if (!book) {
			container.setText("Could not find this book in the selected Bible.");
			return;
		}

		if (route.provider === "helloao") {
			await this.renderHelloAOChapterReader(route, book, reference, container);
			return;
		}
		await this.renderBollsChapterReader(route, book, reference, container);
	}

	private createChapterReaderShell(
		reference: BibleReference,
		container: HTMLElement
	): HTMLElement {
		container.empty();
		const reader = container.createDiv({ cls: "bible-sidecar-ref-reader" });
		const header = reader.createDiv({ cls: "bible-sidecar-ref-reader-header" });
		const titleWrap = header.createDiv({ cls: "bible-sidecar-ref-reader-titlewrap" });
		titleWrap.createDiv({
			cls: "bible-sidecar-ref-reader-title",
			text: `${reference.canon} ${reference.chapter}`,
		});
		titleWrap.createDiv({
			cls: "bible-sidecar-ref-reader-trans",
			text: this.getReferencePreviewTranslationLabel(),
		});
		return reader.createDiv({ cls: "bible-sidecar-ref-reader-body" });
	}

	private async renderBollsChapterReader(
		route: BibleProviderRoute,
		book: PreviewBibleBook,
		reference: BibleReference,
		container: HTMLElement
	): Promise<void> {
		if (typeof book.id !== "number") {
			container.setText("Could not load this Bolls chapter.");
			return;
		}
		const response = await requestUrl(
			`https://bolls.life/get-chapter/${encodeURIComponent(route.translationId)}/${book.id}/${reference.chapter}`
		);
		const chapter: PreviewBollsVerse[] = response.json;
		const body = this.createChapterReaderShell(reference, container);
		this.renderReaderVerses(
			body,
			chapter.flatMap((verse) => {
				const verseNumber = Number(verse.verse);
				if (!Number.isInteger(verseNumber)) {
					return [];
				}
				return [{ verse: verseNumber, text: this.normalizeChapterText(verse.text) }];
			})
		);
	}

	private async renderHelloAOChapterReader(
		route: BibleProviderRoute,
		book: PreviewBibleBook,
		reference: BibleReference,
		container: HTMLElement
	): Promise<void> {
		if (!book.code) {
			container.setText("Could not load this HelloAO chapter.");
			return;
		}
		const response = await requestUrl(
			`https://bible.helloao.org/api/${encodeURIComponent(route.translationId)}/${encodeURIComponent(book.code)}/${reference.chapter}.json`
		);
		const chapter: PreviewHelloAOChapter = response.json;
		const body = this.createChapterReaderShell(reference, container);
		this.renderHelloAOReaderBlocks(body, chapter);
	}

	private renderReaderVerses(container: HTMLElement, verses: ReaderVerse[]): void {
		if (!verses.length) {
			container.setText("No text found for this chapter.");
			return;
		}

		let paragraph: HTMLElement | null = null;
		let poem: HTMLElement | null = null;
		let paragraphVerses = 0;
		let quoteDepth = 0;
		const closeParagraph = () => {
			paragraph = null;
			paragraphVerses = 0;
			quoteDepth = 0;
		};

		for (const verse of verses) {
			if (!verse.text) {
				continue;
			}
			const lines = verse.text.split("\n");
			if (lines.length > 1) {
				closeParagraph();
				if (!poem) {
					poem = container.createDiv({ cls: "bible-sidecar-ref-reader-poem" });
				}
				lines.forEach((line, index) => {
					const indented = line.startsWith("\t");
					const lineEl = poem?.createDiv({
						cls: indented
							? "bible-sidecar-ref-reader-line bible-sidecar-ref-reader-line-in"
							: "bible-sidecar-ref-reader-line",
					});
					if (!lineEl) {
						return;
					}
					if (index === 0) {
						lineEl.createSpan({
							cls: "bible-sidecar-ref-reader-vn",
							text: String(verse.verse),
						});
					}
					lineEl.appendText(line.replace(/^\t+/, ""));
				});
				continue;
			}

			poem = null;
			if (!paragraph) {
				paragraph = container.createDiv({ cls: "bible-sidecar-ref-reader-p" });
			}
			paragraph.createSpan({
				cls: "bible-sidecar-ref-reader-vn",
				text: String(verse.verse),
			});
			paragraph.appendText(`${verse.text} `);
			paragraphVerses++;
			quoteDepth += (verse.text.match(/“/g) || []).length;
			quoteDepth -= (verse.text.match(/”/g) || []).length;
			if (
				paragraphVerses >= 3 &&
				/[.!?”"’)]$/.test(verse.text) &&
				(quoteDepth <= 0 || paragraphVerses >= 8)
			) {
				closeParagraph();
			}
		}
	}

	private renderHelloAOReaderBlocks(
		container: HTMLElement,
		chapter: PreviewHelloAOChapter
	): void {
		let paragraph: HTMLElement | null = null;
		let poem: HTMLElement | null = null;
		let paragraphVerses = 0;
		let quoteDepth = 0;
		let renderedVerses = 0;
		const closeParagraph = () => {
			paragraph = null;
			paragraphVerses = 0;
			quoteDepth = 0;
		};

		for (const block of chapter.chapter.content) {
			if (block.type === "heading" && block.content) {
				closeParagraph();
				poem = null;
				container.createDiv({
					cls: "bible-sidecar-ref-reader-h",
					text: this.getPreviewInlineText(block.content),
				});
				continue;
			}
			if (block.type === "hebrew_subtitle" && block.content) {
				closeParagraph();
				poem = null;
				container.createDiv({
					cls: "bible-sidecar-ref-reader-inscr",
					text: this.getPreviewInlineText(block.content),
				});
				continue;
			}
			if (block.type === "line_break") {
				closeParagraph();
				poem = null;
				container.createDiv({ cls: "bible-sidecar-ref-reader-break" });
				continue;
			}

			if (block.type !== "verse" || typeof block.number !== "number" || !block.content) {
				continue;
			}

			renderedVerses++;
			if (this.hasPoetryContent(block.content)) {
				closeParagraph();
				if (!poem) {
					poem = container.createDiv({ cls: "bible-sidecar-ref-reader-poem" });
				}
				this.appendHelloAOReaderPoetry(poem, block.number, block.content);
				continue;
			}

			poem = null;
			if (!paragraph) {
				paragraph = container.createDiv({ cls: "bible-sidecar-ref-reader-p" });
			}
			paragraph.createSpan({
				cls: "bible-sidecar-ref-reader-vn",
				text: String(block.number),
			});
			this.appendHelloAOReaderInline(paragraph, block.content);
			paragraph.appendText(" ");
			const verseText = this.getPreviewInlineText(block.content);
			paragraphVerses++;
			quoteDepth += (verseText.match(/“/g) || []).length;
			quoteDepth -= (verseText.match(/”/g) || []).length;
			if (
				paragraphVerses >= 3 &&
				/[.!?”"’)]$/.test(verseText) &&
				(quoteDepth <= 0 || paragraphVerses >= 8)
			) {
				closeParagraph();
			}
		}

		if (!renderedVerses) {
			container.setText("No text found for this chapter.");
		}
	}

	private hasPoetryContent(content: PreviewHelloAOInlineContent[]): boolean {
		return content.some((item) => {
			if (typeof item === "string") {
				return item.includes("\n");
			}
			if ("lineBreak" in item) {
				return true;
			}
			return "text" in item && typeof item.poem === "number";
		});
	}

	private appendHelloAOReaderPoetry(
		container: HTMLElement,
		verseNumber: number,
		content: PreviewHelloAOInlineContent[]
	): void {
		let line: HTMLElement | null = null;
		let verseNumberAdded = false;
		const ensureLine = (indented: boolean): HTMLElement => {
			if (!line) {
				line = container.createDiv({
					cls: indented
						? "bible-sidecar-ref-reader-line bible-sidecar-ref-reader-line-in"
						: "bible-sidecar-ref-reader-line",
				});
				if (!verseNumberAdded) {
					line.createSpan({
						cls: "bible-sidecar-ref-reader-vn",
						text: String(verseNumber),
					});
					verseNumberAdded = true;
				}
			}
			return line;
		};

		for (const item of content) {
			if (typeof item === "string") {
				ensureLine(false).appendText(item);
				continue;
			}
			if ("lineBreak" in item) {
				line = null;
				continue;
			}
			if ("noteId" in item) {
				continue;
			}
			const lineEl = ensureLine((item.poem || 0) > 1);
			if (item.wordsOfJesus) {
				lineEl.createSpan({ cls: "words-of-jesus", text: item.text });
				continue;
			}
			lineEl.appendText(item.text);
		}
	}

	private appendHelloAOReaderInline(
		container: HTMLElement,
		content: PreviewHelloAOInlineContent[]
	): void {
		for (const item of content) {
			if (typeof item === "string") {
				container.appendText(item);
				continue;
			}
			if ("lineBreak" in item) {
				container.appendChild(document.createElement("br"));
				continue;
			}
			if ("noteId" in item) {
				continue;
			}
			if (item.wordsOfJesus) {
				container.createSpan({ cls: "words-of-jesus", text: item.text });
				continue;
			}
			container.appendText(item.text);
		}
	}

	private async ensureBibleView(): Promise<BibleView | null> {
		const existingView = this.getRegisteredBibleView();
		if (existingView) {
			const leaf = this.app.workspace.getLeavesOfType(BibleViewType)[0];
			if (leaf) {
				this.app.workspace.revealLeaf(leaf);
			}
			return existingView;
		}

		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (!rightLeaf) {
			return null;
		}
		await rightLeaf.setViewState({ type: BibleViewType, active: true });
		this.app.workspace.revealLeaf(rightLeaf);
		return this.getRegisteredBibleView();
	}

	private getRegisteredBibleView(): BibleView | null {
		for (const leaf of this.app.workspace.getLeavesOfType(BibleViewType)) {
			if (leaf.view instanceof BibleView) {
				this.view = leaf.view;
				return leaf.view;
			}
		}
		this.view = undefined;
		return null;
	}

	private getReferencePreviewTranslationState(): { language: string; version: string } {
		return this.getRegisteredBibleView()?.getActiveTranslationState() ||
			this.referencePreviewSessionTranslation || {
			language: this.settings.bibleLanguage,
			version: this.settings.bibleVersion,
		};
	}

	private async setReferencePreviewTranslationState(
		next: ReferencePreviewTranslationState
	): Promise<void> {
		const normalized = this.normalizeReferencePreviewTranslationState(next);
		this.referencePreviewSessionTranslation = normalized;
		const view = this.getRegisteredBibleView();
		if (view) {
			await view.setActiveTranslationState(normalized);
		}
	}

	private normalizeReferencePreviewTranslationState(
		next: ReferencePreviewTranslationState
	): ReferencePreviewTranslationState {
		const language = this.resolveBibleLanguageKey(next.language);
		const translations = this.getBibleTranslationsForLanguage(language);
		const versionExists = translations.some(
			(translation) => translation.short_name === next.version
		);
		return {
			language,
			version: versionExists ? next.version : this.getDefaultBibleVersion(language),
		};
	}

	private getReferencePreviewTranslationLabel(): string {
		const { language, version } = this.getReferencePreviewTranslationState();
		const translation = this.getBibleTranslationsForLanguage(language).find(
			(candidate) => candidate.short_name === version
		);
		return translation ? `${translation.short_name} - ${translation.full_name}` : version;
	}

	private encodeTranslationOptionValue(state: ReferencePreviewTranslationState): string {
		return `${state.language}${TRANSLATION_OPTION_SEPARATOR}${state.version}`;
	}

	private decodeTranslationOptionValue(value: string): ReferencePreviewTranslationState | null {
		const separatorIndex = value.indexOf(TRANSLATION_OPTION_SEPARATOR);
		if (separatorIndex < 0) {
			return null;
		}
		return this.normalizeReferencePreviewTranslationState({
			language: value.slice(0, separatorIndex),
			version: value.slice(separatorIndex + TRANSLATION_OPTION_SEPARATOR.length),
		});
	}

	private async getPreviewBooks(route: BibleProviderRoute): Promise<PreviewBibleBook[]> {
		const cacheKey = `${route.provider}:${route.translationId}`;
		const cached = this.previewBooksCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const request = route.provider === "helloao"
			? this.fetchHelloAOPreviewBooks(route.translationId)
			: this.fetchBollsPreviewBooks(route.translationId);
		this.previewBooksCache.set(cacheKey, request);
		return request;
	}

	private async fetchHelloAOPreviewBooks(translationId: string): Promise<PreviewBibleBook[]> {
		const response = await requestUrl(
			`https://bible.helloao.org/api/${encodeURIComponent(translationId)}/books.json`
		);
		const payload: PreviewHelloAOBooksResponse = response.json;
		return payload.books.map((book) => ({
			id: book.id,
			code: book.id,
			name: book.name,
			chapters: book.numberOfChapters,
			order: book.order,
		}));
	}

	private async fetchBollsPreviewBooks(translationId: string): Promise<PreviewBibleBook[]> {
		const response = await requestUrl(
			`https://bolls.life/get-books/${encodeURIComponent(translationId)}`
		);
		const books: PreviewBollsBook[] = response.json;
		return books.map((book) => ({
			id: book.bookid,
			name: book.name,
			chapters: book.chapters,
			order: book.bookid,
		}));
	}

	private async renderBollsPreview(
		route: BibleProviderRoute,
		book: PreviewBibleBook,
		reference: BibleReference,
		container: HTMLElement
	): Promise<void> {
		if (typeof book.id !== "number") {
			container.setText("Could not load this Bolls passage.");
			return;
		}
		const response = await requestUrl(
			`https://bolls.life/get-chapter/${encodeURIComponent(route.translationId)}/${book.id}/${reference.chapter}`
		);
		const chapter: PreviewBollsVerse[] = response.json;
		container.empty();
		const verses = chapter.filter((verse) => this.referenceIncludesVerse(reference, Number(verse.verse)));
		this.renderPlainPreviewVerses(
			container,
			verses.map((verse) => ({ verse: verse.verse, text: this.normalizePreviewText(verse.text) }))
		);
	}

	private async renderHelloAOPreview(
		route: BibleProviderRoute,
		book: PreviewBibleBook,
		reference: BibleReference,
		container: HTMLElement
	): Promise<void> {
		if (!book.code) {
			container.setText("Could not load this HelloAO passage.");
			return;
		}
		const response = await requestUrl(
			`https://bible.helloao.org/api/${encodeURIComponent(route.translationId)}/${encodeURIComponent(book.code)}/${reference.chapter}.json`
		);
		const chapter: PreviewHelloAOChapter = response.json;
		const verses = chapter.chapter.content.flatMap((block) => {
			if (
				block.type !== "verse" ||
				typeof block.number !== "number" ||
				!block.content ||
				!this.referenceIncludesVerse(reference, block.number)
			) {
				return [];
			}
			return [{ verse: String(block.number), text: this.getPreviewInlineText(block.content) }];
		});
		container.empty();
		this.renderPlainPreviewVerses(container, verses);
	}

	private renderPlainPreviewVerses(
		container: HTMLElement,
		verses: Array<{ verse: string; text: string }>
	): void {
		if (!verses.length) {
			container.setText("No text found for this reference.");
			return;
		}

		for (const verse of verses) {
			const verseEl = container.createSpan({ cls: "bible-sidecar-preview-verse" });
			verseEl.createEl("sup", {
				text: verse.verse,
				cls: "bible-sidecar-preview-verse-number",
			});
			verseEl.appendChild(document.createTextNode(" "));
			verseEl.appendChild(document.createTextNode(verse.text));
			container.appendChild(document.createTextNode(" "));
		}
	}

	private referenceIncludesVerse(reference: BibleReference, verseNumber: number): boolean {
		if (!Number.isInteger(verseNumber)) {
			return false;
		}
		if (reference.vStart === null) {
			return true;
		}
		const rangeEnd = reference.vEnd === null ? reference.vStart : reference.vEnd;
		const first = Math.min(reference.vStart, rangeEnd);
		const last = Math.max(reference.vStart, rangeEnd);
		return verseNumber >= first && verseNumber <= last;
	}

	private normalizePreviewText(text: string): string {
		return text
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?(?:i|b)>/gi, "")
			.replace(/<[^>]+>/g, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	private normalizeChapterText(text: string): string {
		return text
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?(?:i|b)>/gi, "")
			.replace(/<[^>]+>/g, "")
			.split("\n")
			.map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
			.join("\n")
			.trim();
	}

	private getPreviewInlineText(content: PreviewHelloAOInlineContent[]): string {
		return content
			.map((item) => {
				if (typeof item === "string") {
					return item;
				}
				if ("text" in item) {
					return item.text;
				}
				return "lineBreak" in item ? "\n" : " ";
			})
			.join("")
			.replace(/[ \t]+/g, " ")
			.replace(/\s+([,.;:!?])/g, "$1")
			.trim();
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		const bibleLanguage = data?.bibleLanguage || DEFAULT_SETTINGS.bibleLanguage;
		const defaultVersion = bibleLanguage && LANGUAGE_DEFAULT_VERSIONS[bibleLanguage]
			? LANGUAGE_DEFAULT_VERSIONS[bibleLanguage]
			: LANGUAGE_DEFAULT_VERSIONS.en;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data, {
			bibleLanguage,
			bibleVersion: data?.bibleVersion || defaultVersion,
		});
	}

	async loadBollsCatalog(): Promise<void> {
		try {
			const response = await requestUrl(BOLLS_CATALOG_URL);
			this.bollsCatalog = Array.isArray(response.json) ? response.json : [];
			this.bollsCatalogLoadError = null;
		} catch (error) {
			console.warn("Bible Sidecar: failed to load Bolls catalog", error);
			this.bollsCatalog = [];
			this.bollsCatalogLoadError = error instanceof Error ? error.message : String(error);
		}
	}

	async loadHelloAOCatalog(): Promise<void> {
		try {
			const response = await requestUrl(HELLO_AO_CATALOG_URL);
			const catalog: HelloAOCatalog = response.json;
			this.helloAOCatalog = Array.isArray(catalog.translations)
				? catalog.translations
				: [];
			this.helloAOCatalogLoadError = null;
		} catch (error) {
			console.warn("Bible Sidecar: failed to load HelloAO catalog", error);
			this.helloAOCatalog = [];
			this.helloAOCatalogLoadError = error instanceof Error ? error.message : String(error);
		}
	}

	private buildMergedCatalog(): void {
		const groups = new Map<string, NormalizedBibleLanguageGroup>();
		const helloById = new Map(
			this.helloAOCatalog.map((translation) => [translation.id, translation])
		);

		const ensureGroup = (key: string, label: string, bollsLanguage?: string) => {
			const existing = groups.get(key);
			if (existing) {
				if (bollsLanguage) {
					existing.bollsLanguage = bollsLanguage;
				}
				return existing;
			}

			const group: NormalizedBibleLanguageGroup = {
				key,
				label,
				bollsLanguage,
				translations: [],
			};
			groups.set(key, group);
			return group;
		};

		for (const bollsGroup of this.bollsCatalog) {
			const languageKey = this.getBollsLanguageKey(bollsGroup.language);
			const group = ensureGroup(languageKey, bollsGroup.language, bollsGroup.language);

			for (const bollsTranslation of bollsGroup.translations) {
				const helloTranslation = this.findMatchingHelloAOTranslation(
					bollsTranslation,
					languageKey,
					helloById
				);
				group.translations.push({
					short_name: bollsTranslation.short_name,
					full_name: bollsTranslation.full_name,
					bollsTranslationId: bollsTranslation.short_name,
					helloAOTranslationId: helloTranslation?.id,
				});
			}
		}

		for (const helloTranslation of this.helloAOCatalog) {
			const languageKey = this.getHelloAOLanguageKey(helloTranslation.language);
			const label = this.getHelloAOLanguageLabel(helloTranslation);
			const group = ensureGroup(languageKey, label);
			const existing = group.translations.find(
				(translation) => translation.helloAOTranslationId === helloTranslation.id
			);
			if (existing) {
				continue;
			}

			const hasShortNameCollision = group.translations.some(
				(translation) => translation.short_name === helloTranslation.shortName
			);
			group.translations.push({
				short_name: hasShortNameCollision ? helloTranslation.id : helloTranslation.shortName,
				full_name: helloTranslation.name,
				helloAOTranslationId: helloTranslation.id,
			});
		}

		for (const group of groups.values()) {
			group.translations.sort((a, b) => a.short_name.localeCompare(b.short_name));
		}

		this.mergedCatalog = [...groups.values()].sort((a, b) =>
			a.label.localeCompare(b.label)
		);
	}

	private getBollsLanguageKey(language: string): string {
		const legacyLanguage = Object.entries(LEGACY_LANGUAGE_KEYS).find(
			([, bollsLanguage]) => bollsLanguage === language
		)?.[0];
		return legacyLanguage || `bolls:${normalizeForComparison(language)}`;
	}

	private getHelloAOLanguageKey(language: string): string {
		return HELLO_AO_LANGUAGE_KEYS[language.toLocaleLowerCase()] || `hello:${language}`;
	}

	private getHelloAOLanguageLabel(translation: HelloAOTranslation): string {
		if (translation.languageName === translation.languageEnglishName) {
			return translation.languageName;
		}
		return `${translation.languageEnglishName} | ${translation.languageName}`;
	}

	private findMatchingHelloAOTranslation(
		bollsTranslation: BollsTranslation,
		languageKey: string,
		helloById: Map<string, HelloAOTranslation>
	): HelloAOTranslation | undefined {
		if (BOLLS_ONLY_VERSION_CODES.has(bollsTranslation.short_name)) {
			return undefined;
		}

		const alias = HELLO_AO_SAFE_ALIASES[bollsTranslation.short_name];
		if (alias) {
			return helloById.get(alias);
		}

		const languageTranslations = this.helloAOCatalog.filter(
			(translation) => this.getHelloAOLanguageKey(translation.language) === languageKey
		);
		const shortNameMatches = languageTranslations.filter(
			(translation) => translation.shortName === bollsTranslation.short_name
		);
		if (shortNameMatches.length === 1) {
			return shortNameMatches[0];
		}

		const normalizedBollsName = normalizeForComparison(bollsTranslation.full_name);
		const nameMatches = languageTranslations.filter(
			(translation) =>
				normalizeForComparison(translation.name) === normalizedBollsName ||
				normalizeForComparison(translation.englishName) === normalizedBollsName
		);
		return nameMatches.length === 1 ? nameMatches[0] : undefined;
	}

	getBibleLanguageOptions(): { key: string; label: string }[] {
		return this.mergedCatalog.map(({ key, label }) => ({ key, label }));
	}

	getBibleViewLanguageOptions(): BibleLanguageOption[] {
		return this.getBibleLanguageOptions().map((language) => ({
			code: language.key,
			label: language.label,
		}));
	}

	resolveBibleLanguageKey(language: string): string {
		if (this.mergedCatalog.some((group) => group.key === language)) {
			return language;
		}

		const legacyBollsLanguage = LEGACY_LANGUAGE_KEYS[language];
		const bollsGroup = this.mergedCatalog.find(
			(group) => group.bollsLanguage === legacyBollsLanguage
		);
		return bollsGroup?.key || language;
	}

	getBibleTranslationsForLanguage(language: string): BibleTranslationChoice[] {
		const languageKey = this.resolveBibleLanguageKey(language);
		return this.mergedCatalog.find((group) => group.key === languageKey)?.translations || [];
	}

	getDefaultBibleVersion(language: string): string {
		const languageKey = this.resolveBibleLanguageKey(language);
		const legacyDefault = LANGUAGE_DEFAULT_VERSIONS[language] || LANGUAGE_DEFAULT_VERSIONS[languageKey];
		const translations = this.getBibleTranslationsForLanguage(languageKey);
		if (legacyDefault && translations.some((translation) => translation.short_name === legacyDefault)) {
			return legacyDefault;
		}
		return translations[0]?.short_name || legacyDefault || LANGUAGE_DEFAULT_VERSIONS.en;
	}

	public resolveBibleProvider(language: string, version: string): BibleProviderRoute {
		const languageKey = this.resolveBibleLanguageKey(language);
		const translation = this.mergedCatalog
			.find((group) => group.key === languageKey)
			?.translations.find((candidate) => candidate.short_name === version);

		if (translation?.helloAOTranslationId) {
			return { provider: "helloao", translationId: translation.helloAOTranslationId };
		}
		return {
			provider: "bolls",
			translationId: translation?.bollsTranslationId || version,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.updateBibleViewSettings(this.settings);
	}
}
