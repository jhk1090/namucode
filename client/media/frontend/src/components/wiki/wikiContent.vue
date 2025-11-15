<template>
  <WikiCategory v-if="categories && categories.length" :categories="categories" />
  <div ref="userbox" v-if="userbox.parameterAlert && Object.keys(userbox.parameterAlert).length > 0" class="user-box admin-box">
    현재 {{ Object.keys(userbox.parameterAlert).length }}개의 매개변수가 미리보기에 적용되어 있습니다. 매개변수가 적용되면 include 문법을 사용할 수 없습니다.
    <div class="wiki-content" v-html="userboxHtml"></div>
  </div>
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
      canPlayVideo: false,
      autoplayObserver: null,
      cleanupFunctions: [],
      content: "",
      categories: [],
      userbox: {},
      userboxHtml: ""
    }
  },
  mounted() {
    this.canPlayVideo = (() => {
      try {
        const video = document.createElement('video')
        if(video?.canPlayType?.(`video/mp4; codecs="avc1.4D401E"`))
          return true
      } catch(e) {}

      return false
    })
    this.autoplayObserver = new IntersectionObserver(entries => {
      for(let entry of entries) {
        try {
          if(entry.isIntersecting)
            entry.target.play()
          else
            entry.target.pause()
        } catch (e) {}
      }
    })

    this.setupWikiContent()
    import('@justinribeiro/lite-youtube')
  },
  beforeUnmount() {
    for(let func of this.cleanupFunctions)
      func()
    this.cleanupFunctions.length = 0
  },
  watch: {
    async content() {
      await this.$nextTick()
      this.setupWikiContent()
    },
    async userboxHtml() {
      await this.$nextTick()
      this.setupWikiContent(this.$refs.userbox)
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
    getFootnotes(element) {
      return [...element.getElementsByClassName('wiki-fn-content')]
    },
    setupWikiContent(element = this.$refs.div) {
      {
        // const imageHide = this.$store.state.localConfig['wiki.image_hide']
        // const disableImageLazy = this.$store.state.localConfig['wiki.disable_image_lazy']

        for(let img of [...element.getElementsByClassName('wiki-image-loading')]) {
          if(img.tagName !== 'IMG') continue

          const parent = img.parentNode
          if(!parent) continue

          const isVideo = img.dataset.videoSrc && this.canPlayVideo
          const size = parseInt(isVideo ? img.dataset.videoFilesize : img.dataset.filesize)

          img.classList.remove('wiki-image-loading')

          const addInfoBtn = () => {
            if(!img.dataset.doc || img.closest('a')) return

            const btn = document.createElement('a')
            btn.classList.add('wiki-image-info-btn')
            btn.href = img.dataset.doc
            btn.rel = 'nofollow noopener'
            parent.appendChild(btn)
          }

          const loadImg = () => {
            if(!isVideo) {
              // if(!disableImageLazy)
              //   img.setAttribute('loading', 'lazy')
              img.setAttribute('src', img.dataset.src)
              addInfoBtn()
              return
            }

            const video = document.createElement('video')
            if(img.dataset.src) {
              video.muted = true
              video.loop = true

              const baseUrl = import.meta.env.BASE_URL

              // loading.gif는 필요 없을 것 같아 삭제
              video.setAttribute('poster', baseUrl + (baseUrl.endsWith('/') ? '' : '/') + 'img/loading.gif')
            }
            else {
              video.controls = true
            }
            video.playsInline = true
            video.setAttribute('src', img.dataset.videoSrc)
            video.classList.add('wiki-image')

            if(img.getAttribute('width'))
              video.setAttribute('width', img.getAttribute('width'))
            if(img.getAttribute('height'))
              video.setAttribute('height', img.getAttribute('height'))

            // if(!disableImageLazy)
            //   video.setAttribute('loading', 'lazy')

            parent.insertBefore(video, img)
            addInfoBtn()
            parent.removeChild(img)

            if(img.dataset.src && this.autoplayObserver) {
              this.autoplayObserver.observe(video)
              this.cleanupFunctions.push(() => {
                this.autoplayObserver.unobserve(video)
              })
            }
          }

          // if(imageHide === 'hide' || (imageHide === 'hide_1mb' && !isNaN(size) && size >= (1024 * 1024))) {
          //   const btn = document.createElement('button')
          //   btn.setAttribute('type', 'button')
          //   btn.classList.add('wiki-image', 'wiki-image-show-button')

          //   let sizeText = ''
          //   if(size) {
          //     if(size > 1024 * 1024)
          //       sizeText = (size / 1024 / 1024).toFixed(2) + 'MB'
          //     else if(size > 1024)
          //       sizeText = (size / 1024).toFixed(2) + 'KB'
          //     else
          //       sizeText = size + 'bytes'
          //   }
          //   sizeText &&= ` (${sizeText})`

          //   btn.innerText = (img.dataset.src ? '이미지' : '동영상') + sizeText

          //   const removeBtnListener = () => {
          //     btn.removeEventListener('click', onBtnClick)
          //   }
          //   this.cleanupFunctions.push(removeBtnListener)

          //   let onBtnClick = e => {
          //     if(!onBtnClick) return

          //     e?.preventDefault()
          //     removeBtnListener()
          //     onBtnClick = null
          //     parent.insertBefore(img, btn)
          //     parent.removeChild(btn)
          //     loadImg()
          //   }

          //   btn.addEventListener('click', onBtnClick)
          //   parent.insertBefore(btn, img)
          //   parent.removeChild(img)
          // }
          // else loadImg()
          loadImg()
        }
      }

      const headings = element.getElementsByClassName('wiki-heading')
      for(let heading of headings) {
        heading.addEventListener('click', e => {
          if(e.target.tagName === 'A') return

          const heading = e.currentTarget
          const content = heading.nextElementSibling
          const prevClosed = heading.classList.contains('wiki-heading-folded')
          if(prevClosed) {
            heading.classList.remove('wiki-heading-folded')
            content.classList.remove('wiki-heading-content-folded')
          }
          else {
            heading.classList.add('wiki-heading-folded')
            content.classList.add('wiki-heading-content-folded')
          }
        })

        // if(this.$store.state.localConfig['wiki.hide_heading_content']) {
        //   heading.classList.add('wiki-heading-folded');
        //   heading.nextElementSibling.classList.add('wiki-heading-content-folded');
        // }
      }

      const foldings = element.getElementsByClassName('wiki-folding')
      for(let folding of foldings) {
        const foldingText = folding.firstElementChild
        const foldingContent = foldingText.nextElementSibling

        let offsetWidth
        let offsetHeight
        const resizeObserver = new ResizeObserver(([entry]) => {
          if(!entry.contentRect.height) return

          const openedBefore = foldingContent.classList.contains('wiki-folding-opened')

          if(!openedBefore) foldingContent.classList.add('wiki-folding-opened')
          offsetWidth = foldingContent.offsetWidth
          offsetHeight = foldingContent.offsetHeight
          if(!openedBefore) foldingContent.classList.remove('wiki-folding-opened')

          resizeObserver.disconnect()
        })
        resizeObserver.observe(foldingText)

        let transitionCount = 0
        const transitioning = () => transitionCount !== 0

        foldingContent.addEventListener('transitionstart', _ => transitionCount++)
        foldingContent.addEventListener('transitionend', _ => transitionCount--)
        foldingContent.addEventListener('transitioncancel', _ => transitionCount--)

        const setSizeToOffsetSize = () => {
          foldingContent.style.maxWidth = offsetWidth + 'px'
          foldingContent.style.maxHeight = offsetHeight + 'px'
        }
        const removeSize = () => {
          foldingContent.style.maxWidth = ''
          foldingContent.style.maxHeight = ''
        }
        const finishOpen = () => {
          if(transitioning()) return

          removeSize()
          foldingContent.classList.add('wiki-folding-opened')

          foldingContent.removeEventListener('transitionend', finishOpen)
        }

        // if(this.$store.state.localConfig['wiki.show_folding'])
        //   foldingContent.classList.add('wiki-folding-open-anim', 'wiki-folding-opened')
        foldingText.addEventListener('click', e => {
          const foldingText = e.currentTarget
          const foldingContent = foldingText.nextElementSibling

          const opened = foldingContent.classList.contains('wiki-folding-open-anim')

          if(opened) {
            setSizeToOffsetSize()

            requestAnimationFrame(_ => {
              foldingContent.classList.remove('wiki-folding-open-anim')
              foldingContent.classList.remove('wiki-folding-opened')

              removeSize()
            })
          }
          else {
            foldingContent.classList.add('wiki-folding-open-anim')
            setSizeToOffsetSize()

            foldingContent.addEventListener('transitionend', finishOpen)
          }
        })
      }

      // let footnoteType = this.$store.state.localConfig['wiki.footnote_type'];
      let footnoteType = "popover"

      if(footnoteType === 'popover') this.setupFootnoteTooltip(element)

      const oldDarkStyle = document.getElementById('darkStyle')
      if(oldDarkStyle) oldDarkStyle.remove()

      const darkStyleElements = document.querySelectorAll('*[data-dark-style]')
      const darkStyles = []
      for(let element of darkStyleElements) {
        const styleData = element.dataset.darkStyle.split(';').map(a => a.trim()).filter(a => a)
        let style = ''
        for(let stylePart of styleData) {
          const [key, value] = stylePart.split(':').map(a => a.trim())
          style += `${key}:${value} !important;`
        }

        let darkStyle = darkStyles.find(a => a.style === style)
        if(!darkStyle) {
          darkStyle = {
            style,
            class: '_' + crypto.randomUUID().replaceAll('-', '')
          }
          darkStyles.push(darkStyle)
        }
        element.classList.add(darkStyle.class)
      }

      if(darkStyles.length) {
        const newDarkStyle = document.createElement('style')
        newDarkStyle.id = 'darkStyle'
        newDarkStyle.innerHTML = darkStyles.map(a => `.theseed-dark-mode .${a.class}{${a.style}}`).join('')
        document.body.appendChild(newDarkStyle)
      }

      const times = element.querySelectorAll('time[data-type=timezone]')
      for(let time of times) {
        const type = time.dataset.type
        const date = new Date(time.dateTime)

        const dateStr = [
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate()
        ].map(num => num.toString().padStart(2, '0')).join('-')

        const timeStr = [
          date.getHours(),
          date.getMinutes(),
          date.getSeconds()
        ].map(num => num.toString().padStart(2, '0')).join(':')

        let result = dateStr + ' ' + timeStr

        if(type === 'timezone') {
          const offset = -(date.getTimezoneOffset() / 60)
          result += (offset > 0 ? '+' : '-') + (offset * 100).toString().padStart(4, '0')
        }

        time.textContent = result
      }

      // if(!this.discuss) {
      //   const hash = decodeURIComponent(location.hash.slice(1));
      //   window.history.pushState(null, null, hash);
      //   const anchorElem = document.getElementById(hash);
      //   anchorElem?.scrollIntoView();
      // }
    },
    setupFootnoteTooltip(element) {
      let hovering = 0
      const mouseLeaveHandler = _ => {
        requestAnimationFrame(() => requestAnimationFrame( () =>{
          hovering--

          if(!hovering)
            this.popover.show = false
        }))
      }

      const popover = this.$refs.popover
      popover.addEventListener('mouseenter', _ => {
        hovering++
      })
      popover.addEventListener('mouseleave', mouseLeaveHandler)

      for(let footnote of this.getFootnotes(element)) {
        const targetId = footnote.getAttribute('href').slice(1)
        const contentElement = document.getElementById(targetId).parentElement

        footnote.title = ''

        const update = () => computePosition(footnote, popover, {
          placement: 'top',
          middleware: [
            offset(5),
            flip(),
            shift()
          ]
        }).then(({x, y, placement, middlewareData}) => {
          popover.setAttribute('x-placement', placement)
          Object.assign(popover.style, {
            left: `${x}px`,
            top: `${y}px`,
          })

          this.$refs.popoverArrow.style.left = `calc(50% - 10px - ${middlewareData.shift.x}px)`
        })

        footnote.addEventListener('mouseenter', async _ => {
          hovering++

          this.popover.show = true
          this.popover.content = contentElement.innerHTML
          this.popover.cleanup = autoUpdate(footnote, popover, update)
        })

        footnote.addEventListener('mouseleave', mouseLeaveHandler)
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
    },
    updateUserbox(value) {
      function escapeHtml(str) {
        return str.replace(/[&<>"']/g, function(match) {
          switch(match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
          }
        });
      }

      this.userbox = value;
      let pairHtml = "";
      for ([key, value] of Object.entries(this.userbox.parameterAlert)) {
        pairHtml += `
          <tr>
            <td style="text-align:center; word-break: break-all;">
              <div class="wiki-paragraph"><strong>${key}</strong></div>
            </td>
            <td style="text-align:center; word-break: break-all;">
              <div class="wiki-paragraph"><code>${escapeHtml(value)}</code></div>
            </td>
          </tr>
        `
      }

      this.userboxHtml = `<dl class="wiki-folding" :key="userbox.parameterAlertKey">
        <dt>매개변수 목록 [ 펼치기 · 접기 ]</dt>
        <dd class="wiki-folding-close-anim">
          <div class="wiki-table-wrap" style="width:100%;">
            <table class="wiki-table" style="width:100%;background-color:transparent;">
              <tbody>
                <tr style="background-color:#ccc;" data-dark-style="background-color:#333;">
                  <td style="width:50%;text-align:center;">
                    <div class="wiki-paragraph">
                      <strong>매개변수</strong>
                    </div>
                  </td>
                  <td style="text-align:center;">
                    <div class="wiki-paragraph">
                      <strong>값</strong>
                    </div>
                  </td>
                </tr>
                ${pairHtml}
              </tbody>
            </table>
          </div>
        </dd>
      </dl>`
    }
  }
}
</script>
<style scoped>
@import '@/assets/css/wikiContent.css'
</style>