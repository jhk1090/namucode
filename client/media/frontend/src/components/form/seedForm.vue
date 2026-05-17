<template>
  <form ref="form" v-bind="$attrs" :class="{ flex, box }">
    <slot/>
  </form>
</template>
<script>
import Common from '@/mixins/common'

export default {
  mixins: [Common],
  props: {
    flex: Boolean,
    box: Boolean,
  },
}
</script>
<style scoped>
.flex {
  align-items: center;
  display: flex;
  gap: .5rem;
}

.box {
  border: 1px solid #d5d5d5;
  border-radius: 6px;
  padding: .75rem 1rem;
}

.theseed-dark-mode .box {
  border-color: #484848;
}
</style>