<template>
  <Modal v-slot="props">
    <div class="setting-block">
      <button @click="props.close">×</button>
      <h1>참조된 문서 목록</h1>
      <div>
        <div>전체 {{referencedList.length}}개 문서</div>
        <div :class="{ 'many-wrapper': Object.keys(referenced.referencedPerChar).length >= 3 }">
          <div v-for="(documents, char) in referenced.referencedPerChar">
            <h3>{{char}}</h3>
            <ul>
              <li v-for="document in documents">{{document.parsedName.title}}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>
<script>
import Common from '@/mixins/common'
import Modal from '@/components/modal'
import PrevNextBtn from '@/components/prevNextBtn'

export default {
  mixins: [Common],
  components: {
    PrevNextBtn,
    Modal
  },
  props: {
    referencedList: Array
  },
  methods: {
    pageProps(name, category) {
      return {
        prev: category.prevItem ? { query: { namespace: name, cuntil: category.prevItem } } : null,
        next: category.nextItem ? { query: { namespace: name, cfrom: category.nextItem } } : null
      }
    }
  },
  computed: {
    referenced() {
      const referencedPerChar = {};

      this.referencedList.forEach(referenced => {
        const firstChar = referenced.charAt(0).toUpperCase(); 

        if (!referencedPerChar[firstChar]) {
          referencedPerChar[firstChar] = [];
        }
        
        // 템플릿 구조에 맞게 매핑
        referencedPerChar[firstChar].push({
          parsedName: { title: referenced },
          category: { text: '문서' }
        });
      });

      return {
        count: this.referencedList.length,
        referencedPerChar
      };
    }
  }
}
</script>
<style scoped>
button {
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

.theseed-dark-mode button {
  color: #fff;
}

button:focus,button:hover {
  cursor: pointer;
  opacity: .5;
  text-decoration: none;
}
  
h2 {
  font-size: 1.8em;
}

h2, h3 {
  border-bottom: 1px solid #ccc;
  margin: 1.2em 0 .8em;
  padding-bottom: 5px;
}

.many-wrapper {
  column-count: 3;
}

.many-wrapper>div {
  page-break-inside: avoid;
}

.many-wrapper div:first-child h3 {
  margin-top: 0;
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