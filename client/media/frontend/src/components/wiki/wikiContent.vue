<template>
  <WikiCategory v-if="store.localConfig['page.categories']?.length && store.localConfig['wiki.category_position'] !== 'bottom'" :categories="store.localConfig['page.categories']" />
  <div ref="userbox" v-if="store.localConfig['page.userbox']?.parameterAlert && Object.keys(store.localConfig['page.userbox'].parameterAlert).length > 0" class="user-box admin-box">
    현재 {{ Object.keys(store.localConfig['page.userbox'].parameterAlert).length }}개의 매개변수가 미리보기에 적용되어 있습니다. 매개변수가 적용되면 include 문법을 사용할 수 없습니다.
    <div class="wiki-content" v-html="userboxHtml"></div>
  </div>
  <div ref="div" v-html="store.localConfig['page.content']" class="wiki-content" @submit.prevent="formSubmit"></div>
  <WikiCategory v-if="store.localConfig['page.categories']?.length && ['bottom', 'both'].includes(store.localConfig['wiki.category_position'])" :categories="store.localConfig['page.categories']"/>
  <div ref="popover" v-show="popover.show" id="tooltip" class="popper">
    <div ref="popoverArrow" id="tooltip-arrow" class="popper__arrow"></div>
    <div id="tooltip-content" class="wiki-content" v-html="popover.content"></div>
  </div>
</template>
<script>
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/vue'

import WikiCategory from "@/components/wiki/wikiCategory"
import { store } from '@/store.js'
import Common from '@/mixins/common'
import { sha256 } from '@/utils'

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
      userboxHtml: "",
      store
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

    import('@justinribeiro/lite-youtube')
  },
  beforeUnmount() {
    for(let func of this.cleanupFunctions)
      func()
    this.cleanupFunctions.length = 0
  },
  computed: {
    pageContent() {
      return store.localConfig['page.content'];
    },
    pageUserbox() {
      return store.localConfig['page.userbox'];
    }
  },
  watch: {
    'popover.show'(newValue) {
      if(!newValue)
        this.popover.cleanup?.()
    },
    pageContent: {
      async handler() {
        await this.$nextTick();
        await this.setupWikiContent();
      },
      immediate: true
    },
    pageUserbox: {
      async handler(newVal) {
        this.updateUserbox(newVal);
        await this.$nextTick();
        if (this.$refs.userbox) this.setupWikiContent(this.$refs.userbox);
      },
      immediate: true
    },
    $route() {
      this.popover.show = false
    }
  },
  methods: {
    getFootnotes(element) {
      return [...element.getElementsByClassName('wiki-fn-content')]
    },
    async setupWikiContent(element = this.$refs.div) {
      {
        const imageHide = store.localConfig['wiki.image_hide']
        const disableImageLazy = store.localConfig['wiki.disable_image_lazy']

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
              if(!disableImageLazy)
                img.setAttribute('loading', 'lazy')
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

            if(!disableImageLazy)
              video.setAttribute('loading', 'lazy')

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

          if(imageHide === 'hide' || (imageHide === 'hide_1mb' && !isNaN(size) && size >= (1024 * 1024))) {
            const btn = document.createElement('button')
            btn.setAttribute('type', 'button')
            btn.classList.add('wiki-image', 'wiki-image-show-button')

            let sizeText = ''
            if(size) {
              if(size > 1024 * 1024)
                sizeText = (size / 1024 / 1024).toFixed(2) + 'MB'
              else if(size > 1024)
                sizeText = (size / 1024).toFixed(2) + 'KB'
              else
                sizeText = size + 'bytes'
            }
            sizeText &&= ` (${sizeText})`

            btn.innerText = (img.dataset.src ? '이미지' : '동영상') + sizeText

            const removeBtnListener = () => {
              btn.removeEventListener('click', onBtnClick)
            }
            this.cleanupFunctions.push(removeBtnListener)

            let onBtnClick = e => {
              if(!onBtnClick) return

              e?.preventDefault()
              removeBtnListener()
              onBtnClick = null
              parent.insertBefore(img, btn)
              parent.removeChild(btn)
              loadImg()
            }

            btn.addEventListener('click', onBtnClick)
            parent.insertBefore(btn, img)
            parent.removeChild(img)
          }
          else loadImg()
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

        if(store.localConfig['wiki.hide_heading_content']) {
          heading.classList.add('wiki-heading-folded');
          heading.nextElementSibling.classList.add('wiki-heading-content-folded');
        }
      }

      const foldings = element.getElementsByClassName('wiki-folding')
      const showFolding = store.localConfig['wiki.show_folding']
      const disableFoldingAnimation = store.localConfig['wiki.disable_folding_animation']
      for (let folding of foldings) {
        if (!disableFoldingAnimation) this.cleanupFunctions.push(this.setupFoldingAnimation(folding).cleanup)
        if (showFolding) folding.open = true
      }
      if (!disableFoldingAnimation) {
        const tocs = element.getElementsByClassName('wiki-macro-toc')
        for (let toc of tocs) {
          const details = toc.getElementsByTagName('details')[0]
          if (!details) continue
          this.cleanupFunctions.push(this.setupFoldingAnimation(details).cleanup)
        }
      }

      // let footnoteType = this.$store.state.localConfig['wiki.footnote_type'];
      let footnoteType = "popover"

      if(footnoteType === 'popover') this.setupFootnoteTooltip(element)

      if(store.localConfig['wiki.unfold_wiki_link']) {
        const links = element.getElementsByClassName('wiki-link-internal')
        for(let link of links) {
          if(link.tagName !== 'A') continue

          const title = link.getAttribute('title')
          if(!title) continue
          let checkTitle = title

          const anchorPos = title.lastIndexOf('#')
          if(anchorPos !== -1)
            checkTitle = title.slice(0, anchorPos)

          if(checkTitle.trim() === link.innerText.trim())
            continue
          if(link.getElementsByTagName('img').length)
            continue

          const unfolded = document.createElement('span')
          unfolded.classList = 'wiki-link-unfolded'
          unfolded.innerText = title

          const linkParent = link.parentNode
          if(linkParent) {
            if(link.nextSibling)
              linkParent.insertBefore(unfolded, link.nextSibling)
            else
              linkParent.appendChild(unfolded)
          }
        }
      }

      const oldDarkStyle = document.getElementById('darkStyle')
      if(oldDarkStyle) oldDarkStyle.remove()

      const darkStyleElements = document.querySelectorAll('*[data-dark-style]')
      const darkStyles = []
      for(let element of darkStyleElements) {
        const className = '_' + (await sha256(element.dataset.darkStyle))
        if(element.classList.contains(className))
          continue

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
            class: '_' + className
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

      const tables = [...element.getElementsByClassName('wiki-table')]
      for(let table of tables) {
        const thead = [...table.children].find(e => e.tagName === 'THEAD')
        const tbody = [...table.children].find(e => e.tagName === 'TBODY')
        if(!thead || !tbody) continue
        if(tbody.querySelector('td[colspan]')
            || tbody.querySelector('td[rowspan]'))
          continue
        const lastHeaderRow = [...thead.getElementsByTagName('tr')].pop()
        if(!lastHeaderRow) continue
        const headerCells = [...lastHeaderRow.children].filter(e => e.tagName === 'TH')
        const rows = [...tbody.children].filter(e => e.tagName === 'TR')
        for(let cellIndex in headerCells) {
          const cell = headerCells[cellIndex]
          if(!cell.classList.contains('wiki-table-sortable'))
            continue
          cell.classList.add('sortable-table-head-cell')
          const sortDirections = ['original', 'asc', 'desc']
          const nextSortDirection = str => sortDirections[(sortDirections.indexOf(str) + 1) % sortDirections.length]
          const onCellClick = () => {
            for(let otherCell of headerCells)
              if(cell !== otherCell) delete otherCell.dataset.sortDirection
            const direction = cell.dataset.sortDirection = nextSortDirection(cell.dataset.sortDirection || 'original')
            const directionNum = direction === 'asc' ? 1 : -1
            const sorted = [...rows]
            if(direction !== 'original') sorted.sort((a, b) => {
              const cellA = [...a.children].filter(e => e.tagName === 'TD')[cellIndex]
              const cellB = [...b.children].filter(e => e.tagName === 'TD')[cellIndex]
              const textA = cellA ? cellA.textContent : ''
              const textB = cellB ? cellB.textContent : ''
              if(textA === textB) return 0
              const numA = textA ? parseFloat(textA.replaceAll(',', ''), 10) : NaN
              const numB = textB ? parseFloat(textB.replaceAll(',', ''), 10) : NaN
              if(isNaN(numA) || isNaN(numB))
                return (textA > textB ? 1 : -1) * directionNum
              else
                return (numA - numB) * directionNum
            })
            for(let row of sorted)
              tbody.appendChild(row)
          }
          cell.addEventListener('click', onCellClick)
          this.cleanupFunctions.push(() => {
            cell.removeEventListener('click', onCellClick)
            cell.classList.remove('sortable-table-head-cell')
          })
        }
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
    setupFoldingAnimation(details) {
      const summary = details.getElementsByTagName('summary')[0]
      const content = summary.nextElementSibling
      if(!summary || !content) return
      let animation = null
      let isClosing = false
      let isOpening = false
      const onAnimationEnd = open => {
        animation = null
        isClosing = false
        isOpening = false
        details.open = open
        details.style.height = ''
        details.style.overflow = ''
      }
      const onSummaryClick = e => {
        e.preventDefault()
        details.style.overflow = 'hidden'
        if(isClosing || !details.open) {
          details.style.height = details.offsetHeight + 'px'
          details.open = true
          requestAnimationFrame(() => {
            isOpening = true
            const start = details.offsetHeight + 'px'
            const end = summary.offsetHeight + content.offsetHeight + 'px'
            animation?.cancel()
            animation = details.animate({
              height: [start, end]
            }, {
              duration: 100,
              easing: 'ease-in'
            })
            animation.addEventListener('finish', () => {
              onAnimationEnd(true)
            })
            animation.addEventListener('cancel', () => {
              isOpening = false
            })
          })
        }
        else if(isOpening || details.open) {
          requestAnimationFrame(() => {
            isClosing = true
            const start = details.offsetHeight + 'px'
            const end = summary.offsetHeight + 'px'
            animation?.cancel()
            animation = details.animate({
              height: [start, end]
            }, {
              duration: 100,
              easing: 'ease-out'
            })
            animation.addEventListener('finish', () => {
              onAnimationEnd(false)
            })
            animation.addEventListener('cancel', () => {
              isClosing = false
            })
          })
        }
      }
      summary.addEventListener('click', onSummaryClick)
      return {
        cleanup: () => {
          animation?.cancel()
          details.style.height = ''
          details.style.overflow = ''
          summary.removeEventListener('click', onSummaryClick)
        }
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
    updateUserbox(userbox) {
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

      let pairHtml = "";
      for ([key, value] of Object.entries(userbox?.parameterAlert ?? {})) {
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

      this.userboxHtml = `<details class="wiki-folding" :key="userbox.parameterAlertKey">
        <summary> 매개변수 목록 [ 펼치기 · 접기 ]</summary>
        <div>
          <div class="wiki-table-wrap" style="width: 100%">
            <table class="wiki-table"  style="width: 100%; background-color: transparent">
              <tbody>
                <tr style="background-color:#ccc;" data-dark-style="background-color:#333;">
                  <td style="width:50%;text-align:center;">
                    <div class="wiki-paragraph"><strong>매개변수</strong></div>
                  </td>
                  <td style="text-align:center;">
                    <div class="wiki-paragraph"><strong>값</strong></div>
                  </td>
                </tr>
                ${pairHtml}
              </tbody>
            </table>
          </div><br>
        </div>
      </details>`
    }
  }
}
</script>
<style scoped>
.popper {
  background: #fff;
  border-radius: 3px;
  box-shadow: 0 0 2px rgba(0,0,0,.5);
  max-width: 50%;
  padding: 15px;
  position: absolute;
  word-break: break-all;
  z-index: 1;
}

.theseed-dark-mode .popper {
  background: #383b40;
  box-shadow: 0 0 2px hsla(0,0%,100%,.5);
}

.popper .popper__arrow {
  border-color: #ddd;
  border-style: solid;
  height: 0;
  margin: 5px;
  position: absolute;
  width: 0;
}

.theseed-dark-mode .popper .popper__arrow {
  border-color: #ccc;
}

.popper[x-placement^=top] {
  margin-bottom: 5px;
}

.popper[x-placement^=top] .popper__arrow {
  border-bottom-color: transparent;
  border-left-color: transparent;
  border-right-color: transparent;
  border-width: 5px 5px 0;
  bottom: -5px;
  left: calc(50% - 10px);
  margin-bottom: 0;
  margin-top: 0;
}

.popper[x-placement^=bottom] {
  margin-top: 5px
}

.popper[x-placement^=bottom] .popper__arrow {
  border-left-color: transparent;
  border-right-color: transparent;
  border-top-color: transparent;
  border-width: 0 5px 5px;
  left: calc(50% - 10px);
  margin-bottom: 0;
  margin-top: 0;
  top: -5px;
}

.popper[x-placement^=right] {
  margin-left: 5px
}

.popper[x-placement^=right] .popper__arrow {
  border-bottom-color: transparent;
  border-left-color: transparent;
  border-top-color: transparent;
  border-width: 5px 5px 5px 0;
  left: -5px;
  margin-left: 0;
  margin-right: 0;
  top: calc(50% - 10px);
}

.popper[x-placement^=left] {
  margin-right: 5px;
}

.popper[x-placement^=left] .popper__arrow {
  border-bottom-color: transparent;
  border-right-color: transparent;
  border-top-color: transparent;
  border-width: 5px 0 5px 5px;
  margin-left: 0;
  margin-right: 0;
  right: -5px;
  top: calc(50% - 10px);
}

:deep(.thetree-modal-container) {
  padding-top: 10rem;
}

:deep(.thetree-modal-container):focus {
  outline: 0 !important;
}

.thetree-modal-content .wiki-content {
  padding: 1rem;
}

.thetree-modal-content button {
  background-color: #fafafa;
  border: 0;
  border-top: 1px solid #eee;
  color: inherit;
  cursor: pointer;
  font-size: 12px !important;
  font: inherit;
  margin: 2px 0 0;
  outline: none;
  padding: 10px;
  width: 100%;
}

.theseed-dark-mode .thetree-modal-content button {
  background-color: #383b40;
  border-top: 1px solid #111;
}

 .user-box {
   border-width: 5px 1px 1px;
   border-style: solid;
   border-image: initial;
   padding: 10px;
   margin-bottom: 10px;
 }

.admin-box {
  border-color: orange gray gray;
}

.admin-box:hover {
  border-color: red gray gray;
}

.banned-box {
  border-color: red gray gray;
}

.banned-box:hover {
  border-color: blue gray gray;
}
</style>