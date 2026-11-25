import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The app is served from hadijawedd.netlify.app/finance-tracker/
export default defineConfig({
  base: '/finance-tracker/',
  build: { outDir: '../dist/finance-tracker', emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/finance-tracker/',
        name: 'Finance Tracker by Hadi Jawed',
        short_name: 'Finance',
        description: 'Track spending, bills, budgets, goals and net worth. Free, private, and it works offline.',
        start_url: '/finance-tracker/',
        scope: '/finance-tracker/',
        display: 'standalone',
        background_color: '#F4F5FF',
        theme_color: '#2438F0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/finance-tracker/index.html',
        navigateFallbackAllowlist: [/^\/finance-tracker/]
      }
    })
  ]
});
