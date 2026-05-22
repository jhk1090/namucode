<template>
  <div ref="root" class="content-container">
    <LibertySkin />
  </div>
</template>

<script>
import LibertySkin from "@/skins/liberty/layout.vue"
import { store } from '@/store.js';

export default {
  name: 'App',
  components: {
    LibertySkin
  },
  mounted() {
    window.addEventListener("message", this.handleMessage)
  },
  unmounted() {
    window.removeEventListener("message", this.handleMessage)
  },
  methods: {
    handleMessage(e) {
      if (e.data.type === 'updateTitle') {
        store.localConfigSetValue("page.title", e.data.title)
      }
      if (e.data.type === 'updateContent') {
        store.localConfigMapSetValue(
          {
            "page.content": e.data.newContent,
            "page.categories": e.data.newCategories,
            "page.userbox": e.data.newUserbox,
            "page.key": e.data.newKey
          }
        )
      }
      if (e.data.type === 'updateTheme') {
        let finalTheme = e.data.themeKind;
        if (finalTheme === 'auto') {
          const isBodyDark = document.body.classList.contains("vscode-dark");
          finalTheme = isBodyDark ? 'dark' : 'light';
        }

        store.localConfigMapSetValue(
          {
            "wiki.calculatedTheme": finalTheme,
            "wiki.theme": e.data.themeKind
          }
        )

        if (finalTheme === 'dark') {
          this.$refs.root.classList.remove("theseed-light-mode");
          this.$refs.root.classList.add("theseed-dark-mode");
        } else {
          this.$refs.root.classList.add("theseed-light-mode");
          this.$refs.root.classList.remove("theseed-dark-mode");
        }
      }
      if (e.data.type === "updateReferenced") {
        store.localConfigSetValue("page.referenced", e.data.referenced)
      }
      if (e.data.type === "updateParameterMap") {
        store.localConfigSetValue("page.parameterMap", e.data.parameterMap)
      }
    }
  },
  provide() {
    return {
      triggerHandleMessage: this.handleMessage
    }
  }
}
</script>

<style>
@import '@/assets/css/ionicons.min.css';
@import '@/assets/css/default.css';
@import '@/assets/css/wiki.css';
@import '@/assets/css/github.min.css';
@import '@/assets/css/github-dark-dimmed.min.css';
@import '@/assets/css/katex.min.css';

@import 'floating-vue/dist/style.css';
</style>