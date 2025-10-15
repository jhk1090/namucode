<template>
  <VueRouterLink v-bind="$props" :to="actualTo" custom v-slot="{ href }">
    <a ref="link" v-bind="$attrs" :href="href" @click="click"><slot/></a>
  </VueRouterLink>
</template>
<script>
import { RouterLink } from 'vue-router'

export default {
  props: {
    ...RouterLink.props
  },
  components: {
    VueRouterLink: RouterLink
  },
  data() {
    return {
      actualTo: this.to
    }
  },
  created() {
    this.calculateActualTo()
  },
  watch: {
    $route() {
      this.calculateActualTo()
    },
    to() {
      this.calculateActualTo()
    }
  },
  methods: {
    calculateActualTo() {
      if(typeof this.to === 'string') {
        this.actualTo = this.to
        return
      }

      // vue-router 자체 router.resolve는 path를 이상하게 encode하는 듯
      const url = new URL(this.to.path || this.$route.fullPath, 'https://example.com')
      for(let [key, value] of Object.entries(this.to.query)) {
        if(value === null) url.searchParams.delete(key)
        else url.searchParams.set(key, value)
      }
      this.actualTo = url.pathname + url.search
    },
    click(e) {
      if(e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return

      let url = this.$refs.link.getAttribute('href')
      if(this.actualTo.startsWith('#')) {
        url = this.$router.resolve(url)
        url.query = this.$route.query
      }
      this.$store.state.components.mainView.routerPush(url).then()
      e.preventDefault()
    }
  }
}
</script>