import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(
      process.env.COMMIT_REF?.slice(0, 7) ||
      new Date().toISOString().slice(0, 16).replace('T', ' ')
    )
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Bonsai',
        short_name: 'Bonsai',
        description: 'Твой путь, твои ветки',
        theme_color: '#061224',
        background_color: '#061224',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
