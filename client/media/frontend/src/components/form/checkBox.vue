<template>
  <label :class="{ disable }">
    <input
      type="checkbox"
      v-bind="$attrs"
      v-model="value"
      @change="onInput"
      :disabled="disable">
    <slot/>
  </label>
</template>
<script>
import { store } from '@/store.js'

export default {
  inject: {
    submittingSeedForm: {
      default: false
    }
  },
  props: {
    modelValue: Boolean,
    disabled: Boolean,
    checked: Boolean,
    whenChange: Function
  },
  data() {
    return {
      value: this.modelValue
    }
  },
  emits: ['update:modelValue'],
  created() {
    if(this.checked) this.value = true
  },
  watch: {
    checked(newValue) {
      this.value = newValue
    }
  },
  computed: {
    fieldError() {
      return this.name && store.state.viewData.fieldErrors?.[this.name]
    },
    error() {
      return !!(this.hasError || this.fieldError || store.state.viewData.errorAlert)
    },
    disable() {
      return this.disabled || this.submittingSeedForm
    }
  },
  methods: {
    onInput(e) {
      this.whenChange?.(e)
      this.$emit('update:modelValue', e.target.checked)
    }
  }
}
</script>
<style scoped>
label {
  align-items: center;
  display: inline-flex;
}

.disable {
  cursor: not-allowed;
  opacity: .5;
}

input {
  appearance: none;
  background-color: var(--light-article-background-color, var(--article-background-color, #fff));
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: 65%;
  border: 1px solid #d5d5d5;
  border-radius: 4px;
  height: 1.15em;
  margin: 0 .5em 0 0;
  transition: background-color .1s ease-in;
  width: 1.15em;
}

.theseed-dark-mode input {
   background-color: #282829;
   border-color: #484848;
 }

input:checked {
  background-color: var(--brand-color-1, #bcbcbc);
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 448 512%27%3E%3Cpath d=%27M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7l233.4-233.3c12.5-12.5 32.8-12.5 45.3 0z%27 style=%27fill:%23fff%27/%3E%3C/svg%3E");
}

input {
  --focus-outline-color: var(--brand-bright-color-2, #e3e3e3);
  --focus-box-shadow-style: var(--focus-outline-color) 0 0 0 0.2rem;
}

input:focus-visible {
  box-shadow: var(--focus-box-shadow-style);
  transition: box-shadow .1s linear;
}

.theseed-dark-mode input:focus-visible {
  --focus-outline-color: var(--brand-bright-color-2, #45474b);
}
</style>