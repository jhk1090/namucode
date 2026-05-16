<template>
  <a href="#" class="dropdown-item" @click.prevent="openSettingModal">설정</a>
  <div ref="wikiContentContainer">
    <div class="title">
      <h1 ref="title" />
    </div>
    <WikiContent ref="wikiContent" />
    <ModalsContainer/>
  </div>
</template>
<script>
import Common from '@/mixins/common'
import WikiContent from '@/components/wiki/wikiContent';
import SettingModal from "@/components/setting";

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
      if (e.data.type === 'updateTitle') {
        this.$refs.title.innerText = e.data.title
      }
      if (e.data.type === 'updateContent') {
        if (e.data.newContent !== undefined) this.$refs.wikiContent.updateContent(e.data.newContent)
        if (e.data.newCategories !== undefined) this.$refs.wikiContent.updateCategories(e.data.newCategories)
        if (e.data.newUserbox !== undefined) this.$refs.wikiContent.updateUserbox(e.data.newUserbox)
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
    },
    openSettingModal() {
      this.$vfm.show({ component: SettingModal });
    }
  }
}
</script>