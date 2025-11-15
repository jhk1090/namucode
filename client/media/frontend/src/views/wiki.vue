<template>
  <div ref="wikiContentContainer">
    <WikiContent ref="wikiContent" />
  </div>
</template>
<script>
import Common from '@/mixins/common'
import WikiContent from '@/components/wiki/wikiContent';

export default {
  mixins: [Common],
  components: {
    WikiContent
  },
  mounted() {
    window.addEventListener("message", this.handleMessage)
  },
  unmounted() {
    window.removeEventListener("message", this.handleMessage)
  },
  methods: {
    handleMessage(e) {
      if (e.data.type === 'updateContent') {
        if (e.data.newContent) this.$refs.wikiContent.updateContent(e.data.newContent)
        if (e.data.newCategories) this.$refs.wikiContent.updateCategories(e.data.newCategories)
        if (e.data.newUserbox) this.$refs.wikiContent.updateUserbox(e.data.newUserbox)
      }
      if (e.data.type === 'updateTheme') {
        if (e.data.themeKind === "dark") {
          this.$refs.wikiContentContainer.classList.remove("theseed-light-mode")
          this.$refs.wikiContentContainer.classList.add("theseed-dark-mode")
        }
        else {
          this.$refs.wikiContentContainer.classList.add("theseed-light-mode")
          this.$refs.wikiContentContainer.classList.remove("theseed-dark-mode")
        }
      }
    }
  }
}
</script>