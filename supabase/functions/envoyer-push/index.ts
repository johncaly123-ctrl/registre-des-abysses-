// Edge Function : envoie une notification push web à chaque nouveau message
// privé (déclenchée par un Database Webhook Supabase sur INSERT dans
// messages_prives — voir README de déploiement dans la conversation
// d'implémentation / la mémoire du projet).
//
// Secrets requis (Dashboard Supabase -> Edge Functions -> Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") ?? "mailto:contact@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  const payload = await req.json();
  const message = payload.record; // ligne insérée dans messages_prives
  if (!message?.destinataire) return new Response("ignoré : pas de destinataire", { status: 200 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: abonnements, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, souscription")
    .eq("utilisateur", message.destinataire);

  if (error) return new Response(`erreur lecture abonnements: ${error.message}`, { status: 500 });

  const notification = JSON.stringify({
    titre: "📬 Nouveau message privé",
    corps: String(message.contenu || "").slice(0, 120),
    url: "/",
  });

  const resultats = await Promise.allSettled(
    (abonnements || []).map((a) => webpush.sendNotification(a.souscription, notification))
  );

  // Un abonnement expiré (410 Gone) n'est plus valide : on le retire pour ne
  // pas réessayer indéfiniment.
  const perimes = (abonnements || []).filter((a, i) => {
    const r = resultats[i];
    return r.status === "rejected" && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404);
  });
  if (perimes.length) {
    await supabase.from("push_subscriptions").delete().in("id", perimes.map((a) => a.id));
  }

  return new Response(`push envoyé à ${abonnements?.length ?? 0} abonnement(s)`, { status: 200 });
});
