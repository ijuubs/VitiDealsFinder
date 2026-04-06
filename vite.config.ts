import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: "/",   // critical for Netlify deployment

    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg"],
        manifest: {
          name: "Fiji Smart Deals",
          short_name: "Smart Deals",
          description: "Find the best supermarket deals in Fiji",
          theme_color: "#059669",
          icons: [
            {
              src: "icon.svg",
              sizes: "192x192 512x512",
              type: "image/svg+xml"
            }
          ]
        }
      })
    ],

    define: {
      __GEMINI_API_KEY__: JSON.stringify(env.GEMINI_API_KEY)
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, ".")
      }
    },

    server: {
      hmr: process.env.DISABLE_HMR !== "true"
    }
  };
});
