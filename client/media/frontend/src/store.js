import { reactive } from 'vue'

export const store = reactive({
  localConfig: {
		"wiki.theme": "auto",
		"wiki.calculatedTheme": "",
		"wiki.unfold_wiki_link": false,
		"wiki.nowrap_wiki_table": false,
		"wiki.hide_heading_content": false,
		"wiki.show_folding": false,
		"wiki.disable_folding_animation": false,
		"wiki.strike": "show",
		"wiki.image_hide": "show",
		"wiki.disable_image_lazy": false,
		"wiki.category_position": "top",
		"page.title": "",
		"page.content": "",
		"page.categories": [],
		"page.userbox": { parameterAlert: {}, editorComment: false },
		"page.key": 0,
		"page.referenced": [],
		"page.parameterMap": null
  },
  localConfigSetValue(key, value) {
		if (value === undefined || value === null) return;
    this.localConfig[key] = value
		
		const preservableConfig = Object.fromEntries(
			Object.entries(this.localConfig).filter(([key, value]) => key.startsWith('wiki.'))
		);
		vscode.postMessage({
			command: "updatePreviewSetting",
			value: JSON.stringify(preservableConfig)
		})
  },
	localConfigMapSetValue(map = {}) {
		for (const [key, value] of Object.entries(map)) {
			if (value === undefined || value === null) continue;
			this.localConfig[key] = value
		}

		const preservableConfig = Object.fromEntries(
			Object.entries(this.localConfig).filter(([key, value]) => key.startsWith('wiki.'))
		);
		vscode.postMessage({
			command: "updatePreviewSetting",
			value: JSON.stringify(preservableConfig)
		})
	}
})