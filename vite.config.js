import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        // Tout est déjà local-first (localStorage) : on met en cache l'app
        // shell pour un usage hors-ligne complet, Supabase reste réseau (les
        // requêtes API ne sont jamais interceptées par le service worker).
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Registre des Abysses — élevage de muldos",
        short_name: "Registre des Abysses",
        description: "Compagnon d'élevage de muldos : GPS d'accouplements, synchronisation par capture, généalogies, clonage, valeur du cheptel.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#17130f",
        theme_color: "#17130f",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Sépare les dépendances (qui changent rarement) du code de l'appli
        // (qui change à chaque déploiement) — les visiteurs récurrents
        // gardent le chunk vendor en cache d'un déploiement à l'autre.
        manualChunks: {
          vendor: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
