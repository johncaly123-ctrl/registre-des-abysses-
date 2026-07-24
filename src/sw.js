// Service worker custom (mode injectManifest) : reprend le précaching de
// l'app shell généré par vite-plugin-pwa, et ajoute la réception des
// notifications push (nouveaux messages privés) — non couvert par le mode
// generateSW utilisé jusqu'ici.
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// registerType "autoUpdate" : le client envoie ce message dès qu'un nouveau
// service worker est détecté, pour qu'il prenne la main immédiatement.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch (e) {
    donnees = { titre: "Registre des Abysses", corps: event.data ? event.data.text() : "" };
  }

  const titre = donnees.titre || "Registre des Abysses";
  const options = {
    body: donnees.corps || "Nouveau message privé.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: donnees.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
