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
		containerEl.createEl("h2", { text: "Bible Sidecar Settings" });
		new Setting(containerEl)
			.setName("Default Bible Version")
			.setDesc("Choose your preferred Bible version")
			.addDropdown((dropdown: any) => {
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
                dropdown
					.setValue(this.plugin.settings.bibleVersion)
					.onChange((value: any) => {
						this.plugin.settings.bibleVersion = value;
						this.plugin.saveSettings();
					});
			});
			//containerEl.createEl("h3", { text: "Format Options" });
	}
	
}
