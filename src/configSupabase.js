// ---------- Configuration Supabase ----------
// 1. Colle ici l'URL de ton projet (Supabase → Settings → API → Project URL)
// 2. La clé "publishable" est prévue pour le navigateur : elle peut rester ici.
// 3. La clé SECRÈTE ne doit JAMAIS apparaître dans ce projet.
export const SUPABASE_URL = "https://fcdculpkrcuhtexmqojz.supabase.co";
export const SUPABASE_KEY = "sb_publishable_r_kwZOx1WMPJ0W4LDFrIcg_pjE--12O";

export const supabaseEstConfigure = () => SUPABASE_URL.startsWith("https://");

// Lien de don (Ko-fi, PayPal…) affiché sur la page Profil. Laisse vide pour masquer.
export const LIEN_DON = "https://paypal.me/caly191";

// Lien d'invitation Discord de la communauté, affiché dans le pied de page.
// Laisse vide tant que le serveur Discord n'existe pas (le lien est masqué).
export const LIEN_DISCORD = "https://discord.gg/wfHrGAzErb";

// Payment Links Stripe (Dashboard Stripe -> Payment Links -> "+ Créer") pour
// l'attribution AUTOMATIQUE du palier d'ailes : un lien "paiement unique"
// par palier, aux montants exacts 5 / 8 / 12 / 16 / 20 € (dans l'ordre —
// doit rester synchronisé avec MONTANTS_NIVEAUX dans src/App.jsx). Colle les
// 5 URLs ici une fois créées ; laisse un élément vide pour masquer ce palier
// (les boutons Stripe correspondants n'apparaissent pas dans ProfilModal).
// Le webhook supabase/functions/stripe-webhook/index.ts attribue le palier
// dès réception du paiement, sans étape manuelle — voir son commentaire
// d'en-tête pour la configuration (secret webhook, déploiement).
//
// ⚠️ Liens de TEST Stripe (préfixe test_) — à remplacer par les liens en
// mode production avant d'annoncer les dons publiquement (voir mémo projet).
export const LIENS_DON_STRIPE = [
  "https://buy.stripe.com/test_28E5kD2CM8Yc5zc7gF9Ve01", // palier 1 — 5 €
  "https://buy.stripe.com/test_fZu14n0uEeiwe5I7gF9Ve02", // palier 2 — 8 €
  "https://buy.stripe.com/test_7sY28r6T2a2g9Ps8kJ9Ve03", // palier 3 — 12 €
  "https://buy.stripe.com/test_5kQ14n1yIa2g7HkbwV9Ve04", // palier 4 — 16 €
  "https://buy.stripe.com/test_00wbJ16T2eiwe5IfNb9Ve05", // palier 5 — 20 €
];
