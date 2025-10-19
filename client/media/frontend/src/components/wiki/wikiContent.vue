<template>
  <WikiCategory v-if="categories && categories.length" :categories="categories"/>

  <div ref="div" v-html="content" class="wiki-content" @submit.prevent="formSubmit"></div>
  <div ref="popover" v-show="popover.show" id="tooltip" class="popper">
    <div ref="popoverArrow" id="tooltip-arrow" class="popper__arrow"></div>
    <div id="tooltip-content" class="wiki-content" v-html="popover.content"></div>
  </div>
</template>
<script>
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/vue'

import WikiCategory from "@/components/wiki/wikiCategory"
import Common from '@/mixins/common'

export default {
  mixins: [Common],
  components: {
    WikiCategory
  },
  computed: {
    footnotes() {
      return this.$refs.div.getElementsByClassName('wiki-fn-content')
    }
  },
  data() {
    return {
      popover: {
        show: false,
        content: '',
        cleanup: null
      },
      modal: {
        show: false,
        content: ''
      },
      content: "",
      categories: []
    }
  },
  mounted() {
    this.setupWikiContent()
    import('@justinribeiro/lite-youtube')
  },
  watch: {
    async content() {
      await this.$nextTick()
      this.setupWikiContent()
    },
    'popover.show'(newValue) {
      if(!newValue)
        this.popover.cleanup?.()
    },
    $route() {
      this.popover.show = false
    }
  },
  methods: {
    setupWikiContent() {
      const div = this.$refs.div;

      const headings = div.getElementsByClassName('wiki-heading');
      for(let heading of headings) {
        heading.addEventListener('click', e => {
          if(e.target.tagName === 'A') return;

          const heading = e.currentTarget;
          const content = heading.nextElementSibling;
          const prevClosed = heading.classList.contains('wiki-heading-folded');
          if(prevClosed) {
            heading.classList.remove('wiki-heading-folded');
            content.classList.remove('wiki-heading-content-folded');
          }
          else {
            heading.classList.add('wiki-heading-folded');
            content.classList.add('wiki-heading-content-folded');
          }
        });

        // if(this.$store.state.localConfig['wiki.hide_heading_content']) {
        //   heading.classList.add('wiki-heading-folded');
        //   heading.nextElementSibling.classList.add('wiki-heading-content-folded');
        // }
      }

      const foldings = div.getElementsByClassName('wiki-folding');
      for(let folding of foldings) {
        const foldingText = folding.firstElementChild;
        const foldingContent = foldingText.nextElementSibling;

        let offsetWidth;
        let offsetHeight;
        const resizeObserver = new ResizeObserver(([entry]) => {
          if(!entry.contentRect.height) return;

          const openedBefore = foldingContent.classList.contains('wiki-folding-opened');

          if(!openedBefore) foldingContent.classList.add('wiki-folding-opened');
          offsetWidth = foldingContent.offsetWidth;
          offsetHeight = foldingContent.offsetHeight;
          if(!openedBefore) foldingContent.classList.remove('wiki-folding-opened');

          resizeObserver.disconnect();
        });
        resizeObserver.observe(foldingText);

        let transitionCount = 0;
        const transitioning = () => transitionCount !== 0;

        foldingContent.addEventListener('transitionstart', _ => transitionCount++);
        foldingContent.addEventListener('transitionend', _ => transitionCount--);
        foldingContent.addEventListener('transitioncancel', _ => transitionCount--);

        const setSizeToOffsetSize = () => {
          foldingContent.style.maxWidth = offsetWidth + 'px';
          foldingContent.style.maxHeight = offsetHeight + 'px';
        }
        const removeSize = () => {
          foldingContent.style.maxWidth = '';
          foldingContent.style.maxHeight = '';
        }
        const finishOpen = () => {
          if(transitioning()) return;

          removeSize();
          foldingContent.classList.add('wiki-folding-opened');

          foldingContent.removeEventListener('transitionend', finishOpen);
        }

        // if(this.$store.state.localConfig['wiki.show_folding'])
        //   foldingContent.classList.add('wiki-folding-open-anim', 'wiki-folding-opened');

        foldingText.addEventListener('click', e => {
          const foldingText = e.currentTarget;
          const foldingContent = foldingText.nextElementSibling;

          const opened = foldingContent.classList.contains('wiki-folding-open-anim');

          if(opened) {
            setSizeToOffsetSize();

            requestAnimationFrame(_ => {
              foldingContent.classList.remove('wiki-folding-open-anim');
              foldingContent.classList.remove('wiki-folding-opened');

              removeSize();
            });
          }
          else {
            foldingContent.classList.add('wiki-folding-open-anim');
            setSizeToOffsetSize();

            foldingContent.addEventListener('transitionend', finishOpen);
          }
        });
      }

      // let footnoteType = this.$store.state.localConfig['wiki.footnote_type'];
      let footnoteType = "popover"

      if(footnoteType === 'popover') this.setupFootnoteTooltip();

      const oldDarkStyle = document.getElementById('darkStyle');
      if(oldDarkStyle) oldDarkStyle.remove();

      const darkStyleElements = document.querySelectorAll('*[data-dark-style]');
      const darkStyles = [];
      for(let element of darkStyleElements) {
        const styleData = element.dataset.darkStyle.split(';').map(a => a.trim()).filter(a => a);
        let style = '';
        for(let stylePart of styleData) {
          const [key, value] = stylePart.split(':').map(a => a.trim());
          style += `${key}:${value} !important;`;
        }

        let darkStyle = darkStyles.find(a => a.style === style);
        if(!darkStyle) {
          darkStyle = {
            style,
            class: '_' + crypto.randomUUID().replaceAll('-', '')
          }
          darkStyles.push(darkStyle);
        }
        element.classList.add(darkStyle.class);
      }

      if(darkStyles.length) {
        const newDarkStyle = document.createElement('style');
        newDarkStyle.id = 'darkStyle';
        newDarkStyle.innerHTML = darkStyles.map(a => `.theseed-dark-mode .${a.class}{${a.style}}`).join('');
        document.body.appendChild(newDarkStyle);
      }

      const times = div.querySelectorAll('time[data-type=timezone]')
      for(let time of times) {
        const type = time.dataset.type;
        const date = new Date(time.dateTime);

        const dateStr = [
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate()
        ].map(num => num.toString().padStart(2, '0')).join('-');

        const timeStr = [
          date.getHours(),
          date.getMinutes(),
          date.getSeconds()
        ].map(num => num.toString().padStart(2, '0')).join(':');

        let result = dateStr + ' ' + timeStr;

        if(type === 'timezone') {
          const offset = -(date.getTimezoneOffset() / 60);
          result += (offset > 0 ? '+' : '-') + (offset * 100).toString().padStart(4, '0');
        }

        time.textContent = result;
      }

      // if(!this.discuss) {
      //   const hash = decodeURIComponent(location.hash.slice(1));
      //   window.history.pushState(null, null, hash);
      //   const anchorElem = document.getElementById(hash);
      //   anchorElem?.scrollIntoView();
      // }
    },
    setupFootnoteTooltip() {
      let hovering = 0;
      const mouseLeaveHandler = _ => {
        requestAnimationFrame(() => requestAnimationFrame( () =>{
          hovering--;

          if(!hovering)
            this.popover.show = false;
        }));
      }

      const popover = this.$refs.popover;
      popover.addEventListener('mouseenter', _ => {
        hovering++;
      });
      popover.addEventListener('mouseleave', mouseLeaveHandler);

      for(let footnote of this.footnotes) {
        const targetId = footnote.getAttribute('href').slice(1);
        const contentElement = document.getElementById(targetId).parentElement;

        footnote.title = '';

        const update = () => computePosition(footnote, popover, {
          placement: 'top',
          middleware: [
            offset(5),
            flip(),
            shift()
          ]
        }).then(({x, y, placement, middlewareData}) => {
          popover.setAttribute('x-placement', placement);
          Object.assign(popover.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
          this.$refs.popoverArrow.style.left = `calc(50% - 10px - ${middlewareData.shift.x}px)`;
        });

        footnote.addEventListener('mouseenter', async _ => {
          hovering++;

          this.popover.show = true;
          this.popover.content = contentElement.innerHTML;
          this.popover.cleanup = autoUpdate(footnote, popover, update);
        });

        footnote.addEventListener('mouseleave', mouseLeaveHandler);
      }
    },
    async formSubmit(e) {
      const el = e.target
      const actionAttr = el.getAttribute('action')
      const url = new URL(el.action)
      const formData = new FormData(el)
      await this.internalRequestAndProcess(url.pathname, {
        method: el.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(formData).toString()
      })

      const newEl = this.$refs.div.querySelector(`form[action="${actionAttr}"]`)
      for(let [key, value] of formData.entries()) {
        const input = newEl.querySelector(`[type=radio][name="${key}"][value="${value}"]`)
        input.checked = true
      }
    },
    updateContent(value) {
      this.content = value
    },
    updateCategories(value) {
      this.categories = value
    }
  }
}
</script>
<style scoped>
@import '@/assets/css/wikiContent.css'
</style>