import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import MainView from '../views/MainView.vue'

import { useStateStore } from '@/stores/state'

const router = () => {
  let state = null

  const waitPageLoad = () => {
    state ??= useStateStore()
    return new Promise(resolve => {
      if(!state.components.mainView.loadingView)
        return resolve()
      state.components.mainView.afterLoadView = resolve
    })
  }

  return createRouter({
    history: import.meta.env.SSR ? createMemoryHistory() : createWebHistory(),
    scrollBehavior(to, from, savedPosition) {
      return new Promise(async resolve => {
        await waitPageLoad()

        if(savedPosition
            && (savedPosition.left > 0
                || savedPosition.top > 0)) {
          resolve({
            ...savedPosition,
            behavior: (to.fullPath.replace(to.hash, '') === from.fullPath.replace(from.hash, ''))
                ? undefined
                : 'instant'
          })
        }
        else if(to.hash) switch(to.hash) {
          case '#toc': {
            const toc = document.getElementsByClassName('wiki-macro-toc')[0]
            resolve({
              el: toc ?? to.hash
            })
            break
          }
          default:
            resolve({
              el: to.hash
            })
        }
        else resolve({ left: 0, top: 0, behavior: 'instant' })
      })
    },

    routes: [
      {
        path: '/:path(.*)',
        name: 'main',
        component: MainView
      }
    ]
  })
}

export default router