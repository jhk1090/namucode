<template>
  <select ref="input" @change="onChange" :value="modelValue">
    <slot/>
  </select>
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
    modelValue: String
  },
  emits: ['update:modelValue'],
  watch: {
    submittingSeedForm(newValue) {
      if(this.disabled) return
      this.disable = newValue
    },
    disable(newValue) {
      if(newValue) this.$refs.input.classList.add('disabled')
      else this.$refs.input.classList.remove('disabled')
      this.$refs.input.disabled = newValue
    }
  },
  methods: {
    onChange(e) {
      this.$emit('update:modelValue', e.target.value)
    }
  }
}
</script>
<style scoped>
select {
  appearance: none;
  background-color: var(--light-article-background-color,var(--article-background-color,#fff));
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 512 512%27%3E%3Cpath fill=%27%23d5d5d5%27 d=%27M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z%27/%3E%3C/svg%3E");
  background-position: right .5rem center;
  background-repeat: no-repeat;
  background-size: 1rem .75rem;
  border: 1px solid #d5d5d5;
  border-radius: 4px;
  display: block;
  font-size: .9rem;
  line-height: 1.5;
  padding: .3rem 2rem .3rem .75rem;
  color: inherit;
}

.theseed-dark-mode select {
  background-color: #282829;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 512 512%27%3E%3Cpath fill=%27%23434343%27 d=%27M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z%27/%3E%3C/svg%3E");
  border-color: #484848;
}

select {
  --focus-outline-color: var(--brand-bright-color-2, #e3e3e3);
  --focus-box-shadow-style: var(--focus-outline-color) 0 0 0 0.2rem;
}

select:focus-visible {
  box-shadow: var(--focus-box-shadow-style);
  transition: box-shadow .1s linear;
}

.theseed-dark-mode select:focus-visible {
  --focus-outline-color: var(--brand-bright-color-2, #45474b);
}
</style>