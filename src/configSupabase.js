// ---------- Configuration Supabase ----------
// 1. Colle ici l'URL de ton projet (Supabase → Settings → API → Project URL)
// 2. La clé "publishable" est prévue pour le navigateur : elle peut rester ici.
// 3. La clé SECRÈTE ne doit JAMAIS apparaître dans ce projet.
export const SUPABASE_URL = "https://fcdculpkrcuhtexmqojz.supabase.co";
export const SUPABASE_KEY = "sb_publishable_r_kwZOx1WMPJ0W4LDFrIcg_pjE--12O";

export const supabaseEstConfigure = () => SUPABASE_URL.startsWith("https://");

// Lien d'invitation Discord de la communauté, affiché dans le pied de page.
// Laisse vide tant que le serveur Discord n'existe pas (le lien est masqué).
export const LIEN_DISCORD = "https://discord.gg/wfHrGAzErb";

// L'attribution AUTOMATIQUE du palier d'ailes passe désormais par la session
// Stripe Checkout dynamique créée par supabase/functions/creer-session-don
// (facture uniquement le complément jusqu'au palier visé) puis confirmée par
// supabase/functions/stripe-webhook/index.ts — voir leurs commentaires
// d'en-tête pour la configuration (secrets, déploiement). Rien à coller ici :
// pas de Payment Links Stripe pré-créés à maintenir.
