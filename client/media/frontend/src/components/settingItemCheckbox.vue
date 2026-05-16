<template>
  <SettingItem v-bind="$props">
    <div class="select-block">
      <CheckBox class="setting-check" :id="ckey" v-model="value">사용</CheckBox>
    </div>
  </SettingItem>
</template>
<script>
import SettingItem from '@/components/settingItem';
import CheckBox from '@/components/form/checkBox'

export default {
  extends: SettingItem,
  components: {
    CheckBox,
    SettingItem
  },
  props: {
    default: {
      type: Boolean,
      default: false
    }
  }
}
</script>
<style scoped>
.setting-check {
  width: 17rem;
}
</style>