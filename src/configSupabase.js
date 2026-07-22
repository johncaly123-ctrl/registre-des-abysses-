// ---------- Configuration Supabase ----------
// 1. Colle ici l'URL de ton projet (Supabase → Settings → API → Project URL)
// 2. La clé "publishable" est prévue pour le navigateur : elle peut rester ici.
// 3. La clé SECRÈTE ne doit JAMAIS apparaître dans ce projet.
export const SUPABASE_URL = "https://fcdculpkrcuhtexmqojz.supabase.co";
export const SUPABASE_KEY = "sb_publishable_r_kwZOx1WMPJ0W4LDFrIcg_pjE--12O";

export const supabaseEstConfigure = () => SUPABASE_URL.startsWith("https://");

// Lien de don (Ko-fi, PayPal…) affiché sur la page Profil. Laisse vide pour masquer.
export const LIEN_DON = "https://paypal.me/caly191";
