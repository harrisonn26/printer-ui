import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, loadEnv } from 'vite'
import pkg from './package.json' with { type: 'json' }

// Moonraker paths proxied in dev, so the app always talks same-origin — the
// same shape as the nginx deploy (deploy/nginx-printer-ui.conf).
const MOONRAKER_PATHS = ['/websocket', '/server', '/printer', '/machine', '/access', '/api']

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.MOONRAKER_TARGET || 'http://192.168.0.140:7125'

  return {
    plugins: [svelte()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    server: {
      proxy: Object.fromEntries(
        MOONRAKER_PATHS.map(path => [path, { target, ws: path === '/websocket', changeOrigin: true }])
      )
    },
    test: {
      globals: true,
      environment: 'node'
    }
  }
})
