<template>
  <div class="app-progress" :class="{ done }" ref="progressBar" @transitionend="onTransitionEnd"></div>
</template>
<style scoped>
.app-progress {
  background-color: #fff;
  height: 3px;
  left: 0;
  opacity: 1;
  position: fixed;
  right: 0;
  top: 0;
  transition: width .1s, opacity .4s;
  width: 0;
  z-index: 999999;
}

.app-progress.done {
  opacity: 0
}
</style>
<script>
export default {
  data() {
    return {
      done: false,
      interval: null
    }
  },
  methods: {
    set(progress = 0) {
      const progressBar = this.$refs.progressBar

      if(this.interval) this.clearProgressInterval()
      this.done = false

      progressBar.style.width = progress + '%'

      if(progress === 100) this.done = true
    },
    start(progress = 100, during = 3000, interval = 50) {
      if(this.interval) return

      const progressBar = this.$refs.progressBar

      if(this.interval) this.clearProgressInterval()
      this.done = false

      let currentProgress = parseFloat(progressBar.style.width) || 0
      let increase = progress / (during / interval)
      this.interval = setInterval(() => {
        currentProgress += increase
        progressBar.style.width = currentProgress + '%'

        if(currentProgress >= progress) this.clearProgressInterval()
      }, interval)
    },
    finish() {
      if(!this.done) this.set(100)
    },
    clearProgressInterval() {
      if(this.interval) clearInterval(this.interval)
      this.interval = null
    },
    onTransitionEnd(e) {
      const progressBar = this.$refs.progressBar
      if(e.propertyName !== 'opacity' || !this.done) return

      this.done = false
      progressBar.style.width = '0'
    }
  }
}
</script>