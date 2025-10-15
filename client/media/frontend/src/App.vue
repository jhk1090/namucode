<template>
  <VueRouterView/>
  <ModalsContainer/>
</template>
<script>
import { RouterView } from 'vue-router'

export default {
  components: {
    VueRouterView: RouterView
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

@import 'vue-select/dist/vue-select.css';
</style>