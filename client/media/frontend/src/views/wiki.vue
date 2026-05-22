<template>
  <div class="options">
    <a href="#" class="options-item" @click.prevent="openSettingModal">설정</a>
    <a href="#" class="options-item" @click.prevent="toggleTheme">{{ store.localConfig['wiki.calculatedTheme'] === "light" ? "다크" : "라이트" }} 테마로 변경</a>
    <a href="#" class="options-item" @click.prevent="openReferenced">참조된 문서 목록</a>
    <a href="#" class="options-item" @click.prevent="openIPE">매개변수 편집기</a>
  </div>
  <WikiContent ref="wikiContent" :key="store.localConfig['page.key']" />
  <ModalsContainer/>
</template>
<script>
import WikiContent from '@/components/wiki/wikiContent';
import { store } from '@/store.js';
import SettingModal from "@/components/setting";
import Referenced from '@/components/referenced.vue';
import IPE from '@/components/IPE.vue';

export default {
  inject: ["triggerHandleMessage"],
  components: {
    WikiContent
  },
  data() {
    return {
      store
    }
  },
  methods: {
    openSettingModal() {
      this.$vfm.show({ component: SettingModal });
    },
    openReferenced() {
      this.$vfm.show({ component: Referenced, bind: { referencedList: store.localConfig["page.referenced"] }});
    },
    openIPE() {
      this.$vfm.show({ component: IPE, bind: { parameterMap: store.localConfig["page.parameterMap"] ?? {} }});
    },
    toggleTheme() {
      this.triggerHandleMessage({
        data: {
          type: "updateTheme",
          themeKind: store.localConfig["wiki.calculatedTheme"] === "light" ? "dark" : "light"
        }
      })
    }
  }
}
</script>
<style scoped>
.options {
  width: 100%;
  display: flex;
  justify-content: space-around;
}
</style>