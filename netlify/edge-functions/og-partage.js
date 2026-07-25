// Personnalise les balises Open Graph/Twitter pour les liens de cheptel public
// partagé (`/?voir=<pseudo>`), pour que Discord/Twitter affichent un aperçu
// avec le nom de l'éleveur plutôt que le titre générique du site. Le reste du
// site (SPA sans SSR) n'a pas besoin de cette réécriture, donc on ne
// s'exécute que quand le paramètre `voir` est présent.
export default async (request, context) => {
  const url = new URL(request.url);
  const pseudo = url.searchParams.get("voir");
  if (!pseudo) return;

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();

  const SUPABASE_URL = "https://fcdculpkrcuhtexmqojz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_r_kwZOx1WMPJ0W4LDFrIcg_pjE--12O";

  const titre = `Le cheptel de ${pseudo} — Registre des Abysses`;
  let description = `Découvre le cheptel de ${pseudo} sur Registre des Abysses, l'outil communautaire d'élevage de muldos, dragodindes et volkornes.`;

  try {
    const reponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profils?pseudo=eq.${encodeURIComponent(pseudo)}&select=description`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (reponse.ok) {
      const lignes = await reponse.json();
      if (lignes[0]?.description) description = lignes[0].description.slice(0, 200);
    }
  } catch {
    // Supabase injoignable : on garde la description générique ci-dessus.
  }

  const echapper = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const titreEch = echapper(titre);
  const descEch = echapper(description);
  const urlPartage = echapper(url.toString());

  html = html
    .replace(/<title>.*?<\/title>/, `<title>${titreEch}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${titreEch}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${descEch}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${urlPartage}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${titreEch}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${descEch}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${urlPartage}$2`);

  return new Response(html, response);
};

export const config = { path: "/" };
