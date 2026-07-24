import {
	Plugin,
	requestUrl,
	WorkspaceLeaf,
} from "obsidian";
import { BibleView, BibleViewType } from "BibleView";
import type { BibleProviderRoute } from "BibleView";
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
	showFootnotes: boolean;
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
		}
	}

	updateBibleViewSettings = (newSettings: BibleSidecarSettings): void => {
		if (this.view) {
			this.view.updateSettings(newSettings);
		}
	};

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
