// Abonnement du navigateur aux notifications push (nouveaux messages privés).
// Ce module gère uniquement le côté client : demander la permission,
// s'abonner via le service worker, et stocker l'abonnement dans Supabase.
//
// L'envoi effectif d'un push (à la réception d'un message) nécessite un
// dispatcher côté serveur (Edge Function ou webhook Supabase) signé avec la
// clé VAPID PRIVÉE correspondant à VAPID_CLE_PUBLIQUE ci-dessous — ce
// déploiement reste à faire manuellement (voir le rapport de fin de session).
import { supabase } from "./supabaseClient.js";

export const VAPID_CLE_PUBLIQUE = "BA2a2j41g3oaASGmEylQO4oYnXVGMS2xLWW1rHqbyDTtsZ3XhIih9-K-ZI_9CmPnD3B2Sf1Dycvz1Jl-0PahMnM";

export function pushSupporte() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64VersUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Sur = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(base64Sur);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

export async function abonnementPushActuel() {
  if (!pushSupporte()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function activerNotificationsPush(userId) {
  if (!pushSupporte()) throw new Error("Notifications push non supportées par ce navigateur.");
  if (!supabase || !userId) throw new Error("Connecte-toi pour activer les notifications.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission de notification refusée.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64VersUint8Array(VAPID_CLE_PUBLIQUE),
    });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      utilisateur: userId,
      endpoint: subscription.endpoint,
      souscription: subscription.toJSON(),
    },
    { onConflict: "utilisateur,endpoint" }
  );
  if (error) throw error;

  return subscription;
}

export async function desactiverNotificationsPush(userId) {
  const subscription = await abonnementPushActuel();
  if (subscription && supabase && userId) {
    await supabase.from("push_subscriptions").delete().eq("utilisateur", userId).eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
}
