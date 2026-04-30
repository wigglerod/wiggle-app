import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function resolveAppVersion() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
    if (sha) return sha
  } catch { /* not a git checkout */ }
  // eslint-disable-next-line no-undef -- process is a Node global in build context
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    // eslint-disable-next-line no-undef -- process is a Node global in build context
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  }
  return new Date().toISOString().slice(0, 16).replace('T', '-')
}

const APP_VERSION = resolveAppVersion()
const APP_BUILT_AT = new Date().toISOString()
const VERSION_PAYLOAD = JSON.stringify({ version: APP_VERSION, built_at: APP_BUILT_AT })

const versionEndpointPlugin = {
  name: 'wiggle-version-endpoint',
  apply: () => true,
  configureServer(server) {
    server.middlewares.use('/version.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(VERSION_PAYLOAD)
    })
  },
  writeBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: VERSION_PAYLOAD })
  },
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    versionEndpointPlugin,
    VitePWA({
      registerType: 'prompt',
      // Use virtual:pwa-register in main.jsx for aggressive update checks
      injectRegister: false,
      includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png', 'WiggleLogo.png', 'play.jpg'],
      manifest: {
        name: 'Wiggle Dog Walks',
        short_name: 'Wiggle',
        description: 'Dog walking schedule and management app',
        theme_color: '#E8634A',
        background_color: '#FFF4F1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^(?!\/__).*/],
        runtimeCaching: [
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache' },
          },
          // Google Fonts webfonts
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Supabase REST API — network-first, short cache for fresh dog data
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase Storage (dog photos) — cache-first
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'dog-photos-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Maps tiles — cache with 7-day expiry
          {
            urlPattern: /^https:\/\/maps\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-maps-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Acuity API — network-first, short cache
          {
            urlPattern: /\/api\/acuity.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'acuity-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
