import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const mockAuthEnabled = String(env.VITE_ENABLE_MOCK_AUTH ?? 'true').toLowerCase() === 'true'
  /** When `VITE_API_BASE_URL` is like `/api/sparkpayapi`, forward `/api` to the real backend (avoids CORS in dev). */
  const devApiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8077'
  /** Production path behind nginx, e.g. `/belema/`. Dev stays `/`. */
  const base = String(env.VITE_BASE_PATH || '/').trim() || '/'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@system-users-seed': path.resolve(
          __dirname,
          mockAuthEnabled
            ? './src/app/store/systemUsers.mock.js'
            : './src/app/store/systemUsers.empty.js'
        ),
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],

    server: {
      proxy: {
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true,
          /** `/api/sparkpayapi/...` → `<target>/sparkpayapi/...` */
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})