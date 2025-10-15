<template>
  <div class="thetree-alert" :class="{
    'thetree-alert-primary': theme === 'primary',
    'thetree-alert-danger': theme === 'danger' || error
  }">
    <div class="alert-content"><slot/></div>
    <div v-if="closable">
      <a href="#" class="close-link" @click.prevent="close"><FontAwesomeIcon icon="xmark"/></a>
    </div>
  </div>
</template>
<script>
export default {
  props: {
    theme: String,
    error: Boolean,
    closable: Boolean
  },
  methods: {
    close() {
      this.$emit('close')
    }
  }
}
</script>
<style scoped>
.thetree-alert {
  background-color: #f3f3f3;
  border: 1px solid #d5d5d5;
  border-radius: .25rem;
  -moz-column-gap: .75rem;
  column-gap: .75rem;
  display: flex;
  margin-bottom: 1.5rem;
  padding: .5rem .75rem;
}

.theseed-dark-mode .thetree-alert {
  background-color: #2a2a2a;
  border-color: #484848;
}

.thetree-alert-primary {
  background-color: #cee2fd;
  border-color: #7eaaed;
  color: #0b3574
}

.theseed-dark-mode .thetree-alert-primary {
  background-color: #05234f;
  border-color: #052e6d;
  color: #c0d2ee
}

.thetree-alert-danger {
  background-color: #f7c6ca;
  border-color: #b42e3b;
  color: #3f0404;
}

.theseed-dark-mode .thetree-alert-danger {
  background-color: #3d050b;
  border-color: #861520;
  color: #eec0c0;
}

.alert-content {
  flex: 1;
}

.close-link {
  background: none;
  border: none;
  color: var(--light-text-color, var(--text-color, #212529));
  display: inline-block;
  height: 1.15rem;
  margin: .05rem 0 0;
  opacity: .7;
  width: 1.15rem;
}

.close-link svg {
  height: 100%;
  width: 100%;
  fill: currentColor;
}
</style>