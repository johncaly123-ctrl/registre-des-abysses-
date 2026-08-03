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
        // Paliers visuels 2 et 4 des ailes de soutien : jamais servis par
        // l'UI (VISUEL_PAR_NIVEAU = [1,3,5] dans App.jsx), mais toujours
        // présents dans public/ailes/ — inutile de les précacher hors ligne.
        globIgnores: ["**/ailes/*-2*.png", "**/ailes/*-4*.png"],
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
  test: {
    // e2e/*.spec.js sont des specs Playwright (voir playwright.config.js),
    // pas des tests vitest — le glob par défaut de vitest les capterait sinon.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
