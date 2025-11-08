<template>
  <div ref="el" class="category" :class="{ 'category-folded': isFold }">
    <span>분류</span>
    <ul>
      <template v-for="c in categories">
        <li :class="{ blur: c.blur }">
          <a :class="{ 'not-exist': c.notExist }" :href="c.domain + doc_action_link(c.document, 'w')">{{c.document}}</a>
        </li>
      </template>
    </ul>
    <div v-if="showCurtain" class="curtain">
      <GeneralButton class="curtain-button" :whenClick="onClickUnfoldButton">더 보기</GeneralButton>
    </div>
  </div>
</template>
<script>
import GeneralButton from '@/components/generalButton'

import Common from '@/mixins/common'

export default {
  mixins: [Common],
  components: {
    GeneralButton
  },
  props: {
    categories: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      isFold: true,
      showCurtain: false
    }
  },
  methods: {
    onClickUnfoldButton() {
      this.isFold = false
      this.showCurtain = false
    },
    async recalculate() {
      this.isFold = true
      this.showCurtain = false
      await this.$nextTick()
      const el = this.$refs.el
      if(!el) return

      this.showCurtain = el.scrollHeight > el.clientHeight
    }
  },
  mounted() {
    this.recalculate()
  },
  watch: {
    categories() {
      this.recalculate()
    }
  }
}
</script>
<style scoped>
@import "@/assets/css/wikiCategory.css"
</style>