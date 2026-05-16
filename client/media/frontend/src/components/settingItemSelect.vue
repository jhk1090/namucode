<template>
  <SettingItem v-bind="$props">
    <SelectMenu :id="ckey" v-model="value" class="select-menu">
      <slot/>
    </SelectMenu>
  </SettingItem>
</template>
<script>
import SettingItem from '@/components/settingItem';
import SelectMenu from '@/components/selectMenu'

export default {
  extends: SettingItem,
  components: {
    SelectMenu,
    SettingItem
  },
  props: {
    default: String
  }
}
</script>
<style scoped>
.select-menu {
  width: 17rem;
}
</style>