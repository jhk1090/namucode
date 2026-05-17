<template>
  <Modal v-slot="props">
    <div class="setting-block">
      <button class="setting-close" @click="props.close">×</button>
      <h1>매개변수 편집기</h1>
      <div>
        <template v-if="parameterMap" v-for="(value, key) in parameterMap" :key="key">
          <SeedForm @submit="onDelete">
            <input name="key" placeholder="매개변수" required :value="key" :data-key="key" @input="onKeyInput">
            <input name="value" placeholder="값" style="width:40%" :value="value" :data-key="key" @input="onValueInput">
            <GeneralButton theme="danger" type="submit">삭제</GeneralButton>
          </SeedForm>
        </template>
        <SeedForm @submit="onAdd">
          <input name="key" placeholder="매개변수" required @input="onNewFormKeyInput">
          <input name="value" placeholder="값" style="width:40%">
          <GeneralButton theme="primary" type="submit">추가</GeneralButton>
        </SeedForm>
        <GeneralButton theme="primary" :whenClick="apply">적용</GeneralButton>
      </div>
    </div>
  </Modal>
</template>
<script>
import Common from '@/mixins/common'
import Modal from '@/components/modal'
import GeneralButton from '@/components/generalButton'
import SeedForm from '@/components/form/seedForm'

export default {
  mixins: [Common],
  components: {
    Modal,
    GeneralButton,
    SeedForm
  },
  props: {
    parameterMap: Object
  },
  data() {
    return {
      oldParameterMap: this.parameterMap
    }
  },
  methods: {
    onDelete(e) {
      e.preventDefault()
      
      const key = e.target[0].value
      delete this.parameterMap[key]
    },
    onAdd(e) {
      e.preventDefault()
      
      const key = e.target[0].value
      const value = e.target[1].value
      
      const validateRegex = /^[\p{L}\p{N}_]*$/gu
      if (!validateRegex.exec(key)) {
        e.target[0].setCustomValidity("올바른 키 값이 아닙니다.")
        e.target[0].reportValidity()
        return
      }

      if (this.parameterMap[key]) {
        e.target[0].setCustomValidity("이미 등록된 키입니다.")
        e.target[0].reportValidity()
        return
      }

      e.target[0].value = ""
      e.target[1].value = ""

      this.parameterMap[key] = value;
    },
    onNewFormKeyInput(e) {
      e.target.setCustomValidity("")
    },
    onKeyInput(e) {
      e.target.setCustomValidity("");

      const key = e.target.value
      const oldKey = e.target.dataset.key

      if (key.length === 0) {
        e.target.setCustomValidity("키 값은 필수입니다.")
        e.target.reportValidity()
        return
      }

      const validateRegex = /^[\p{L}\p{N}_]*$/gu
      if (!validateRegex.exec(key)) {
        e.target.setCustomValidity("올바른 키 값이 아닙니다.")
        e.target.reportValidity()
        return
      }

      if (this.parameterMap[key]) {
        e.target.setCustomValidity("이미 등록된 키입니다.")
        e.target.reportValidity()
        return
      }

      this.parameterMap[key] = this.parameterMap[oldKey];
      // e.target.parentElement.children.filter(child => child.tagName === "INPUT").forEach(child => {
      //   child.dataset.key = key
      // })
      delete this.parameterMap[oldKey];
      console.log(this.parameterMap)
    },
    onValueInput(e) {
      const key = e.target.dataset.key
      this.parameterMap[key] = e.target.value
    },
    apply() {
      vscode.postMessage({
        command: "updateParameterMap",
        value: JSON.stringify(this.parameterMap)
      })
      this.oldParameterMap = this.parameterMap
    }
  },
}
</script>
<style scoped>
button.setting-close {
  background: 0 0;
  border: 0;
  color: #000;
  cursor: pointer;
  float: right;
  font-size: 1.5rem!important;
  font-weight: 700;
  line-height: 1;
  margin: 0 0 0 .5rem;
  opacity: .2;
  overflow: visible;
  padding: 0;
  position: relative;
  right: 0;
  text-shadow: 0 1px 0 #fff;
  text-transform: none;
  top: 0;
}

.theseed-dark-mode button.setting-close {
  color: #fff;
}

button:focus,button:hover {
  cursor: pointer;
  opacity: .5;
  text-decoration: none;
}

div.setting-block {
  padding: 1rem;
}

h1 {
  color: inherit;
  font-family: inherit;
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 .5rem;
}
</style>