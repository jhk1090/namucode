<template>
  <WikiContent ref="wikiContent" :key="store.localConfig['page.key']" />
  <ModalsContainer/>
</template>
<script>
import WikiContent from '@/components/wiki/wikiContent';
import { store } from '@/store.js';

export default {
  inject: ["triggerHandleMessage"],
  components: {
    WikiContent
  },
  data() {
    return {
      store
    }
  }
}
</script>