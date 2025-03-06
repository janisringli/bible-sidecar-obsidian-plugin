import BibleSidecarPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class BibleSidecarSettingsTab extends PluginSettingTab {
	plugin: BibleSidecarPlugin;
	containerEl: HTMLElement; // Add containerEl property
	constructor(app: App, plugin: BibleSidecarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty(); // Clear the container if it's not empty
		new Setting(containerEl)
			.setName("Bible language").setHeading()
			.setDesc("Choose your preferred Bible language")
			.addDropdown((dropdown: any) => {
				dropdown.addOption("en", "English | English");
				dropdown.addOption("es", "Spanish | Español");
				dropdown.addOption("fr", "French | Français");
				dropdown.addOption("de", "German | Deutsch");
				dropdown.addOption("pt", "Portuguese | Português");
				dropdown.addOption("it", "Italian | Italiano");
				dropdown.addOption("nl", "Dutch | Nederlands");
				dropdown.addOption("ar", "Arabic | العربية");
				dropdown.addOption("ru", "Russian | Русский");
			dropdown
				.setValue(this.plugin.settings.bibleLanguage)
				.onChange((value: any) => {
					this.plugin.settings.bibleLanguage = value;
					this.plugin.saveSettings();
					this.display();
				});
			}
			);
		new Setting(containerEl)
			.setName("Default bible version")
			.setDesc("Choose your preferred Bible version")
			.addDropdown((dropdown: any) => {
				if(this.plugin.settings.bibleLanguage === "en"){
				// add translations
				dropdown.addOption("YLT", "Young's Literal Translation (1898)");
				dropdown.addOption(
					"KJV",
					"King James Version 1769 with Apocrypha"
				);
				dropdown.addOption("NKJV", "New King James Version, 1982");
				dropdown.addOption("WEB", "World English Bible");
				dropdown.addOption("RSV", "Revised Standard Version (1952)");
				dropdown.addOption("CJB", "The Complete Jewish Bible (1998)");
				dropdown.addOption("TS2009", "The Scriptures 2009");
				dropdown.addOption(
					"LXXE",
					"English version of the Septuagint Bible, 1851"
				);
				dropdown.addOption("TLV", "Tree of Life Version");
				dropdown.addOption("LSB", "The Legacy Standard Bible");
				dropdown.addOption(
					"NASB",
					"New American Standard Bible (1995)"
				);
				dropdown.addOption(
					"ESV",
					"English Standard Version 2001, 2016"
				);
				dropdown.addOption("GNV", "Geneva Bible (1599)");
				dropdown.addOption("DRB", "Douay Rheims Bible");
				dropdown.addOption(
					"NIV2011",
					"New International Version, 2011"
				);
				dropdown.addOption("NIV", "New International Version, 1984");
				dropdown.addOption("NLT", "New Living Translation, 2015");
				dropdown.addOption(
					"NRSVCE",
					"New Revised Standard Version Catholic Edition, 1993"
				);
				dropdown.addOption("NET", "New English Translation, 2007");
				dropdown.addOption("NJB1985", "New Jerusalem Bible, 1985");
				dropdown.addOption(
					"SPE",
					"Samaritan Pentateuch in English, 2013"
				);
				dropdown.addOption(
					"LBP",
					"Aramaic Of The Peshitta: Lamsa, 1933"
				);
				dropdown.addOption("AMP", "Amplified Bible, 2015");
				dropdown.addOption("MSG", "The Message, 2002");
				dropdown.addOption("LSV", "Literal Standard Version");
				dropdown.addOption(
					"BSB",
					"The Holy Bible, Berean Standard Bible"
				);
			}
			if(this.plugin.settings.bibleLanguage === "de"){
				dropdown.addOption("MB", "Menge Bibel");
				dropdown.addOption("ELB", "Elberfelder Bibel 1871");
				dropdown.addOption("SCH", "Schlachter 1951");
				dropdown.addOption("LUT", "Lutherbibel 1912");
			}
			if(this.plugin.settings.bibleLanguage === "fr"){
				dropdown.addOption("NBS", "Nouvelle Bible Segond 2002");
			}
			if(this.plugin.settings.bibleLanguage === "es"){
				dropdown.addOption("BTX3", "Biblia Textual 3ra Edicion");
				dropdown.addOption("RVR1960", "Reina-Valera 1960");
				dropdown.addOption("RV2004", "Reina-Valera 2004");
				dropdown.addOption("PDT", "Palabra de Dios para Todos");
				dropdown.addOption("NVI", "Nueva Versión Internacional");
				dropdown.addOption("NTV", "Nueva Traducción Viviente 2009");
				dropdown.addOption("LBLA", "La Biblia de las Américas 1997");
			}
			if(this.plugin.settings.bibleLanguage === "pt"){
				dropdown.addOption("ARA", "Almeida Revista e Atualizada 1993");
				dropdown.addOption("NTJud", "Novo Testamento Judaico");
				dropdown.addOption("NVIPT", "Nova Versão Internacional");
				dropdown.addOption("OL", "O Livro");
				dropdown.addOption("NVT", "Nova Versão Transformadora 2016");
				dropdown.addOption("KJA", "King James Atualizada");
				dropdown.addOption("VFL", "Bíblia Sagrada Versão Fácil de Ler");
				dropdown.addOption("NAA", "Nova Almeida Atualizada 2017");
				dropdown.addOption("CNBB", "Bíblia CNBB (Nova Capa) 2002");
				dropdown.addOption("NBV07", "Nova Bíblia Viva 2007");
				dropdown.addOption("ALM21", "Bíblia Almeida Século 21");
				dropdown.addOption("ARC09", "Almeida Revista e Corrigida 2009");
				dropdown.addOption("AFC11", "Almeida Fiel Corrigida 2011");
			}
			if(this.plugin.settings.bibleLanguage === "it"){
				dropdown.addOption("NR06", "Nuova Riveduta 2006");
				dropdown.addOption("VULG", "Biblia Sacra Vulgatam Clementinam");
			}
			if(this.plugin.settings.bibleLanguage === "nl"){
			dropdown.addOption("NLD", "De Heilige Schrift, Canisiusvertaling 1939");
			dropdown.addOption("DSV", "Statenvertaling met Stong's 1619");
			dropdown.addOption("SVRJ", "Statenvertaling Jongbloed-editie 1995");
			dropdown.addOption("HSV17", "Herziene Statenvertaling 2017");
			}
			if(this.plugin.settings.bibleLanguage === "ru"){
			dropdown.addOption("JNT", "Иудейская Новый Завет");
			dropdown.addOption("NRT", "Новый Русский Перевод");
			dropdown.addOption("SYNOD", "Синодальный перевод");
			dropdown.addOption("TNHR", "Невиим и Ктувим");
			dropdown.addOption("RBS2", "Русский Синодальный перевод 2015");
			dropdown.addOption("BTI", "Библия Тихого Океана 2015");
			}
			if(this.plugin.settings.bibleLanguage === "ar"){
			dropdown.addOption("SVD", "Smith & Van Dyke");
			}


				dropdown
					.setValue(this.plugin.settings.bibleVersion)
					.onChange((value: any) => {
						this.plugin.settings.bibleVersion = value;
						this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Copy format").setHeading()
			.setDesc("Choose how you want the Bible text to be copied")
			.addDropdown((dropdown: any) => {
				dropdown.addOption("plain", "Plain text");
				dropdown.addOption("callout", "Callout");
				dropdown
					.setValue(this.plugin.settings.copyFormat)
					.onChange((value: string) => {
						this.plugin.settings.copyFormat = value;
						this.plugin.saveSettings();
					});
			})
		new Setting(containerEl)
			.setName("Reference format").setHeading()
			.setDesc("Include the verse reference when copying")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.copyVerseReference)
					.onChange((value) => {
						this.plugin.settings.copyVerseReference = value;
						this.plugin.saveSettings();

						// Show/hide the "Verse Reference Format" setting based on the toggle value
						verseReferenceListSetting.settingEl.style.display =
							value ? "block" : "none";
						verseReferenceFormatSetting.settingEl.style.display =
							value ? "block" : "none";
						verseReferenceInternalLinkingSetting.settingEl.style.display =
							value ? "block" : "none";
							this.display();
					});
					
			});
			

		// Create the "Verse Reference Format" setting, but initially hide it
		const verseReferenceListSetting = new Setting(containerEl)
			.setName("Verse reference format")
			.setDesc("Choose the style of the verse reference")
			.addDropdown((dropdown) => {
				dropdown.addOption("- ", "List (-)");
				dropdown.addOption(">", "Callout (>)");
				dropdown.addOption("-- ", "Double Dash (--)");
				dropdown.addOption("~", "Tilde (~)");
				dropdown
					.setValue(this.plugin.settings.verseReferenceStyle)
					.onChange((value) => {
						this.plugin.settings.verseReferenceStyle = value;
						this.plugin.saveSettings();
					});
			});
			const verseReferenceFormatSetting = new Setting(containerEl)
			.setName("Verse reference format")
			.setDesc("Choose the format of the verse reference")
			.addDropdown((dropdown) => {
				dropdown.addOption("full", "Full (e.g. John 3:16)");
				//TODO: Figure out a way to make this possible from the api side of things:
				// dropdown.addOption("medium", "Medium (e.g. Jn 3:16)");
				dropdown.addOption("short", "Short (e.g. 1:1)");
				dropdown
					.setValue(this.plugin.settings.verseReferenceFormat)
					.onChange((value) => {
						this.plugin.settings.verseReferenceFormat = value;
						this.plugin.saveSettings();
					});
			}
			);
			const verseReferenceInternalLinkingSetting = new Setting(containerEl)
			.setName("Enable internal linking eg. [[John]]")
			.setDesc("Choose the format of the verse reference")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.verseReferenceInternalLinking)
					.onChange((value) => {
						this.plugin.settings.verseReferenceInternalLinking = value;
						this.plugin.saveSettings();
						verseReferenceInternalLinkingFormatSetting.settingEl.style.display =
							value ? "block" : "none";
							this.display();
					});
			}
			);
			const verseReferenceInternalLinkingFormatSetting = new Setting(containerEl)
			.setName("Choose linking format")
			.setDesc("Choose the format of the verse reference")
			.addDropdown((dropdown) => {
				dropdown.addOption("full", "Full (e.g. [[John 3:16]])");
				dropdown.addOption("medium", "Medium (e.g. [[John 3]]:16)");
				dropdown.addOption("short", "Short (e.g. [[John]] 3:16)");
				dropdown
					.setValue(this.plugin.settings.verseReferenceInternalLinkingFormat)
					.onChange((value) => {
						this.plugin.settings.verseReferenceInternalLinkingFormat = value;
						this.plugin.saveSettings
			}

			);
		});

		// Hide the "Verse Reference Format" setting initially
		if (!this.plugin.settings.copyVerseReference) {
			verseReferenceListSetting.settingEl.style.display = "none";
			verseReferenceFormatSetting.settingEl.style.display = "none";
			verseReferenceInternalLinkingSetting.settingEl.style.display = "none";
		}
		if(!this.plugin.settings.verseReferenceInternalLinking){
			verseReferenceInternalLinkingFormatSetting.settingEl.style.display = "none";
		}
		
	}
}
