import { markRaw } from 'vue';
import { defineStore } from 'pinia'

import Skin from 'skin/layout'

export const useStateStore = defineStore('state', {
  state() {
    return {
      components: {
        mainView: null
      },
      thetreePlugins: {
        editor: []
      },

      config: {},
      configHash: '',
      session: {},
      sessionHash: '',

      localConfig: {},
      localConfigInitialized: false,
      page: {
        data: {}
      },
      viewData: {},

      skin: {}
    }
  },
  actions: {
    parseResponse(json) {
      const statePatches = {}
      if(json.page) {
        Object.assign(statePatches, {
          page: {
            ...json.page,
            data: json.data.publicData
          },
          viewData: {
            ...json.data,
            ...json.data.publicData
          }
        })
      }

      return statePatches
    },
    patchPageData(statePatches) {
      this.$patch(state => {
        state.page = statePatches.page
        state.viewData = statePatches.viewData
      })
    },
    patchPartialPageData(json) {
      this.clearFormErrors()

      this.$patch(state => {
        state.page.data = {
          ...state.page.data,
          ...json.publicData
        }
        state.viewData = {
          ...state.viewData,
          ...json.viewData
        }
      })
    },
    async updateView(statePatches) {
      this.components.mainView.loadingView = true

      const contentName = statePatches ? statePatches.page.contentName : this.page.contentName
      if(!contentName) {
        if(statePatches) this.patchPageData(statePatches)
        this.viewData.viewComponent = null
        this.components.mainView.skin ??= markRaw(Skin)
        this.components.mainView.$refs.progressBar?.finish()
        return
      }
      
      let view = await import(`@/views/contents/wiki.vue`)

      if(view) {
        if(statePatches) this.patchPageData(statePatches)
        this.viewData.viewComponent = markRaw(view.default)
        this.page.contentHtml = null
      }
      else {
        this.page.title = '오류'
        this.page.contentHtml = `missing view ${contentName}`
      }
      this.components.mainView.skin ??= markRaw(Skin)
      this.components.mainView.loadingView = false

      this.cleanViewData()
      this.components.mainView.$refs.progressBar?.finish()
    },
    cleanViewData() {
      this.clearFormErrors()
      this.components.mainView.beforeLeave = null
    },
    clearFormErrors() {
      this.viewData.errorAlert = this.viewData.alert ?? null
      this.viewData.fieldErrors = null
    },
    localConfigSetValue(key, value) {
      this.localConfig[key] = value
      localStorage.setItem('thetree_settings', JSON.stringify(this.localConfig))
    },
    skinSetValue(key, value) {
      this.skin[key] = value
    }
  },
  getters: {
    currentTheme() {
      if(import.meta.env.SSR)
        return 'light'

      const theme = this.localConfig['wiki.theme']
      if(!theme || theme === 'auto')
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      return theme
    }
  }
})
