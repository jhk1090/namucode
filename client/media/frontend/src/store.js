import { reactive } from 'vue'

export const store = reactive({
  localConfig: {
		"wiki.theme": "auto",
		"wiki.unfold_wiki_link": false,
		"wiki.nowrap_wiki_table": false,
		"wiki.hide_heading_content": false,
		"wiki.show_folding": false,
		"wiki.disable_folding_animation": false,
		"wiki.strike": "show",
		"wiki.image_hide": "show",
		"wiki.disable_image_lazy": false,
		"wiki.category_position": "top"
  },
  
  localConfigSetValue(key, value) {
    this.localConfig[key] = value
    localStorage.setItem('localConfig', JSON.stringify(this.localConfig))
  }
})