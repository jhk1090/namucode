import {createApp as createCSRApp, createSSRApp, markRaw} from 'vue'
import { createPinia } from 'pinia'
import { VueHeadMixin } from '@unhead/vue'
import { vfmPlugin } from 'vue-final-modal'
import { decode } from '@msgpack/msgpack'

import App from './App.vue'
import createRouter from './router'

import { useStateStore } from '~/stores/state'
import GlobalMixin from './mixins/global'

let store

export function useStore() {
    return store
}

function base64ToUint8Array(base64) {
    const binaryString = atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for(let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
}

export function createApp() {
    const app = import.meta.env.SSR
        ? createSSRApp(App)
        : createCSRApp(App)

    const router = createRouter()
    app.use(router)
    const pinia = createPinia()
    app.use(pinia)
    app.use(vfmPlugin)

    if(!import.meta.env.SSR && window.INITIAL_STATE) {
        pinia.state.value['state'] = decode(base64ToUint8Array(window.INITIAL_STATE))
        delete window.INITIAL_STATE
    }

    store = app.config.globalProperties.$store = {
        state: useStateStore(),
        commit(action, value) {
            switch(action) {
                case 'localConfigSetValue':
                    this.state.localConfigSetValue(value.key, value.value)
                    break
                case 'skinSetValue':
                    this.state.skinSetValue(value.key, value.value)
                    break
            }
        }
    }

    const globalComponents = import.meta.glob('./components/global/*.vue', {
        eager: true
    })
    for(let [path, def] of Object.entries(globalComponents)) {
        let name = path.split('/').pop().replace('.vue', '')
        name = name[0].toUpperCase() + name.slice(1)
        app.component(name, def.default)
    }

    if(!import.meta.env.SSR) {
        store.state.thetreePlugins.editor = Object.values(import.meta.glob('/plugins/editor/*/layout.vue', {
            eager: true,
            import: 'default'
        })).map(a => markRaw(a))
    }

    app.mixin(GlobalMixin)
    app.mixin(VueHeadMixin)

    return { app, router, pinia }
}