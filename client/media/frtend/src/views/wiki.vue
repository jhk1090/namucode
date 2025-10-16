<template>
  <WikiContent ref="wikiContent" :value="content" :categories="categories" />
</template>
<script>
import Common from '@/mixins/common'
import WikiContent from '@/components/wiki/wikiContent';

export default {
  mixins: [Common],
  components: {
    WikiContent
  },
  computed: {
    content() {
      return ""
    },
    categories() {
      return []
    }
  },
  mounted() {
    window.addEventListener("message", this.handleMessage)
  },
  unmounted() {
    window.removeEventListener("message", this.handleMessage)
  },
  methods: {
    handleMessage(e) {
      if (e.data.type === 'updateContent')
        this.$refs.wikiContent.updateContent(e.data.newContent)
    }
  }
}
</script>