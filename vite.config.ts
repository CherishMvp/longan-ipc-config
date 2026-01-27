import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'

const isElectron = process.env.VITE_ELECTRON === 'true' || 
  process.argv.includes('--mode') && process.argv.some(arg => arg.includes('electron'))

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/stores'],
      vueTemplate: true
    }),
    Components({
      dirs: ['src/components'],
      dts: 'src/components.d.ts'
    }),
    ...(isElectron ? [
      electron([
        {
          entry: 'electron/main.ts',
          onstart(options) {
            options.startup()
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron', 'better-sqlite3'] // Externalize native modules
              }
            }
          }
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            options.reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron'
            }
          }
        }
      ]),
      electronRenderer()
    ] : [])
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
