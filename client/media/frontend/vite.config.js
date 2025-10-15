import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { fileURLToPath, URL } from 'url'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { execSync } from 'child_process'

import skinRawLoaderPlugin from './vitePlugins/skinRawLoader'
import metadata from './vitePlugins/metadata'

// https://vite.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const skin = env.SKIN_NAME || fs.readdirSync('./skins')[0]

  const srcPath = fileURLToPath(new URL('./src', import.meta.url))
  const skinPath = path.resolve('./skins', skin)

  const commitIds = {
    frontend: execSync('git rev-parse --short HEAD').toString().trim(),
    skin: execSync('git rev-parse --short HEAD', {
      cwd: skinPath
    }).toString().trim()
  }
  const commitDates = {
    frontend: new Date(Number(execSync('git log -1 --format="%at"').toString().trim()) * 1000),
    skin: new Date(Number(execSync('git log -1 --format="%at"', {
      cwd: skinPath
    }).toString().trim()) * 1000)
  }
  const versionHeader = crypto.createHash('md5')
      .update(skin + JSON.stringify(commitIds))
      .digest('hex')
      .slice(0, 17)

  const apiProxy = {
    target: env.API_HOST || 'http://localhost:3000',
    changeOrigin: true
  }

  return defineConfig({
    plugins: [
      vue(),
      vueDevTools(),
      skinRawLoaderPlugin(skin),
      ...(isSsrBuild ? [] : [
        metadata({ name: skin, versionHeader, commitIds, commitDates }, env.METADATA_PATH || './dist')
      ])
    ],
    define: {
      __THETREE_COMMIT_IDS__: JSON.stringify(commitIds),
      __THETREE_VERSION_HEADER__: JSON.stringify(versionHeader),
      __THETREE_COMMIT_DATES__: JSON.stringify(commitDates),
      __THETREE_SKIN_NAME__: JSON.stringify(skin),
    },
    base: (process.env.NODE_ENV === 'production' || env.METADATA_PATH) ? `/skins/${skin}` : '/',
    publicDir: isSsrBuild ? false : 'public',
    resolve: {
      extensions: ['.js', '.vue'],
      alias: {
        // vue: 'vue/dist/vue.esm-bundler.js',
        '@': srcPath,
        '~': srcPath,
        'skin': skinPath,

        'vuex': path.resolve(srcPath, 'main'),
      },
    },
    server: {
      proxy: {
        '/internal': apiProxy,
        '/sidebar.json': apiProxy,
        '/socket.io': apiProxy
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: isSsrBuild ? 'cjs' : 'esm'
        }
      }
    },
    ssr: {
      noExternal: true
    }
  })
})