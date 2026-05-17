<template>
  <div ref="wikiContentContainer" class="content-container">
    <div class="options">
      <a href="#" class="options-item" @click.prevent="openSettingModal">설정</a>
      <a href="#" class="options-item" @click.prevent="toggleTheme">{{ currentTheme === "light" ? "다크" : "라이트" }} 테마로 변경</a>
      <a href="#" class="options-item" @click.prevent="openReferenced">참조된 문서 목록</a>
      <a href="#" class="options-item" @click.prevent="openIPE">매개변수 편집기</a>
    </div>
    <div class="title">
      <h1 ref="title" />
    </div>
    <WikiContent ref="wikiContent" :key="currentKey" />
    <ModalsContainer/>
  </div>
</template>
<script>
import Common from '@/mixins/common'
import WikiContent from '@/components/wiki/wikiContent';
import SettingModal from "@/components/setting";
import { store } from '@/store.js'
import Referenced from '@/components/referenced.vue';
import IPE from '@/components/IPE.vue';

export default {
  mixins: [Common],
  components: {
    WikiContent
  },
  data() {
    return {
      currentContent: '',
      currentCategories: [],
      currentUserbox: { parameterAlert: {} },
      currentKey: 0,
      currentTheme: "auto",
      currentReferenced: [],
      currentParameterMap: null
    }
  },
  mounted() {
    window.addEventListener("message", this.handleMessage)
  },
  unmounted() {
    window.removeEventListener("message", this.handleMessage)
  },
  methods: {
    handleMessage(e) {
      if (e.data.type === 'updateTitle') {
        this.$refs.title.innerText = e.data.title
      }
      if (e.data.type === 'updateContent') {
        this.currentContent = e.data.newContent ?? this.currentContent
        this.currentCategories = e.data.newCategories ?? this.currentCategories
        this.currentUserbox = e.data.newUserbox ?? this.currentUserbox
        this.currentKey = e.data.newKey ?? this.currentKey

        this.$nextTick(() => {
          if (this.$refs.wikiContent) {
            this.$refs.wikiContent.updateContent(this.currentContent)
            this.$refs.wikiContent.updateCategories(this.currentCategories)
            this.$refs.wikiContent.updateUserbox(this.currentUserbox)
          }
        })
      }
      if (e.data.type === 'updateTheme') {
        let finalTheme = e.data.themeKind;
        store.localConfigSetValue("wiki.theme", finalTheme)

        if (finalTheme === 'auto') {
          const isBodyDark = document.body.classList.contains("vscode-dark");
          finalTheme = isBodyDark ? 'dark' : 'light';
        }

        this.currentTheme = finalTheme

        if (finalTheme === 'dark') {
          this.$refs.wikiContentContainer.classList.remove("theseed-light-mode");
          this.$refs.wikiContentContainer.classList.add("theseed-dark-mode");
        } else {
          this.$refs.wikiContentContainer.classList.add("theseed-light-mode");
          this.$refs.wikiContentContainer.classList.remove("theseed-dark-mode");
        }
      }
      if (e.data.type === "updateReferenced") {
        this.currentReferenced = e.data.referenced
      }
      if (e.data.type === "updateParameterMap") {
        this.currentParameterMap = e.data.parameterMap
      }
    },
    openSettingModal() {
      this.$vfm.show({ component: SettingModal });
    },
    openReferenced() {
      this.$vfm.show({ component: Referenced, bind: { referencedList: this.currentReferenced }});
    },
    openIPE() {
      this.$vfm.show({ component: IPE, bind: { parameterMap: this.currentParameterMap ?? {} }});
    },
    toggleTheme() {
      this.handleMessage({
        data: {
          type: "updateTheme",
          themeKind: this.currentTheme === "light" ? "dark" : "light"
        }
      })
    }
  },
  provide() {
    return {
      triggerHandleMessage: this.handleMessage
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