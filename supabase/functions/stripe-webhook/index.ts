// Edge Function : reçoit les webhooks Stripe (checkout.session.completed)
// déclenchés par les sessions de don (voir creer-session-don), et attribue
// automatiquement le palier d'ailes correspondant dans profils.niveau_ailes.
//
// Depuis la v18 (supabase-setup.sql), le palier est calcule sur le CUMUL
// reel des dons (table `dons`), pas seulement le montant de cette
// transaction : chaque paiement est d'abord journalise dans `dons` (insert
// idempotent via stripe_session_id unique — Stripe peut renvoyer le meme
// evenement plusieurs fois), puis on relit la somme totale pour ce profil
// avant de determiner le palier. Ca permet a `creer-session-don` de ne
// facturer que la difference pour monter de palier, sans que ce webhook
// n'ait besoin de connaitre cette logique de delta.
//
// Le trigger `protege_niveau_ailes` (supabase-setup.sql) ne bloque le
// changement de niveau_ailes que pour les rôles authenticated/anon — le
// client service_role utilisé ici passe donc librement, sans avoir besoin
// d'aucun changement de schéma ou de trigger supplémentaire (meme chose
// pour l'insertion dans `dons`, qui n'a pas de policy pour ces roles).
//
// Chaque session Stripe doit être créée avec client_reference_id=<uuid
// Supabase du donateur> (voir creer-session-don côté Edge Function, appelé
// depuis ProfilModal) : sans cet identifiant, impossible de savoir quel
// profil créditer, et le don est simplement journalisé sans effet (à
// réconcilier manuellement).
//
// Secrets requis (Dashboard Supabase -> Edge Functions -> Secrets) :
//   STRIPE_WEBHOOK_SECRET (Dashboard Stripe -> Webhooks -> l'endpoint -> "Signing secret")
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.
//
// Côté Stripe : créer un endpoint webhook pointant vers l'URL de cette
// fonction une fois déployée, abonné à l'événement checkout.session.completed.
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Doit rester synchronisé avec MONTANTS_NIVEAUX dans src/App.jsx — Deno ne
// peut pas importer ce fichier, donc dupliqué ici volontairement.
const MONTANTS_NIVEAUX_EUROS = [5, 12, 20];

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const corpsBrut = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(corpsBrut, signature ?? "", STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`signature Stripe invalide : ${err.message}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("evenement ignore (" + event.type + ")", { status: 200 });
  }

  const session = event.data.object;
  const userId = session.client_reference_id;
  const montantTransaction = (session.amount_total ?? 0) / 100; // centimes -> euros

  if (!userId) {
    return new Response("don sans client_reference_id : a reconcilier manuellement", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Journalise ce paiement (idempotent : un evenement Stripe redelivre ne
  // doit pas etre compte deux fois dans le cumul).
  const { error: erreurInsertionDon } = await supabase
    .from("dons")
    .upsert(
      { profil_id: userId, montant_euros: montantTransaction, stripe_session_id: session.id },
      { onConflict: "stripe_session_id", ignoreDuplicates: true }
    );
  if (erreurInsertionDon) {
    return new Response("echec enregistrement du don : " + erreurInsertionDon.message, { status: 500 });
  }

  // Le palier se calcule desormais sur le CUMUL reel de tous les dons de ce
  // profil (pas seulement cette transaction) - voir v18, supabase-setup.sql.
  const { data: dons, error: erreurLectureDons } = await supabase
    .from("dons")
    .select("montant_euros")
    .eq("profil_id", userId);
  if (erreurLectureDons) {
    return new Response("echec lecture du cumul de dons : " + erreurLectureDons.message, { status: 500 });
  }
  const montantCumule = (dons || []).reduce((total, d) => total + Number(d.montant_euros), 0);

  // Le palier atteint est le plus haut palier dont le cumul est couvert -
  // permet un don legerement au-dessus d'un palier sans etre ignore.
  let palier = 0;
  MONTANTS_NIVEAUX_EUROS.forEach((montant, i) => {
    if (montantCumule >= montant) palier = i + 1;
  });
  if (palier < 1) {
    return new Response("cumul " + montantCumule + " EUR sous le premier palier, ignore", { status: 200 });
  }

  const { data: profilActuel, error: erreurLecture } = await supabase
    .from("profils")
    .select("niveau_ailes")
    .eq("id", userId)
    .single();
  if (erreurLecture) {
    return new Response("profil " + userId + " introuvable : " + erreurLecture.message, { status: 200 });
  }

  // Ne fait jamais redescendre le palier - un don plus petit apres un don
  // plus gros ne doit pas retrograder le donateur.
  const nouveauNiveau = Math.max(Number(profilActuel?.niveau_ailes) || 0, palier);
  const { error: erreurEcriture } = await supabase
    .from("profils")
    .update({ niveau_ailes: nouveauNiveau })
    .eq("id", userId);
  if (erreurEcriture) {
    return new Response("echec mise a jour niveau_ailes : " + erreurEcriture.message, { status: 500 });
  }

  return new Response("palier " + nouveauNiveau + " attribue a " + userId + " (don de " + montantTransaction + " EUR, cumul " + montantCumule + " EUR)", { status: 200 });
});
