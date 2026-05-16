<template>
  <div class="page-group" :class="{
    'page-flex': flex
  }">
    <GeneralButton v-if="start !== undefined" :disabled="!start" class="page-button" :href="start ?? undefined">
      <FontAwesomeIcon icon="angles-left"/>
    </GeneralButton>
    <GeneralButton v-if="prev !== undefined" :disabled="!prev" class="page-button" :href="actualPrev ?? undefined">
      <FontAwesomeIcon icon="chevron-left"/>
      <span>{{$t('components.prev_next_btn.prev')}}</span>
    </GeneralButton>
    <GeneralButton v-if="next !== undefined" :disabled="!next" class="page-button" :href="actualNext ?? undefined">
      <span>{{$t('components.prev_next_btn.next')}}</span>
      <FontAwesomeIcon icon="chevron-right"/>
    </GeneralButton>
    <GeneralButton v-if="end !== undefined" :disabled="!end" class="page-button" :href="end ?? undefined">
      <FontAwesomeIcon icon="angles-right"/>
    </GeneralButton>
  </div>
</template>
<script>
import GeneralButton from '@/components/generalButton'

export default {
  components: {
    GeneralButton
  },
  props: {
    start: {
      type: [String, JSON, null]
    },
    prev: {
      type: [String, JSON, null]
    },
    next: {
      type: [String, JSON, null]
    },
    end: {
      type: [String, JSON, null]
    },
    flex: {
      type: Boolean
    }
  },
  computed: {
    actualPrev() {
      return {
        ...this.prev,
        query: {
          ...this.$route.query,
          ...this.prev?.query,
          from: null,
          cfrom: null
        }
      }
    },
    actualNext() {
      return {
        ...this.next,
        query: {
          ...this.$route.query,
          ...this.next?.query,
          until: null,
          cuntil: null
        }
      }
    }
  }
}
</script>
<style scoped>
.page-group {
  display: inline-flex;
}

.page-group> *:first-child {
  border-bottom-right-radius: 0;
  border-top-right-radius: 0;
}

.page-group> *:last-child {
  border-bottom-left-radius: 0;
  border-top-left-radius: 0;
}

.page-group> *:not(:last-child) {
  border-right-width: 0;
}

.page-group> *:not(:first-child):not(:last-child) {
  border-radius: 0;
}

.page-group> *:focus {
  z-index: 200;
}

.page-flex {
  display: flex;
  margin: 1rem 0;
}

.page-button {
  column-gap: .4rem;
}

@media screen and (max-width: 727.98px) {
  .page-button {
    flex: 1;
  }
}
</style>