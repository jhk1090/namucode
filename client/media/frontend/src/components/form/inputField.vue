<template>
  <component
    :is="multiline ? 'textarea' : 'input'"
    class="input"
    :class="{
      multiline,
      center,
      readonly
    }"
    :value="modelValue"
    @input="onInput"
    @keydown="whenKeyDown"
    @paste="whenPaste"
    :name="name"
    v-bind="$attrs"
    ref="input"
  />
</template>
<script>
export default {
  inject: {
    submittingSeedForm: {
      default: false
    }
  },
  data() {
    return {
      disable: false
    }
  },
  props: {
    modelValue: String,
    hasError: Boolean,
    multiline: Boolean,
    whenInput: Function,
    whenKeyDown: Function,
    whenPaste: Function,
    name: String,
    center: Boolean,
    readonly: Boolean,
    disabled: Boolean
  },
  emits: ['update:modelValue'],
  mounted() {
    this.updateError()
    if(this.disabled)
      this.disable = true
  },
  watch: {
    submittingSeedForm(newValue) {
      if(this.disabled) return
      this.disable = newValue
    },
    error() {
      this.updateError()
    },
    disable(newValue) {
      if(newValue) this.$refs.input.classList.add('disabled')
      else this.$refs.input.classList.remove('disabled')
      this.$refs.input.disabled = newValue
    },
    readonly(newValue) {
      this.$refs.input.readOnly = newValue
    }
  },
  // computed: {
  //   fieldError() {
  //     return this.name && this.$store.state.viewData.fieldErrors?.[this.name]
  //   },
  //   error() {
  //     return !!(this.hasError || this.fieldError || this.$store.state.viewData.errorAlert)
  //   }
  // },
  methods: {
    onInput(e) {
      this.whenInput?.(e)
      this.$emit('update:modelValue', e.target.value)
    },
    focus() {
      this.$refs.input.focus()
    },
    updateError() {
      const classList = this.$refs.input.classList
      if(this.error) classList.add('error')
      else classList.remove('error')
    }
  }
}
</script>
<style scoped>
.input {
  --input-color: var(--light-text-color, var(--text-color, #212529));
  --input-background-color: #fcfcfb;
  --input-border-color: #dfe1e2;
  appearance: none;
  background-color: var(--input-background-color);
  border: 1px solid var(--input-border-color);
  border-radius: 4px;
  color: var(--input-color);
  /* display: block; */
  font-size: .9rem;
  line-height: 1.5;
  padding: .3rem .75rem;
}

.theseed-dark-mode .input {
  --input-color: var(--dark-text-color, var(--text-color, #e0e0e0));
  --input-background-color: #2d2e2f;
  --input-border-color: #5c5c5c;
}

.input {
  --light-focus-outline-color: var(--brand-bright-color-2, #e3e3e3);
  --dark-focus-outline-color: #454545;
  --focus-outline-color: var(--light-focus-outline-color);
  --focus-box-shadow-style: var(--focus-outline-color) 0 0 0 0.2rem;
}

.input:focus-visible {
  box-shadow: var(--focus-box-shadow-style);
  transition: box-shadow .1s linear;
}

.theseed-dark-mode .input:focus-visible {
  --focus-outline-color: var(--dark-focus-outline-color);
}

.input[type=number] {
  appearance: textfield;
}

.input::-webkit-inner-spin-button,.input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.multiline {
  scrollbar-width: thin;
}

.error {
  --focus-outline-color: #fdb8ae !important;
  --input-border-color: #d83933;
}

.theseed-dark-mode .error {
  --focus-outline-color: #a23737!important;
  --input-border-color: #8b0a03;
}

.disabled {
  --focus-outline-color: none !important;
  --input-background-color: #f0f0f0;
}

.theseed-dark-mode .disabled {
  --focus-outline-color: none !important;
  --input-background-color: #2e2e2e;
}

.disabled:hover {
  cursor: not-allowed;
}

.disabled:not(.readonly) {
  --input-color: #adadad;
  --input-border-color: #e6e6e6;
}

.theseed-dark-mode .disabled:not(.readonly) {
  --input-color: #5c5c5c;
  --input-border-color: #454545;
}

.center {
  text-align: center;
}
</style>