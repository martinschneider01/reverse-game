import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    // 'prompt' (vs 'autoUpdate'): the new SW waits in 'installed' state so
    // we can surface a "Nouvelle version disponible" banner — autoUpdate
    // swaps the SW silently but the live tab keeps serving the old
    // precached HTML/JS until a manual reload anyway.
    registerType: 'prompt',
    devOptions: {
      enabled: false,
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      navigateFallback: 'index.html',
    },
    manifest: {
      name: 'Reverso',
      short_name: 'Reverso',
      description: 'Party-game vocal: enregistre, inverse, devine.',
      lang: 'fr',
      start_url: '.',
      scope: '.',
      theme_color: '#0f0c29',
      background_color: '#0f0c29',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: 'icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'icon-192-maskable.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: 'icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
  }), cloudflare()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});