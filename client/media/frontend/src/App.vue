<template>
  <Wiki />
</template>

<script lang="ts">
import Wiki from "@/views/wiki.vue"

export default {
  name: 'App',
  components: {
    Wiki
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
</style>