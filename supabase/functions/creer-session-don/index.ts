// Edge Function : appelée depuis ProfilModal (src/App.jsx) quand un éleveur
// clique sur un palier de don. Crée une session Stripe Checkout dynamique
// dont le montant est le CUMUL déjà versé (table `dons`, v18 supabase-setup.sql) :
// facture uniquement la différence jusqu'au palier visé, pour qu'enchaîner
// plusieurs petits dons ne fasse jamais payer deux fois le même palier.
//
// Le paiement est ensuite confirmé par supabase/functions/stripe-webhook, qui
// journalise la transaction dans `dons` et relit le cumul pour attribuer le
// palier — cette fonction-ci ne touche jamais à profils.niveau_ailes.
//
// L'utilisateur est identifié via le JWT envoyé par le client (Authorization:
// Bearer <access_token>), jamais via un id transmis dans le corps de la
// requête — sinon n'importe qui pourrait faire créditer un autre profil.
//
// Secrets requis (Dashboard Supabase -> Edge Functions -> Secrets) :
//   STRIPE_SECRET_KEY (Dashboard Stripe -> Développeurs -> Clés API -> clé secrète)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Doit rester synchronisé avec MONTANTS_NIVEAUX dans src/App.jsx (et sa copie
// dans stripe-webhook) — Deno ne peut pas importer ce fichier.
const MONTANTS_NIVEAUX_EUROS = [5, 12, 20];

// Minimum Stripe pour un paiement en EUR (~0,50 €) — évite un rejet si le
// reliquat à payer est trop faible (ex. déjà à 1€ du palier).
const MONTANT_MINIMUM_EUROS = 0.5;

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const ENTETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: ENTETES_CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user }, error: erreurAuth } = await supabase.auth.getUser(jeton);
  if (erreurAuth || !user) {
    return new Response(JSON.stringify({ erreur: "connecte-toi pour faire un don" }), { status: 401, headers: ENTETES_CORS });
  }

  let corps;
  try {
    corps = await req.json();
  } catch {
    corps = {};
  }
  const palier = Number(corps?.palier);
  if (!Number.isInteger(palier) || palier < 1 || palier > MONTANTS_NIVEAUX_EUROS.length) {
    return new Response(JSON.stringify({ erreur: "palier invalide" }), { status: 400, headers: ENTETES_CORS });
  }
  const montantCible = MONTANTS_NIVEAUX_EUROS[palier - 1];

  const { data: dons, error: erreurDons } = await supabase
    .from("dons")
    .select("montant_euros")
    .eq("profil_id", user.id);
  if (erreurDons) {
    return new Response(JSON.stringify({ erreur: "lecture du cumul de dons : " + erreurDons.message }), { status: 500, headers: ENTETES_CORS });
  }
  const montantCumule = (dons || []).reduce((total, d) => total + Number(d.montant_euros), 0);

  if (montantCumule >= montantCible) {
    return new Response(JSON.stringify({ message: "palier " + palier + " déjà atteint (cumul " + montantCumule + " €)" }), { status: 200, headers: ENTETES_CORS });
  }

  const delta = Math.max(Math.round((montantCible - montantCumule) * 100) / 100, MONTANT_MINIMUM_EUROS);
  const retourUrl = typeof corps?.retourUrl === "string" && corps.retourUrl ? corps.retourUrl : req.headers.get("origin") || "https://registre-des-abysses.netlify.app";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(delta * 100),
          product_data: {
            name: "Soutien Registre des Abysses — palier " + palier + " (" + montantCible + " €)",
            description: montantCumule > 0 ? "Complément après " + montantCumule + " € déjà versés" : undefined,
          },
        },
        quantity: 1,
      },
    ],
    success_url: retourUrl,
    cancel_url: retourUrl,
  });

  return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: ENTETES_CORS });
});
