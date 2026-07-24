// ---------- Configuration Supabase ----------
// 1. Colle ici l'URL de ton projet (Supabase → Settings → API → Project URL)
// 2. La clé "publishable" est prévue pour le navigateur : elle peut rester ici.
// 3. La clé SECRÈTE ne doit JAMAIS apparaître dans ce projet.
export const SUPABASE_URL = "https://fcdculpkrcuhtexmqojz.supabase.co";
export const SUPABASE_KEY = "sb_publishable_r_kwZOx1WMPJ0W4LDFrIcg_pjE--12O";

export const supabaseEstConfigure = () => SUPABASE_URL.startsWith("https://");

// Lien de don (Ko-fi, PayPal…) affiché sur la page Profil. Laisse vide pour masquer.
export const LIEN_DON = "https://paypal.me/caly191";

// Payment Links Stripe (Dashboard Stripe -> Payment Links -> "+ Créer") pour
// l'attribution AUTOMATIQUE du palier d'ailes : un lien "paiement unique"
// par palier, aux montants exacts 5 / 8 / 12 / 16 / 20 € (dans l'ordre —
// doit rester synchronisé avec MONTANTS_NIVEAUX dans src/App.jsx). Colle les
// 5 URLs ici une fois créées ; laisse un élément vide pour masquer ce palier
// (les boutons Stripe correspondants n'apparaissent pas dans ProfilModal).
// Le webhook supabase/functions/stripe-webhook/index.ts attribue le palier
// dès réception du paiement, sans étape manuelle — voir son commentaire
// d'en-tête pour la configuration (secret webhook, déploiement).
export const LIENS_DON_STRIPE = ["", "", "", "", ""];
