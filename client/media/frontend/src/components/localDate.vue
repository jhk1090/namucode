<template>
  <time :datetime="dateObject.toISOString()" :title="dateObject.toISOString()">{{dateString}}</time>
</template>
<script>
import { formatDate } from '@/utils'

export default {
  props: {
    date: {
      type: [Number, String, Date],
      required: true
    },
    format: {
      type: String,
      default: 'Y-m-d H:i:s'
    },
    relative: {
      type: Boolean,
      default: false
    },
    forceRelative: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      currDate: new Date()
    }
  },
  computed: {
    dateObject() {
      return new Date(
          typeof this.date === 'string' || this.date * 1000 > Date.now()
              ? this.date
              : this.date * 1000)
    },
    isRelative() {
      return (this.forceRelative || (this.relative && !this.$store.state.localConfig['wiki.no_relative_date']))
          && this.relativeDate
    },
    relativeDate() {
      const diff = this.currDate - this.dateObject
      const relative = new Intl.RelativeTimeFormat('ko')

      let text
      if(diff < 1000 * 10) text = '방금 전'
      else if(diff < 1000 * 60) text = relative.format(-Math.floor(diff / 1000), 'second')
      else if(diff < 1000 * 60 * 60) text = relative.format(-Math.floor(diff / 1000 / 60), 'minute')
      else if(diff < 1000 * 60 * 60 * 24) text = relative.format(-Math.floor(diff / 1000 / 60 / 60), 'hour')
      else if(diff < 1000 * 60 * 60 * 24 * 30) text = relative.format(-Math.floor(diff / 1000 / 60 / 60 / 24), 'day')

      return text
    },
    formattedDate() {
      return formatDate(this.dateObject, this.format)
    },
    dateString() {
      return this.isRelative ? this.relativeDate : this.formattedDate
    }
  }
}
</script>