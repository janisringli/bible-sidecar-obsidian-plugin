import {
	Plugin,
	requestUrl,
	WorkspaceLeaf,
} from "obsidian";
import { BibleView, BibleViewType } from "BibleView";
import { BibleSidecarSettingsTab } from "./settings";

interface BibleSidecarSettings {
	bibleVersion: string;
	copyFormat: string;
	copyVerseReference: boolean;
	verseReferenceStyle: string;
	verseReferenceFormat: string;
	verseReferenceInternalLinking: boolean;
	verseReferenceInternalLinkingFormat: string;
	bibleLanguage: string;
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

const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "NLT",
	copyFormat: "plain",
	copyVerseReference: false,
	verseReferenceStyle: "- ",
	verseReferenceFormat: "full",
	verseReferenceInternalLinking: false,
	verseReferenceInternalLinkingFormat: "short",
	bibleLanguage: "en",
};

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

export default class BibleSidecarPlugin extends Plugin {
	settings: BibleSidecarSettings;
	private view: BibleView | undefined;
	bollsCatalog: BollsLanguageGroup[] = [];
	bollsCatalogLoadError: string | null = null;

	async onload() {
		await this.loadSettings();
		await this.loadBollsCatalog();

		this.addSettingTab(new BibleSidecarSettingsTab(this.app, this));

		this.registerView(
			BibleViewType,
			(leaf: WorkspaceLeaf) => {
				const view = new BibleView(leaf);
				this.view = view;
				view.settings = this.settings;
				return view;
			}
		);

		this.addRibbonIcon(
			"book-open-text",
			"Bible Sidecar",
			(evt: MouseEvent) => {
				this.toggleBibleSidecarView();
			}
		);

		this.addCommand({
			id: "open-bible-sidecar",
			name: "Open Bible Sidecar",
			callback: this.toggleBibleSidecarView,
			icon: "book-open-text",
		});

		this.initLeaf();
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
			return;
		}
	}

	updateBibleViewSettings = (newSettings: BibleSidecarSettings) => {
		if (this.view) {
			this.view.updateSettings(newSettings);
		}
	};

	async loadSettings() {
		await this.loadData().then((data) => {
			const bibleLanguage = data?.bibleLanguage || DEFAULT_SETTINGS.bibleLanguage;
			const defaultVersion = bibleLanguage && LANGUAGE_DEFAULT_VERSIONS[bibleLanguage]
				? LANGUAGE_DEFAULT_VERSIONS[bibleLanguage]
				: LANGUAGE_DEFAULT_VERSIONS["en"];
			this.settings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				data,
				{
					bibleLanguage,
					bibleVersion: data?.bibleVersion || defaultVersion,
				}
			);
		});
	}

	async loadBollsCatalog() {
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

	getBibleLanguageOptions() {
		return this.bollsCatalog
			.map((group) => ({
				key: group.language,
				label: group.language,
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	}

	resolveBibleLanguageKey(language: string) {
		const bollsLanguage = LEGACY_LANGUAGE_KEYS[language] || language;
		return this.bollsCatalog.some((group) => group.language === bollsLanguage)
			? bollsLanguage
			: language;
	}

	getBibleTranslationsForLanguage(language: string) {
		const languageKey = this.resolveBibleLanguageKey(language);
		return [
			...(this.bollsCatalog.find((group) => group.language === languageKey)?.translations || []),
		].sort((a, b) => a.short_name.localeCompare(b.short_name));
	}

	getDefaultBibleVersion(language: string) {
		const legacyDefault = LANGUAGE_DEFAULT_VERSIONS[language];
		const translations = this.getBibleTranslationsForLanguage(language);
		if (legacyDefault && translations.some((translation) => translation.short_name === legacyDefault)) {
			return legacyDefault;
		}
		return translations[0]?.short_name || legacyDefault || LANGUAGE_DEFAULT_VERSIONS["en"];
	}

	async saveSettings() {
		await this.saveData(this.settings);
		console.log("Saved settings", this.settings);
		this.updateBibleViewSettings(this.settings);
	}
}
