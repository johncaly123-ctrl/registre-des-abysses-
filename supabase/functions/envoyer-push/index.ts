// Edge Function : envoie une notification push web à chaque nouveau message
// privé (messages_prives) OU chaque nouvelle réponse dans un sujet de la
// Taverne auquel l'utilisateur est abonné (messages, voir abonnements_sujets
// v21) — voir README de déploiement dans la conversation d'implémentation /
// la mémoire du projet.
//
// Secrets requis (Dashboard Supabase -> Edge Functions -> Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL, PUSH_WEBHOOK_SECRET
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.
//
// verify_jwt est désactivé sur cette fonction (le trigger Postgres qui
// l'appelle via pg_net ne sait pas facilement joindre un JWT) : à la place,
// on vérifie un secret partagé envoyé en en-tête par le trigger (voir
// supabase-setup.sql, le secret vit dans Supabase Vault, jamais en clair
// dans le SQL committé) — sans ça, n'importe qui connaissant l'URL publique
// de la fonction pouvait forger une notification vers n'importe quel
// utilisateur.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") ?? "mailto:contact@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Envoie la notification à chaque abonnement, puis retire ceux qui reviennent
// périmés (410 Gone / 404) pour ne pas réessayer indéfiniment.
async function envoyerEtNettoyer(supabase, abonnements, notification) {
  const resultats = await Promise.allSettled(
    (abonnements || []).map((a) => webpush.sendNotification(a.souscription, notification))
  );
  const perimes = (abonnements || []).filter((a, i) => {
    const r = resultats[i];
    return r.status === "rejected" && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404);
  });
  if (perimes.length) {
    await supabase.from("push_subscriptions").delete().in("id", perimes.map((a) => a.id));
  }
  return abonnements?.length ?? 0;
}

Deno.serve(async (req) => {
  if (!PUSH_WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== PUSH_WEBHOOK_SECRET) {
    return new Response("non autorisé", { status: 401 });
  }
  const payload = await req.json();
  const message = payload.record; // ligne insérée dans messages_prives OU messages
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (message?.destinataire !== undefined) {
    // ---- message privé (messages_prives) ----
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
    const n = await envoyerEtNettoyer(supabase, abonnements, notification);
    return new Response(`push envoyé à ${n} abonnement(s)`, { status: 200 });
  }

  if (message?.sujet_id !== undefined && message?.sujet_id !== null) {
    // ---- réponse dans un sujet de la Taverne (messages) ----
    const { data: abonnes, error: erreurAbo } = await supabase
      .from("abonnements_sujets")
      .select("utilisateur")
      .eq("sujet_id", message.sujet_id)
      .neq("utilisateur", message.auteur); // ne pas se notifier soi-même

    if (erreurAbo) return new Response(`erreur lecture abonnements sujet: ${erreurAbo.message}`, { status: 500 });
    if (!abonnes?.length) return new Response("push envoyé à 0 abonnement(s)", { status: 200 });

    const { data: abonnements } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, souscription")
      .in("utilisateur", abonnes.map((a) => a.utilisateur));

    const [{ data: sujet }, { data: auteurProfil }] = await Promise.all([
      supabase.from("sujets").select("titre").eq("id", message.sujet_id).maybeSingle(),
      supabase.from("profils").select("pseudo").eq("id", message.auteur).maybeSingle(),
    ]);

    const notification = JSON.stringify({
      titre: `💬 ${auteurProfil?.pseudo || "Un éleveur"} a répondu`,
      corps: `${sujet?.titre ? `"${sujet.titre}" — ` : ""}${String(message.contenu || "").slice(0, 120)}`,
      url: "/?page=taverne",
    });
    const n = await envoyerEtNettoyer(supabase, abonnements, notification);
    return new Response(`push envoyé à ${n} abonnement(s)`, { status: 200 });
  }

  return new Response("ignoré : ni message privé ni message de sujet", { status: 200 });
});
