<template>
  <WikiContent :content="content" :categories="categories" />
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
    window.addEventListener("message", e => {
      if (e.data.type === 'updateContent')
        this.content = e.data.newContent
    })
  }
}
</script>