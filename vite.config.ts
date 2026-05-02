import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-maskable.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}']
      },
      manifest: {
        name: 'Fourier Draw',
        short_name: 'FourierDraw',
        description: 'Draw a shape and watch it decompose into rotating Fourier epicycles.',
        theme_color: '#0b0f17',
        background_color: '#0b0f17',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173
  }
});
