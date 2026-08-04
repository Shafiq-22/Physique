import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Vector — Physique Progress',
        short_name: 'Vector',
        description: 'Trend-based physique tracking that tells you what to do next.',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Supabase traffic is never cached: server state is the source of truth,
        // and writes made offline go through our own IndexedDB queue instead.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /supabase\.(co|in)$/.test(url.hostname),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
