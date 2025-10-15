<template>
  <component v-if="disable" :is="block ? 'div' : 'span'" :="dummyButton">
    <slot/>
  </component>
  <a v-else-if="whenClick || type === 'event'" href="#" role="button" :class="buttonClass" @click.prevent="click">
    <slot/>
  </a>
  <button v-else-if="type === 'submit' || type === 'reset'" :type="type" :class="buttonClass">
    <slot/>
  </button>
  <NuxtLink v-else-if="href" :to="href" :rel="nofollow ? 'nofollow' : null" role="button" :class="buttonClass">
    <slot/>
  </NuxtLink>
  <component v-else :is="block ? 'div' : 'span'" :="dummyButton">
    <slot/>
  </component>
</template>
<script>
import NuxtLink from '@/components/global/nuxtLink'

export default {
  inject: {
    submittingSeedForm: {
      default: false
    }
  },
  components: {
    NuxtLink
  },
  props: {
    type: String,
    theme: String,
    href: [String, Object],
    nofollow: Boolean,
    noBorder: Boolean,
    size: String,
    disabled: Boolean,
    block: Boolean,
    state: String,
    value: String,
    whenClick: Function,
    dummy: Boolean
  },
  emits: ['click'],
  methods: {
    click(e) {
      this.whenClick?.(e)
      this.$emit('click', e)
    }
  },
  computed: {
    disable() {
      return this.disabled || this.submittingSeedForm
    },
    buttonClass() {
      const result = [this.$style.base]

      if(this.theme === 'link') result.push(this.$style.link)
      else result.push(this.$style.button)

      switch(this.theme) {
        case 'secondary': result.push(this.$style['button--secondary']); break
        case 'primary': result.push(this.$style['button--primary']); break
        case 'danger': result.push(this.$style['button--danger']); break
        case 'super': result.push(this.$style['button--super']); break
        case 'brand': result.push(this.$style['button--brand']); break
      }

      if(this.disable) result.push(this.$style['button--disabled'])
      if(this.noBorder) result.push(this.$style['button--no-border'])

      if(this.size === 'small') result.push(this.$style['button--small-size'])
      else if(this.size === 'big') result.push(this.$style['button--big-size'])

      if(this.block) result.push(this.$style['button--block'])

      if(this.state === 'hover') result.push(this.$style['button--hover'])
      else if(this.state === 'focus') result.push(this.$style['button--focus'])

      return result
    },
    dummyButton() {
      return {
        role: 'button',
        class: this.buttonClass
      }
    }
  }
}
</script>
<style module>
@import '@/styles/button.css';
</style>