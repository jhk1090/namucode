<template>
  <VueFinalModal v-slot="{ close, params }" :classes="modalClasses" content-class="thetree-modal-content" escToClose>
    <slot :close="close" :params="params"/>
  </VueFinalModal>
</template>
<script>
export default {
  props: {
    classes: {
      type: [Array, String],
      default: []
    }
  },
  computed: {
    modalClasses() {
      const classes = Array.isArray(this.classes) ? this.classes : this.classes.split(' ')
      return ['thetree-modal-container', ...classes]
    }
  }
}
</script>
<style>
.thetree-modal-container {
  overflow-y: scroll;
  padding: 1rem .5rem;
}

.thetree-modal-content {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: .25rem;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  max-width: 600px;
  position: relative;
}

.theseed-dark-mode .thetree-modal-content {
  background-color: #2d2f34;
  border-color: #2d3748;
}
</style>