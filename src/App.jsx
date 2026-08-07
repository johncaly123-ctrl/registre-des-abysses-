import React, { useState, useEffect } from "react";
import {
  flushToutesEcrituresDebattues, chargerJSON, sauvegarderJSON,
  hydraterStockage, reinitialiserStockage, obtenirCacheComplet, remplacerCacheComplet, etatSauvegarde,
  listerSauvegardesManuelles, creerSauvegardeManuelle, chargerSauvegardeManuelle,
} from "./stockage.js";
import { pushSupporte, abonnementPushActuel, activerNotificationsPush, desactiverNotificationsPush } from "./pushNotifications.js";
import { GpsDofusPage, ArbreGenealogiquePanel, CorbeillePanel, StatsCroisementsPanel, EstimationKamasTable, GraphiquesPanel, copierPressePapiers, SERVEURS_DOFUS, STORAGE_SERVEUR } from "./panneauxElevage.jsx";
import { GuidePage, NouveautesPage } from "./GuidePage.jsx";
import { MangeoirePage, CLES_SAUVEGARDE_MANGEOIRE } from "./Mangeoire.jsx";
import { OnboardingOverlay, ETAPES_ONBOARDING_GPS, ETAPES_ONBOARDING_SITE } from "./OnboardingOverlay.jsx";
import { supabase } from "./supabaseClient.js";
import { supabaseEstConfigure, LIEN_DISCORD } from "./configSupabase.js";
import { Waves, Save, Plus, Trash2, X, Bug } from "lucide-react";
import {
  useDragodindeElevage, DragodindeCheptelOverviewPage, DragodindeCheptelCards, DragodindeDetail, DragodindeBadge, NewDragodindeModal,
  DragodindeSynchronisationPage, DragodindeGpsPage, DragodindeClonagePage, DragodindeSuccesPage,
  CLES_SAUVEGARDE_DRAGODINDE, STORAGE_KEY_DRAGODINDE, generationDeCouleurDragodinde, sexeDragodinde, plierCouleurDragodinde,
  filtrerCheptelParTexteDragodinde, GENERATIONS_DRAGODINDE, dragodindeReproductible,
} from "./Dragodinde.jsx";
import {
  useVolkorneElevage, VolkorneCheptelOverviewPage, VolkorneCheptelCards, VolkorneDetail, VolkorneBadge, NewVolkorneModal,
  VolkorneSynchronisationPage, VolkorneGpsPage, VolkorneClonagePage, VolkorneSuccesPage,
  CLES_SAUVEGARDE_VOLKORNE, STORAGE_KEY_VOLKORNE, generationDeCouleurVolkorne, sexeVolkorne, plierCouleurVolkorne,
  filtrerCheptelParTexteVolkorne, GENERATIONS_VOLKORNE, volkorneReproductible,
} from "./Volkorne.jsx";
import {
  useMuldoElevage, MuldoBadge, MuldoDetail, NewMuldoModal, FicheRapideModal,
  DashboardDofusPanel, MemoElevagePanel, SuccesDofusPage,
  CheptelCards, CheptelOverviewPage, SynchronisationFiltresPage, ClonagePage,
  STORAGE_KEY, STORAGE_HISTORY_KEY, STORAGE_SYNC_KEY, STORAGE_GPS_SESSION, STORAGE_GPS_PARAMS,
  STORAGE_NAISSANCES, STORAGE_JOURNAL, STORAGE_INSTANTANES, STORAGE_CORBEILLE,
  CORBEILLE_DUREE_JOURS,
} from "./Muldo.jsx";
import {
  COULEURS_MULDO,
  GENERATIONS_MULDO, plierCouleur,
  couleurEstCanonique,
  generationDeCouleur,
  sexeMuldo,
  muldoReproductible,
  cleCoupleCouleurs,
  RESULTATS_PAR_COUPLE,
  plusHauteGenerationValidee,
} from "./muldoGenetique.js";


// Équivalent générique de plusHauteGenerationValidee (muldoGenetique.js) pour
// Dragodinde/Volkorne, qui n'ont pas leur propre fonction exportée du même nom.
function plusHauteGenerationValideeGenerique(cheptel, historiqueCouleurs, generationsTable) {
  const present = new Set((cheptel || []).map((m) => m.couleur));
  const seen = (c) => Boolean(historiqueCouleurs?.[c]) || present.has(c);
  const completes = Object.entries(generationsTable || {})
    .filter(([, couleurs]) => couleurs.length && couleurs.every(seen))
    .map(([g]) => Number(g));
  return completes.length ? Math.max(...completes) : 0;
}

const STORAGE_PRIX_KAMAS = "muldo-prix-kamas-v1";
const STORAGE_PRIX_KAMAS_DRAGODINDE = "dragodinde-prix-kamas-v1";
const STORAGE_PRIX_KAMAS_VOLKORNE = "volkorne-prix-kamas-v1";
const STORAGE_PROFIL = "muldo-profil-v1";
const STORAGE_THEME = "muldo-theme-v1";
const STORAGE_ONBOARDING_GPS = "muldo-onboarding-gps-v1";
const STORAGE_ONBOARDING_SITE = "muldo-onboarding-site-v1";
const STORAGE_PARCOURS_GUIDE = "muldo-parcours-guide-v1";

// Bandeau de version visible dans l'en-tête. Reste "BETA vX.Y" tant que le
// site n'est pas poussé/déployé publiquement — passera à "V1" ce jour-là.
const VERSION_APP = "BETA v0.3";

// Parcours guidé pas-à-pas (au-delà du simple overlay explicatif du GPS) :
// accompagne un nouveau joueur à travers une vraie première session muldo
// (aller au GPS, réaliser un couple, confirmer la naissance obtenue), en
// détectant la progression réelle plutôt qu'un simple "Suivant" cliqué.
const ETAPES_PARCOURS_GUIDE = [
  { texte: "Direction Muldo → GPS pour lancer ta première session d'accouplements.", estFait: (ctx) => ctx.page === "muldo" && ctx.sousPage === "gps" },
  { texte: "Clique sur \"Réaliser\" pour un couple du plan proposé.", estFait: (ctx) => ctx.naissancesCount > 0 },
  { texte: "Confirme la couleur et le sexe réellement obtenus pour valider la naissance.", estFait: (ctx) => ctx.journalCount > 0 },
];


// ---------- gate de connexion obligatoire ----------
// Connexion requise pour tout, sauf le tuto (GuidePage) et un lien de partage
// de cheptel public (?voir=pseudo, resté accessible pour l'attractivité —
// simplement sans le comparatif "j'ai déjà cette couleur", qui a besoin d'un
// cheptel local). Tant que la sauvegarde du compte n'est pas remontée de
// Supabase, on n'affiche ni ne monte AppConnecte : useMuldoElevage & cie
// lisent chargerJSON() de façon synchrone dès leur premier rendu, donc ils
// doivent monter APRÈS l'hydratation, jamais avant (sinon ils se figeraient
// sur des valeurs vides pour toute la session, voir stockage.js).
export default function App() {
  // Cheptel public en lecture seule (?voir=pseudo) : lu une fois au montage,
  // ne change jamais après (un partage de lien recharge la page).
  const [pseudoPublic] = useState(() => new URLSearchParams(window.location.search).get("voir") || null);
  // Pseudo du parrain capturé sur un lien ?parrain=<pseudo> — transmis à
  // l'inscription (metadata signUp), sans lien avec les paliers d'ailes payants.
  const [parrainCapture] = useState(() => new URLSearchParams(window.location.search).get("parrain") || null);
  // Thème clair/sombre : préférence de navigateur (pas de compte), doit donc
  // fonctionner aussi bien sur l'écran de connexion que dans l'app connectée.
  const [theme, setTheme] = useState(() => {
    const enregistre = localStorage.getItem(STORAGE_THEME);
    if (enregistre === "clair" || enregistre === "sombre") return enregistre;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "clair" : "sombre";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_THEME, theme);
  }, [theme]);

  const compte = useCompte();
  const [stockagePret, setStockagePret] = useState(false);
  const [propositionMigration, setPropositionMigration] = useState(null);
  // Mode invité : essai libre sans compte, proposé depuis PortailConnexion
  // pour accrocher un visiteur avant qu'il crée un compte. Rien n'est
  // persisté (stockage.js ne pousse vers Supabase que si utilisateurActuel
  // est renseigné, ce qui n'arrive qu'après hydraterStockage — jamais
  // appelé ici), donc tout se perd naturellement à la fermeture/au
  // rechargement de la page. Réinitialisé dès qu'une vraie session
  // apparaît (voir l'effet ci-dessous) pour ne pas rester bloqué en
  // "invité" après une connexion réussie.
  const [modeInvite, setModeInvite] = useState(false);
  useEffect(() => {
    if (compte.session) setModeInvite(false);
  }, [compte.session]);

  useEffect(() => {
    if (!compte.session?.user) {
      reinitialiserStockage();
      setStockagePret(false);
      setPropositionMigration(null);
      return;
    }
    let annule = false;
    setStockagePret(false);
    hydraterStockage(compte.session.user.id).then((etaitVide) => {
      if (annule) return;
      const detection = etaitVide ? detecterDonneesLocalesHeritees() : null;
      if (detection) setPropositionMigration(detection);
      else setStockagePret(true);
    });
    return () => { annule = true; };
    // Volontairement limité à l'id : `compte` change d'identité à chaque
    // rendu (useCompte() n'est pas mémoïsé), le dépendre entièrement
    // relancerait hydraterStockage() en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compte.session?.user?.id]);

  if (pseudoPublic) {
    return <CheptelPublicPage pseudo={pseudoPublic} cheptelViewer={{}} />;
  }

  if (!compte.session && !modeInvite) {
    return (
      <PortailConnexion
        compte={compte}
        parrainCapture={parrainCapture}
        onEssayerSansCompte={() => {
          // Compteur anonyme (table essais_invite, v32) pour estimer le taux
          // de conversion essai -> vrai compte dans ModerationPage — best
          // effort, on n'attend pas la réponse et on ignore les échecs.
          if (supabase) supabase.from("essais_invite").insert({}).then(() => {}, () => {});
          setModeInvite(true);
        }}
      />
    );
  }

  // Invité : aucune sauvegarde à remonter (utilisateurActuel reste null côté
  // stockage.js), on entre directement — stockagePret/propositionMigration
  // ne concernent que le flux avec compte.
  if (!compte.session && modeInvite) {
    return <AppConnecte compte={compte} parrainCapture={parrainCapture} theme={theme} setTheme={setTheme} onQuitterInvite={() => setModeInvite(false)} />;
  }

  if (propositionMigration) {
    return (
      <PropositionMigrationLegacy
        resume={propositionMigration.resume}
        donnees={propositionMigration.donnees}
        onFini={() => { setPropositionMigration(null); setStockagePret(true); }}
      />
    );
  }

  if (!stockagePret) {
    return (
      <div className="app-shell loading-screen">
        <TokensCss />
        <Waves size={20} style={{ marginRight: 8 }} /> Remontée de ta sauvegarde…
      </div>
    );
  }

  return <AppConnecte key={compte.session.user.id} compte={compte} parrainCapture={parrainCapture} theme={theme} setTheme={setTheme} />;
}

// Écran affiché tant qu'aucun compte n'est connecté : le tuto reste
// consultable librement, la connexion/inscription est nécessaire pour tout
// le reste (cheptel, GPS, naissances...).
function PortailConnexion({ compte, parrainCapture, onEssayerSansCompte }) {
  return (
    <div className="app-shell">
      <TokensCss />
      <div className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="brand-mark"><Waves size={22} color="#f0cf72" /></div>
          <div>
            <div className="brand-title">Registre des Abysses</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Élevage de Muldos · GPS génération · Succès</div>
          </div>
        </div>
      </div>
      <div className="main-view" style={{ maxWidth: 720 }}>
        <div className="panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0 }}>Essaie sans compte</h2>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, maxWidth: 480 }}>
                Cheptel, GPS, naissances, clonage… tout est utilisable tout de suite, sans rien
                créer. Rien n'est enregistré : ferme l'onglet et tout repart à zéro. Crée un compte
                quand tu veux garder ton élevage (et débloquer la Taverne et les prix communautaires).
              </div>
            </div>
            <button className="btn btn-coral" style={{ whiteSpace: "nowrap" }} onClick={onEssayerSansCompte}>
              Essayer sans compte →
            </button>
          </div>
          <h2>Connexion / inscription</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
            Ton cheptel, tes naissances et ton GPS restent liés à ton compte d'une session à
            l'autre, et donnent accès à la Taverne et aux prix communautaires.
          </div>
          <AuthPanel profilLocal={null} pretMdp={compte.pretMdp} onFini={() => {}} parrainCapture={parrainCapture} />
        </div>
        <GuidePage />
      </div>
    </div>
  );
}

// Proposée une seule fois, à la première connexion d'un compte dont la
// sauvegarde Supabase est encore vide alors que ce navigateur contient des
// données d'avant cette migration (usage local sans compte) — jamais de
// migration automatique silencieuse, l'utilisateur choisit explicitement.
function PropositionMigrationLegacy({ resume, donnees, onFini }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const importer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await remplacerCacheComplet(donnees);
      onFini();
    } catch (e) {
      console.error(e);
      setErreur("Import impossible (problème réseau ou compte) — réessaie dans un instant.");
      setEnCours(false);
    }
  };
  return (
    <div className="app-shell">
      <TokensCss />
      <div className="main-view" style={{ maxWidth: 640, margin: "60px auto" }}>
        <div className="panel-card">
          <h2>Données locales trouvées</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
            Ce navigateur contient des données d'avant le passage au compte en ligne :{" "}
            {resume.muldos} muldo(s), {resume.dragodindes} dragodinde(s), {resume.volkornes} volkorne(s).
            Importer les rattache définitivement à ce compte.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-coral" onClick={importer} disabled={enCours}>
              {enCours ? "Import en cours…" : "Importer mes données locales existantes"}
            </button>
            <button className="btn btn-ghost" onClick={onFini} disabled={enCours}>Ignorer</button>
          </div>
          {erreur && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>{erreur}</div>}
        </div>
      </div>
    </div>
  );
}

// Design tokens + reset, partagés par l'écran de connexion (PortailConnexion)
// et l'application connectée (AppConnecte) — un seul <style> embarqué évite
// de dupliquer ~300 lignes de CSS entre les deux, et les variables (--gold,
// --cyan...) doivent être identiques des deux côtés du gate de connexion.
function TokensCss() {
  return (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;0,9..144,800;1,9..144,600&display=swap');
        :root {
          --bg: #101b1e;
          --bg2: #17262a;
          --panel: #1c2e33;
          --panel2: #23393f;
          --panel3: #2b444b;
          --line: #3c5b62;
          --gold: #d6a64a;
          --gold2: #f0cf72;
          --accent: #c97935;
          --green: #68c16f;
          --cyan: #45e0d3;
          --red: #d85b4f;
          --text: #e9f4f2;
          --muted: #8fadb2;
          --btn-from: #ffe28f;
          --btn-to: #e0862f;
          --btn-text: #2a1608;
          --font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
          --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --page-bg: #070d0f;
          --shell-bg:
            radial-gradient(1100px 520px at 82% -10%, rgba(69,224,211,.20), transparent 62%),
            radial-gradient(900px 480px at 8% 8%, rgba(214,166,74,.12), transparent 60%),
            radial-gradient(900px 560px at -6% 112%, rgba(69,224,211,.16), transparent 62%),
            linear-gradient(160deg, #0a1315 0%, #101d20 55%, #0c1517 100%);
        }
        /* Thème clair — pendant "surface eclairee" du theme sombre : meme
           identite abysses/bioluminescence (cyan signature, or en second
           plan) mais base froide claire plutot que sombre. */
        :root[data-theme="clair"] {
          --bg: #eef6f5;
          --bg2: #e2f0ee;
          --panel: #fdffff;
          --panel2: #eef8f7;
          --panel3: #e0f0ee;
          --line: #bfdcd9;
          --gold: #b9822f;
          --gold2: #8f6220;
          --accent: #b56b2e;
          --green: #2f9142;
          --cyan: #0e8f86;
          --red: #b23d32;
          --text: #142526;
          --muted: #547174;
          --btn-from: #f0a63e;
          --btn-to: #c96a24;
          --btn-text: #2a1608;
          --page-bg: #e6f2f0;
          --shell-bg:
            radial-gradient(1100px 520px at 82% -10%, rgba(14,143,134,.14), transparent 62%),
            radial-gradient(900px 480px at 8% 8%, rgba(214,166,74,.12), transparent 60%),
            radial-gradient(900px 560px at -6% 112%, rgba(14,143,134,.10), transparent 62%),
            linear-gradient(160deg, #f7fcfb 0%, #eef8f6 55%, #e9f4f2 100%);
        }
        * { box-sizing: border-box; }
        /* Neutralise ENTIÈREMENT le gabarit Vite par défaut (index.css) :
           - #root limité à 1280px + padding = bandes noires ;
           - body en display:flex = #root rétréci à son contenu et collé à gauche. */
        html, body {
          margin:0 !important; padding:0 !important;
          background:var(--page-bg);
          display:block !important;
          min-height:100vh;
        }
        #root {
          max-width:none !important; width:100% !important;
          margin:0 !important; padding:0 !important;
          text-align:initial; display:block !important;
        }
        input, select, textarea, button { font-family: var(--font-ui); }
        :focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 6px; }
        @media (prefers-reduced-motion: reduce) {
          *, *:before, *:after { animation: none !important; transition: none !important; }
        }
        .app-shell {
          min-height: 100vh;
          color: var(--text);
          font-family: var(--font-ui);
          border: 0;
          background: var(--shell-bg);
          box-shadow: 0 24px 80px rgba(0,0,0,.35);
        }
        .loading-screen { display:flex; align-items:center; justify-content:center; min-height:520px; color:var(--muted); }

        h2 {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 19px;
          letter-spacing: .2px;
          color: var(--text);
        }

        .field {
          width:100%; background:var(--panel2); border:1px solid var(--line); color:var(--text);
          padding:10px 12px; border-radius:10px; font-size:13px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .field:focus { outline:none; border-color:var(--cyan); box-shadow:0 0 0 3px rgba(69,224,211,.18); }
        .field::placeholder { color: rgba(169,150,124,.55); }

        /* Les <select> natifs dessinent leur propre bouton flèche avec un fond
           clair imposé par l'OS/le navigateur (pavé blanc visible en thème
           sombre) : on retire ce widget et on redessine une flèche via une
           image de fond, coloree pour rester lisible sur les deux themes. */
        select.field {
          appearance: none; -webkit-appearance: none; -moz-appearance: none;
          /* !important : plusieurs select.field passent un style inline
             de padding qui écraserait sinon la marge réservée à la flèche
             redessinée ci-dessous. */
          padding-right: 32px !important;
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238fadb2' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        }
        :root[data-theme="clair"] select.field {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23547174' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        }

        /* Champs de prix (kamas) : pas de flèches +/- (incrément de 1 inutile
           sur des montants qui se comptent en milliers). */
        .champ-prix::-webkit-outer-spin-button,
        .champ-prix::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .champ-prix { -moz-appearance: textfield; }

        .btn {
          cursor:pointer; border:0; border-radius:10px; padding:10px 14px; font-size:13px; font-weight:700;
          display:inline-flex; align-items:center; justify-content:center; gap:7px;
          transition: transform .12s ease, opacity .12s ease, border-color .12s ease, background .12s ease, box-shadow .12s ease;
        }
        .btn:hover { opacity:.94; transform: translateY(-1px); }
        .btn:active { transform: scale(.98); }
        .btn:disabled { cursor: not-allowed; transform: none; }
        .btn-coral, .btn.primary {
          background:
            linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 45%),
            linear-gradient(180deg, var(--btn-from), var(--btn-to));
          color:var(--btn-text);
          border:1px solid rgba(255,255,255,.28);
          box-shadow:0 8px 22px rgba(201,121,53,.28), inset 0 1px 0 rgba(255,255,255,.4);
          font-weight:800;
        }
        .btn-coral:hover { box-shadow:0 10px 28px rgba(201,121,53,.4), inset 0 1px 0 rgba(255,255,255,.5); }
        .btn-ghost {
          background:rgba(255,255,255,.03); color:var(--muted); border:1px solid var(--line);
        }
        .btn-ghost:hover { color:var(--text); border-color:var(--gold); background:rgba(214,166,74,.12); }
        .nav-active { color:var(--text); border-color:var(--cyan); background:rgba(69,224,211,.14); box-shadow:0 0 0 1px rgba(69,224,211,.2); }
        .row-item:hover { background:rgba(214,166,74,.08); }

        .app-header {
          min-height:76px; padding:12px 24px;
          display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
          background:linear-gradient(180deg, var(--panel3), var(--panel2));
          border-bottom:1px solid var(--line);
          box-shadow: 0 1px 0 rgba(240,207,114,.14), 0 2px 0 rgba(0,0,0,.25);
        }
        .brand-title {
          font-family: var(--font-display);
          font-style: italic;
          font-weight: 600;
          font-size: 23px;
          letter-spacing: .3px;
          background: linear-gradient(92deg, var(--text) 12%, var(--cyan) 34%, var(--gold2) 66%, var(--gold) 92%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .brand-mark {
          width:42px; height:42px; border-radius:13px; display:grid; place-items:center;
          background:linear-gradient(145deg, #16343a, #0c1a1c);
          border:1px solid var(--line); box-shadow:inset 0 0 18px rgba(69,224,211,.28), inset 0 0 10px rgba(214,166,74,.14);
        }

        .layout { display:flex; min-height:646px; }
        .sidebar {
          width:236px; padding:16px 12px; border-right:1px solid var(--line);
          background:linear-gradient(180deg, var(--panel2), var(--bg));
          display:flex; flex-direction:column;
        }
        .sidebar-title { font-family:var(--font-display); font-size:12px; letter-spacing:1.8px; text-transform:uppercase; color:var(--gold); margin:8px 10px 14px; font-weight:700; }
        .nav-btn { width:100%; margin-bottom:6px; justify-content:flex-start; padding:11px 13px; border-radius:12px; position:relative; }
        .nav-active:before {
          content:""; position:absolute; left:-12px; top:22%; bottom:22%; width:3px;
          border-radius:0 3px 3px 0; background:linear-gradient(180deg, var(--gold2), var(--accent));
        }
        .side-metric {
          margin-top:auto; padding:13px; border:1px solid var(--line); border-radius:14px;
          background:rgba(0,0,0,.16); color:var(--muted); font-size:12px; line-height:1.55;
        }

        .tech-column {
          width:360px; border-right:1px solid var(--line); display:flex; flex-direction:column;
          background:var(--bg2);
        }
        /* Pas d'overflow ici : un conteneur overflow:auto qui ne défile pas
           lui-même capturerait le position:sticky de la fiche cheptel. C'est
           la page entière qui défile. */
        .main-view { flex:1; padding:24px 28px; min-width:0; max-width:1500px; margin-inline:auto; }
        .main-view > * + * { margin-top:16px; }

        .panel-card {
          background:linear-gradient(180deg, var(--panel3), var(--panel2));
          border:1px solid var(--line); border-radius:18px; padding:18px 20px;
          box-shadow:0 14px 36px rgba(0,0,0,.22);
        }
        .panel-card > h2:first-child, .panel-card h2 { margin-top:0; }

        .stat-grid { display:grid; grid-template-columns: repeat(4, minmax(150px,1fr)); gap:14px; margin-bottom:16px; }
        .stat-card {
          position:relative; overflow:hidden; min-height:116px; padding:18px; border-radius:18px;
          background:linear-gradient(145deg, var(--panel3), var(--panel2));
          border:1px solid var(--line);
        }
        .stat-card:after {
          content:""; position:absolute; right:-36px; top:-36px; width:110px; height:110px; border-radius:50%;
          background:rgba(69,224,211,.14);
        }
        .stat-value { font-family:var(--font-display); font-size:34px; font-weight:800; color:var(--gold2); line-height:1; }
        .stat-label { color:var(--muted); font-size:11px; margin-top:8px; text-transform:uppercase; letter-spacing:1.1px; font-weight:700; }

        .hero-gps { display:grid; grid-template-columns: 1.35fr .9fr; gap:16px; align-items:stretch; }
        .gps-action {
          border-radius:22px; padding:24px; border:1px solid rgba(69,224,211,.45);
          background:
            radial-gradient(580px 220px at 20% 0%, rgba(69,224,211,.20), transparent 60%),
            linear-gradient(145deg, var(--panel3), var(--panel2));
        }
        .gps-title { color:var(--cyan); font-weight:800; letter-spacing:1.4px; text-transform:uppercase; font-size:11px; }
        .gps-target { font-family:var(--font-display); font-size:32px; margin:10px 0 12px; font-weight:800; }

        .recipe-line { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:14px; }
        .pill {
          display:inline-flex; align-items:center; gap:6px; padding:8px 10px; border-radius:999px;
          background:linear-gradient(160deg, rgba(255,255,255,.05), rgba(0,0,0,.22));
          border:1px solid var(--line); color:var(--text); font-weight:700; font-size:12px;
        }
        /* Titres/valeurs "hero" ponctuels (paliers de soutien, génération mise
           en avant) : réutilise la police display plutôt que l'UI courante,
           pour les faire ressortir comme des titres plutôt que du texte dense. */
        .chiffre-hero { font-family: var(--font-display); font-weight: 800; }
        .progress-bar { height:10px; background:rgba(0,0,0,.24); border:1px solid var(--line); border-radius:999px; overflow:hidden; }
        .progress-fill {
          height:100%; background:linear-gradient(90deg, var(--accent), var(--gold2)); border-radius:999px;
          box-shadow: 0 0 10px 1px rgba(240,207,114,.45);
          transition: width .5s cubic-bezier(.22,.9,.32,1);
        }

        @keyframes liste-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes toast-in { from { opacity:0; transform:translate(-50%,-10px); } to { opacity:1; transform:translate(-50%,0); } }
        .muldo-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; animation: liste-in .25s ease; }
        .message-row { animation: liste-in .22s ease both; }
        .muldo-card {
          cursor:pointer; border-radius:16px; padding:14px; border:1px solid var(--line);
          background:linear-gradient(145deg, var(--panel3), var(--panel2));
          transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
        }
        .muldo-card:hover { transform:translateY(-2px); border-color:var(--gold); box-shadow:0 10px 24px rgba(0,0,0,.28); }
        .muldo-ready { border-color:rgba(104,193,111,.75); }
        .muldo-sterile { border-color:rgba(216,91,79,.65); opacity:.78; }
        .muldo-selected { box-shadow:0 0 0 2px rgba(69,224,211,.4); border-color:var(--cyan); }

        .success-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(170px,1fr)); gap:10px; }
        .success-chip { padding:11px 12px; border-radius:13px; border:1px solid var(--line); background:rgba(0,0,0,.13); }
        .success-ok { border-color:rgba(104,193,111,.55); background:rgba(104,193,111,.09); }
        .success-miss { opacity:.58; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-icon { animation: spin 0.8s linear infinite; }

        * { scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
        ::-webkit-scrollbar { width:9px; height:9px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background:var(--line); border-radius:6px; border:2px solid transparent; background-clip:padding-box; }
        ::-webkit-scrollbar-thumb:hover { background:var(--gold); background-clip:padding-box; }

        .cheptel-layout { display:flex; gap:18px; align-items:flex-start; }
        .cheptel-liste { flex:1; min-width:0; }
        .cheptel-detail {
          width:370px; flex:0 0 370px;
          position:sticky; top:12px;
          max-height: calc(100vh - 24px);
          overflow:auto;
          border:1px solid var(--gold);
          border-radius:18px;
          background:linear-gradient(180deg, var(--panel3), var(--panel2));
          box-shadow:0 18px 44px rgba(0,0,0,.4);
          animation: detail-in .18s ease;
        }
        @keyframes detail-in { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:none; } }
        .cheptel-detail-barre {
          position:sticky; top:0; z-index:5;
          display:flex; justify-content:space-between; align-items:center; gap:10px;
          padding:10px 14px;
          background:linear-gradient(180deg, var(--panel3), var(--panel2));
          border-bottom:1px solid var(--line);
        }
        .cheptel-detail-corps { padding: 8px 18px 22px; }
        .cheptel-detail-corps .panel-card { border:0; border-radius:0; box-shadow:none; background:transparent; padding:0; }
        .cheptel-backdrop { display:none; }
        @media (max-width: 980px) {
          .cheptel-backdrop {
            display:block; position:fixed; inset:0; z-index:59;
            background:rgba(10,8,6,.6); backdrop-filter: blur(2px);
            animation: fondu .15s ease;
          }
          @keyframes fondu { from { opacity:0; } to { opacity:1; } }
        @keyframes aile-lueur { 0%, 100% { opacity: 1; } 50% { opacity: .72; } }
          .cheptel-detail {
            position:fixed; left:12px; right:12px; bottom:12px; top:auto;
            width:auto; flex:none; max-height:72vh; z-index:60;
            animation: detail-up .2s ease;
          }
          @keyframes detail-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        }
        @media (max-width: 1100px) {
          .stat-grid { grid-template-columns:repeat(2, 1fr); }
          .hero-gps { grid-template-columns:1fr; }
          .tech-column { display:none; }
          .sidebar { width:190px; }
        }
        @media (max-width: 720px) {
          .layout { flex-direction:column; min-height:0; }
          .sidebar {
            width:100%; flex-direction:row; align-items:center; gap:6px;
            overflow-x:auto; padding:10px 12px;
            border-right:0; border-bottom:1px solid var(--line);
          }
          .sidebar-title, .side-metric { display:none; }
          .nav-btn { width:auto; flex:0 0 auto; margin-bottom:0; padding:9px 12px; }
          .nav-active:before { left:8px; right:8px; top:auto; bottom:2px; width:auto; height:3px; border-radius:3px 3px 0 0; }
          .main-view { padding:14px; }
          .stat-grid { grid-template-columns:1fr 1fr; gap:10px; }
          .stat-value { font-size:27px; }
          .muldo-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
          .app-header { padding:10px 14px; }
          .brand-title { font-size:19px; }
        }
      `}</style>
  );
}

// ---------- composant principal (connecté) ----------
// Ne monte qu'une fois la connexion établie ET la sauvegarde du compte
// hydratée (voir le gate App() tout en bas de fichier) : tous les hooks
// cheptel (useMuldoElevage & cie) peuvent donc lire chargerJSON() de façon
// synchrone dès leur premier rendu, sans course avec l'hydratation réseau.
function AppConnecte({ compte, parrainCapture, theme, setTheme, onQuitterInvite }) {
  // Invité = AppConnecte monté sans session (voir App(), mode essai libre) :
  // toutes les fonctionnalités liées au compte (sauvegarde manuelle cloud,
  // Taverne, prix communautaires, profil) doivent se désactiver proprement
  // au lieu de planter sur compte.session.user.id.
  const estInvite = !compte.session;
  const [toast, setToast] = useState(null);
  const showToast = (msg, opts = {}) => {
    setToast({ msg, type: opts.type });
    setTimeout(() => setToast(null), opts.duration || 2600);
  };
  // Indicateur de sauvegarde globale (tous les modules confondus) : reflète
  // le push réseau débattu vers sauvegardes_elevage, pas une seule créature.
  const [etatSave, setEtatSave] = useState(() => etatSauvegarde());
  useEffect(() => {
    const id = setInterval(() => setEtatSave(etatSauvegarde()), 1000);
    return () => clearInterval(id);
  }, []);
  // Sauvegardes manuelles nommées (bouton "Sauvegarder"/"Charger" de
  // l'en-tête, table sauvegardes_manuelles v29) — au plus 3, distinctes du
  // blob live poussé en continu ci-dessus. sauvegardeEnCours évite le
  // double-clic pendant l'écriture réseau.
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const [chargerSauvegardeOuvert, setChargerSauvegardeOuvert] = useState(false);
  const [listeSauvegardesManuelles, setListeSauvegardesManuelles] = useState(null);
  const sauvegarderManuellement = async () => {
    if (estInvite) return;
    setSauvegardeEnCours(true);
    try {
      await creerSauvegardeManuelle(compte.session.user.id);
      showToast("Sauvegarde enregistrée.");
    } catch (err) {
      console.error(err);
      showToast("Échec de la sauvegarde. Réessaie dans un instant.", { type: "error" });
    } finally {
      setSauvegardeEnCours(false);
    }
  };
  const ouvrirChargerSauvegarde = async () => {
    if (estInvite) return;
    setChargerSauvegardeOuvert(true);
    const liste = await listerSauvegardesManuelles(compte.session.user.id);
    setListeSauvegardesManuelles(liste);
  };
  const chargerEtRecharger = async (id) => {
    if (!window.confirm("Charger cette sauvegarde va remplacer TOUTES les données actuelles du compte (cheptels, généalogies, journal…). Continuer ?")) return;
    try {
      await chargerSauvegardeManuelle(id);
      window.location.reload();
    } catch (err) {
      console.error(err);
      showToast("Échec du chargement de la sauvegarde.", { type: "error" });
    }
  };
  // Permet d'atterrir directement sur une page via ?page=guide (utile pour le
  // sitemap et les liens partagés) — retombe sur "dashboard" si absent/invalide.
  const [page, setPage] = useState(() => {
    const demandee = new URLSearchParams(window.location.search).get("page");
    const pagesValides = ["dashboard", "dragodinde", "muldo", "volkorne", "mangeoire", "taverne", "succes", "guide", "nouveautes", "moderation"];
    return pagesValides.includes(demandee) ? demandee : "dashboard";
  });
  // Onglet actif à l'intérieur d'une section créature (Muldo/Dragodinde/Volkorne) :
  // "cheptel" | "synchro" | "gps" | "clonage". Partagé entre les 3, réinitialisé
  // implicitement en changeant de section (on ne mémorise pas par créature).
  const [sousPage, setSousPage] = useState("cheptel");
  // Créature affichée sur la page Succès (elle regroupe les 3 sous un seul onglet).
  const [succesCreature, setSuccesCreature] = useState("muldo");
  // Créature affichée dans le bloc Progression du Dashboard (qui ne montrait
  // que Muldo jusqu'ici) — même principe que succesCreature ci-dessus.
  const [creatureDashboard, setCreatureDashboard] = useState("muldo");
  // Serveur Dofus de l'éleveur — choisi tout en haut de page (en-tête),
  // partagé par les 3 créatures pour les prix communautaires. Fait partie de
  // la sauvegarde du compte comme le reste (plus de double-écriture séparée
  // vers profils.serveur : ce n'était qu'un précédent hybride local+cloud,
  // devenu inutile maintenant que tout passe par le même blob).
  const [serveur, setServeur] = useState(() => chargerJSON(STORAGE_SERVEUR, ""));
  useEffect(() => {
    sauvegarderJSON(STORAGE_SERVEUR, serveur);
  }, [serveur]);
  const [onboardingGpsOuvert, setOnboardingGpsOuvert] = useState(false);
  useEffect(() => {
    if (sousPage === "gps" && !chargerJSON(STORAGE_ONBOARDING_GPS, null)) {
      setOnboardingGpsOuvert(true);
    }
  }, [sousPage]);
  const fermerOnboardingGps = () => {
    sauvegarderJSON(STORAGE_ONBOARDING_GPS, "1");
    setOnboardingGpsOuvert(false);
  };
  // Tuto de première visite, site entier (distinct de la découverte GPS
  // ci-dessus) : déclenché une seule fois au montage. Contrairement au reste
  // de cet état, reste en localStorage brut (pas dans le blob du compte) :
  // c'est une préférence de navigateur, pas une donnée de compte, et elle a
  // justement vocation à se déclencher avant même la première connexion
  // (voir PortailConnexion) comme après.
  const [onboardingSiteOuvert, setOnboardingSiteOuvert] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_ONBOARDING_SITE)) {
      setOnboardingSiteOuvert(true);
    }
  }, []);
  const fermerOnboardingSite = () => {
    localStorage.setItem(STORAGE_ONBOARDING_SITE, "1");
    setOnboardingSiteOuvert(false);
  };
  const relancerOnboardingSite = () => setOnboardingSiteOuvert(true);
  const [demandeClassementTaverne, setDemandeClassementTaverne] = useState(false);
  const voirClassementDepuisSucces = () => {
    setDemandeClassementTaverne(true);
    setPage("taverne");
  };
  const [brouillonTaverne, setBrouillonTaverne] = useState("");
  const partagerDansTaverne = (texte) => {
    setBrouillonTaverne(texte);
    setPage("taverne");
  };
  const [profil, setProfilState] = useState(() => {
    const saved = chargerJSON(STORAGE_PROFIL, null);
    if (saved && typeof saved === "object") {
      const styleValide = ["dragodinde", "muldo", "volkorne"].includes(saved.styleAiles) ? saved.styleAiles : "muldo";
      return { pseudo: saved.pseudo || "", soutien: !!saved.soutien, styleAiles: styleValide, niveauAiles: Math.max(1, Math.min(5, Math.ceil((Number(saved.niveauAiles) || 1) / (Number(saved.niveauAiles) > 5 ? 2 : 1)))) };
    }
    return { pseudo: "", soutien: false, styleAiles: "muldo", niveauAiles: 1 };
  });
  const setProfil = (next) => {
    setProfilState(next);
    sauvegarderJSON(STORAGE_PROFIL, next);
  };
  const eleveMuldo = useMuldoElevage(showToast, setToast);
  const eleveDragodinde = useDragodindeElevage();
  const eleveVolkorne = useVolkorneElevage();
  // null = jamais démarré (auto-proposé une fois) ; nombre = étape en cours ;
  // "termine"/"saute" = ne plus proposer automatiquement, relançable manuellement.
  const [parcoursGuideEtape, setParcoursGuideEtape] = useState(() => {
    const v = chargerJSON(STORAGE_PARCOURS_GUIDE, null);
    return v === null ? null : (Number.isFinite(Number(v)) ? Number(v) : v);
  });
  useEffect(() => {
    if (chargerJSON(STORAGE_PARCOURS_GUIDE, null) === null) setParcoursGuideEtape(0);
  }, []);
  useEffect(() => {
    if (typeof parcoursGuideEtape !== "number") return;
    const ctx = { page, sousPage, naissancesCount: eleveMuldo.naissances.length, journalCount: eleveMuldo.journal.length };
    if (ETAPES_PARCOURS_GUIDE[parcoursGuideEtape]?.estFait(ctx)) {
      const suivante = parcoursGuideEtape + 1;
      const valeur = suivante >= ETAPES_PARCOURS_GUIDE.length ? "termine" : suivante;
      setParcoursGuideEtape(valeur);
      sauvegarderJSON(STORAGE_PARCOURS_GUIDE, valeur);
      if (valeur === "termine") {
        showToast("🎉 Parcours guidé terminé ! Tu maîtrises maintenant le cycle GPS → accouplement → naissance.", { type: "objectif", duration: 5000 });
      }
    }
  }, [parcoursGuideEtape, page, sousPage, eleveMuldo.naissances.length, eleveMuldo.journal.length]);
  const sauterParcoursGuide = () => {
    setParcoursGuideEtape("saute");
    sauvegarderJSON(STORAGE_PARCOURS_GUIDE, "saute");
  };
  const relancerParcoursGuide = () => {
    setParcoursGuideEtape(0);
    sauvegarderJSON(STORAGE_PARCOURS_GUIDE, "0");
  };
  const [profilOuvert, setProfilOuvert] = useState(false);
  useEffect(() => { if (compte.pretMdp) setProfilOuvert(true); }, [compte.pretMdp]);
  const [signalerBugOuvert, setSignalerBugOuvert] = useState(false);
  // Présence "qui est en ligne" (console Modération, réservée aux comptes
  // est_modo) : chaque compte connecté s'annonce sur un canal Realtime
  // partagé — pas de table dédiée, l'état est purement éphémère (pas de
  // policy RLS applicable ici, Presence n'est pas gouverné par Postgres).
  // Contenu volontairement limité (pseudo + ailes), rien de sensible.
  // Un seul channel/abonnement pour toute l'appli (et son écouteur "sync" est
  // attaché ICI, avant le subscribe()) : le client Supabase renvoie le MÊME
  // channel pour un topic déjà enregistré, et refuse d'ajouter un écouteur
  // presence après coup ("cannot add presence callbacks... after subscribe()")
  // — donc pas de second channel créé plus bas dans ModerationPage, l'état
  // est simplement redescendu en prop.
  const [enLigne, setEnLigne] = useState([]);
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil?.pseudo) return undefined;
    const canal = supabase.channel("presence-eleveurs", { config: { presence: { key: compte.session.user.id } } });
    canal.on("presence", { event: "sync" }, () => {
      setEnLigne(Object.values(canal.presenceState()).flat());
    });
    canal.subscribe((statut) => {
      if (statut === "SUBSCRIBED") {
        canal.track({ id: compte.session.user.id, pseudo: compte.profil.pseudo, styleAiles: compte.profil.style_ailes, niveauAiles: compte.profil.niveau_ailes, depuis: Date.now() });
      }
    });
    return () => { supabase.removeChannel(canal); setEnLigne([]); };
  }, [compte.session, compte.profil?.pseudo, compte.profil?.style_ailes, compte.profil?.niveau_ailes]);
  // Pousse la génération muldo la plus haute validée vers le profil Supabase
  // (auto-déclaratif) dès qu'elle change — sert de condition de déblocage
  // des ailes "muldo", en plus du palier de don.
  // Les 6 effets ci-dessous dépendent volontairement de compte.session/
  // compte.profil plutôt que de `compte` en entier : useCompte() renvoie un
  // nouvel objet à chaque rendu (non mémoïsé), dépendre de `compte` ferait
  // partir un update Supabase à chaque rendu de App().
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const gen = plusHauteGenerationValidee(eleveMuldo.cheptel, eleveMuldo.historiqueCouleurs);
    if (compte.profil.succes_generation_muldo !== gen) {
      supabase.from("profils").update({ succes_generation_muldo: gen })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveMuldo.cheptel, eleveMuldo.historiqueCouleurs, compte.session, compte.profil]);
  // Pousse le nombre de couleurs muldo découvertes vers le profil Supabase —
  // alimente le classement des éleveurs de la Taverne (auto-déclaratif, comme
  // succes_generation_muldo ci-dessus).
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const nb = Object.values(eleveMuldo.historiqueCouleurs || {}).filter(Boolean).length;
    if (compte.profil.couleurs_decouvertes_muldo !== nb) {
      supabase.from("profils").update({ couleurs_decouvertes_muldo: nb })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveMuldo.historiqueCouleurs, compte.session, compte.profil]);
  // Mêmes poussées auto-déclaratives que ci-dessus, pour Dragodinde et Volkorne
  // — alimentent le classement des éleveurs étendu aux 3 créatures.
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const gen = plusHauteGenerationValideeGenerique(eleveDragodinde.cheptel, eleveDragodinde.historiqueCouleurs, GENERATIONS_DRAGODINDE);
    if (compte.profil.succes_generation_dragodinde !== gen) {
      supabase.from("profils").update({ succes_generation_dragodinde: gen })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveDragodinde.cheptel, eleveDragodinde.historiqueCouleurs, compte.session, compte.profil]);
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const nb = Object.values(eleveDragodinde.historiqueCouleurs || {}).filter(Boolean).length;
    if (compte.profil.couleurs_decouvertes_dragodinde !== nb) {
      supabase.from("profils").update({ couleurs_decouvertes_dragodinde: nb })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveDragodinde.historiqueCouleurs, compte.session, compte.profil]);
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const gen = plusHauteGenerationValideeGenerique(eleveVolkorne.cheptel, eleveVolkorne.historiqueCouleurs, GENERATIONS_VOLKORNE);
    if (compte.profil.succes_generation_volkorne !== gen) {
      supabase.from("profils").update({ succes_generation_volkorne: gen })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveVolkorne.cheptel, eleveVolkorne.historiqueCouleurs, compte.session, compte.profil]);
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const nb = Object.values(eleveVolkorne.historiqueCouleurs || {}).filter(Boolean).length;
    if (compte.profil.couleurs_decouvertes_volkorne !== nb) {
      supabase.from("profils").update({ couleurs_decouvertes_volkorne: nb })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveVolkorne.historiqueCouleurs, compte.session, compte.profil]);

  // Titre d'onglet dynamique : reflète la page (et, pour les créatures, le
  // sous-onglet) affichée — plus lisible dans l'historique/les favoris du
  // navigateur qu'un titre statique unique.
  useEffect(() => {
    const NOMS_CREATURE = { muldo: "Muldos", dragodinde: "Dragodindes", volkorne: "Volkornes" };
    const NOMS_SOUS_PAGE = { cheptel: "Cheptel", synchro: "Synchronisation", gps: "GPS", clonage: "Clonage" };
    let titre;
    if (page === "dashboard") titre = "Tableau de bord";
    else if (page === "mangeoire") titre = "Carburant d'enclos";
    else if (page === "taverne") titre = "Taverne";
    else if (page === "succes") titre = "Succès";
    else if (page === "moderation") titre = "Modération";
    else if (page === "guide") titre = "Guide";
    else if (page === "nouveautes") titre = "Quoi de neuf";
    else if (NOMS_CREATURE[page]) titre = `${NOMS_SOUS_PAGE[sousPage] || ""} ${NOMS_CREATURE[page]}`.trim();
    else titre = "Registre des Abysses";
    document.title = `${titre} — Registre des Abysses`;
  }, [page, sousPage]);

  return (
    <div className="app-shell">
      <TokensCss />

      <div className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="brand-mark"><Waves size={22} color="#f0cf72" /></div>
          <div>
            <div className="brand-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Registre des Abysses
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", WebkitTextFillColor: "#fff", background: "#1f8f88", borderRadius: 999, padding: "2px 8px", letterSpacing: 0.4 }}>{VERSION_APP}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Élevage de Muldos · GPS génération · Succès</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <button
              className="btn btn-ghost"
              onClick={sauvegarderManuellement}
              disabled={sauvegardeEnCours || estInvite}
              title={estInvite ? "Connecte-toi pour sauvegarder dans le cloud." : "Enregistre un instantané complet du compte, en plus de la sauvegarde automatique en continu (3 max, la plus ancienne est remplacée)."}
              style={{ padding: "8px 12px", opacity: estInvite ? 0.5 : 1 }}
            >
              <Save size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {sauvegardeEnCours ? "Sauvegarde…" : "Sauvegarder"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={ouvrirChargerSauvegarde}
              disabled={estInvite}
              title={estInvite ? "Connecte-toi pour charger une sauvegarde cloud." : "Recharger une des 3 dernières sauvegardes manuelles."}
              style={{ padding: "8px 12px", opacity: estInvite ? 0.5 : 1 }}
            >
              📂 Charger
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            className="btn btn-ghost"
            onClick={() => setSignalerBugOuvert(true)}
            title="Signaler un bug"
            style={{ padding: "8px 12px" }}
          >
            <Bug size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
            Signaler un bug
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: etatSave.dernierEchec ? "var(--red)" : "var(--muted)", opacity: (etatSave.enAttente || etatSave.dernierEchec) ? 1 : 0 }}>
            <Save size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {etatSave.dernierEchec ? "échec, nouvel essai…" : "sauvegarde…"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <select
              className="field"
              value={serveur}
              onChange={(e) => setServeur(e.target.value)}
              title="Ton serveur Dofus — utilisé pour les prix communautaires (Dashboard)"
              style={{ padding: "8px 10px", fontSize: 13 }}
            >
              <option value="">Serveur…</option>
              {SERVEURS_DOFUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              className="btn btn-ghost"
              onClick={() => setTheme((t) => (t === "clair" ? "sombre" : "clair"))}
              title={theme === "clair" ? "Passer en thème sombre" : "Passer en thème clair"}
              style={{ padding: "8px 12px" }}
            >
              {theme === "clair" ? "🌙" : "☀️"}
            </button>
            <button
              className={estInvite ? "btn btn-coral" : "btn btn-ghost"}
              onClick={estInvite ? onQuitterInvite : () => setProfilOuvert(true)}
              title={estInvite ? "Quitter le mode essai et se connecter / créer un compte" : "Mon profil / connexion à la Taverne"}
              style={{ padding: "8px 12px", flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {estInvite
                ? <>🔒 <span style={{ marginLeft: 6 }}>Se connecter</span></>
                : (compte.profil
                  ? <PseudoAvecAiles pseudo={compte.profil.pseudo} soutien={compte.profil.niveau_ailes > 0} styleAiles={compte.profil.style_ailes} niveau={compte.profil.niveau_ailes} taille={44} />
                  : <>👤 <span style={{ marginLeft: 6 }}>Profil / Connexion</span></>)}
            </button>
            <button className="btn btn-coral" onClick={() => eleveMuldo.setShowNew(true)}><Plus size={15} /> Nouveau muldo</button>
            <button className="btn btn-coral" onClick={() => eleveDragodinde.setShowNew(true)}><Plus size={15} /> Nouveau dragodinde</button>
            <button className="btn btn-coral" onClick={() => eleveVolkorne.setShowNew(true)}><Plus size={15} /> Nouveau volkorne</button>
          </div>
        </div>
      </div>

      {estInvite && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "8px 16px", background: "rgba(240, 207, 114, 0.12)", borderBottom: "1px solid var(--line)", fontSize: 13, flexWrap: "wrap" }}>
          <span>🧪 Mode essai — rien n'est enregistré, tout repart à zéro si tu fermes ou recharges la page.</span>
          <button className="btn btn-coral" style={{ padding: "4px 12px", fontSize: 12 }} onClick={onQuitterInvite}>Se connecter / Créer un compte</button>
        </div>
      )}

      <div className="layout">
        <AppSidebar
          page={page}
          setPage={setPage}
          cheptel={eleveMuldo.cheptel}
          readyCount={eleveMuldo.readyCount}
          fertileCount={eleveMuldo.fertileCount}
          discoveredTotal={eleveMuldo.discoveredTotal}
          cheptelDragodinde={eleveDragodinde.cheptel}
          cheptelVolkorne={eleveVolkorne.cheptel}
          estModo={compte.estModo}
          estInvite={estInvite}
        />

        {page === "muldo" && sousPage === "cheptel" && (
          <div className="tech-column">
            <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
              <input className="field" placeholder="Rechercher un muldo…" value={eleveMuldo.filter} onChange={(e) => eleveMuldo.setFilter(e.target.value)} />
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
              <CheptelCards
                items={eleveMuldo.filtered}
                selectedId={eleveMuldo.selectedId}
                onSelect={eleveMuldo.setSelectedId}
              />
            </div>
          </div>
        )}
        {page === "dragodinde" && sousPage === "cheptel" && (
          <div className="tech-column">
            <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
              <input className="field" placeholder="Rechercher un dragodinde…" value={eleveDragodinde.filter} onChange={(e) => eleveDragodinde.setFilter(e.target.value)} />
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
              <DragodindeCheptelCards
                items={filtrerCheptelParTexteDragodinde(eleveDragodinde.cheptel, eleveDragodinde.filter)}
                selectedId={eleveDragodinde.selectedId}
                onSelect={eleveDragodinde.setSelectedId}
              />
            </div>
          </div>
        )}
        {page === "volkorne" && sousPage === "cheptel" && (
          <div className="tech-column">
            <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
              <input className="field" placeholder="Rechercher un volkorne…" value={eleveVolkorne.filter} onChange={(e) => eleveVolkorne.setFilter(e.target.value)} />
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
              <VolkorneCheptelCards
                items={filtrerCheptelParTexteVolkorne(eleveVolkorne.cheptel, eleveVolkorne.filter)}
                selectedId={eleveVolkorne.selectedId}
                onSelect={eleveVolkorne.setSelectedId}
              />
            </div>
          </div>
        )}

        <div className="main-view">
          {page === "dashboard" && (
            <>
              <DashboardDofusPanel
                cheptel={eleveMuldo.cheptel}
                plan={eleveMuldo.planGeneration}
                historiqueCouleurs={eleveMuldo.historiqueCouleurs}
                actionsDuJour={eleveMuldo.actionsDuJour}
                suggestions={eleveMuldo.suggestions}
                registerBirth={eleveMuldo.registerBirth}
                onVoirMuldo={eleveMuldo.voirMuldo}
              />
              <div className="panel-card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b>🎲 Simulateur de chance</b>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    Teste en un clic la probabilité d'obtenir la génération cible selon le niveau de tes parents (et l'Optimakina).
                  </div>
                </div>
                <button
                  className="btn btn-coral"
                  onClick={() => { setPage("muldo"); setSousPage("gps"); }}
                >
                  Ouvrir le simulateur
                </button>
              </div>
              <GraphiquesPanel
                {...{
                  muldo: { cheptel: eleveMuldo.cheptel, journal: eleveMuldo.journal, instantanes: eleveMuldo.instantanes, generationDeCouleurFn: generationDeCouleur, sexeFn: sexeMuldo, reproductibleFn: muldoReproductible, nomEntitePluriel: "Muldos" },
                  dragodinde: { cheptel: eleveDragodinde.cheptel, journal: eleveDragodinde.journal, instantanes: eleveDragodinde.instantanes, generationDeCouleurFn: generationDeCouleurDragodinde, sexeFn: sexeDragodinde, reproductibleFn: dragodindeReproductible, nomEntitePluriel: "Dragodindes" },
                  volkorne: { cheptel: eleveVolkorne.cheptel, journal: eleveVolkorne.journal, instantanes: eleveVolkorne.instantanes, generationDeCouleurFn: generationDeCouleurVolkorne, sexeFn: sexeVolkorne, reproductibleFn: volkorneReproductible, nomEntitePluriel: "Volkornes" },
                }[creatureDashboard]}
                selecteur={
                  <select className="field" value={creatureDashboard} onChange={(e) => setCreatureDashboard(e.target.value)} style={{ padding: "6px 10px", fontSize: 12 }}>
                    <option value="muldo">🐴 Muldo</option>
                    <option value="dragodinde">🐲 Dragodinde</option>
                    <option value="volkorne">🐎 Volkorne</option>
                  </select>
                }
              />
              <EstimationKamasSelecteur cheptelMuldo={eleveMuldo.cheptel} cheptelDragodinde={eleveDragodinde.cheptel} cheptelVolkorne={eleveVolkorne.cheptel} userId={compte.session?.user?.id} serveur={serveur} />
              <PartagePublicPanel
                session={compte.session}
                pseudo={compte.profil?.pseudo}
                cheptelMuldo={eleveMuldo.cheptel}
                cheptelDragodinde={eleveDragodinde.cheptel}
                cheptelVolkorne={eleveVolkorne.cheptel}
                showToast={showToast}
                onPartagerTaverne={partagerDansTaverne}
              />
              <ParrainagePanel session={compte.session} pseudo={compte.profil?.pseudo} showToast={showToast} />
              <MemoElevagePanel />
              <CorbeillePanel corbeille={eleveMuldo.corbeille} onRestaurer={eleveMuldo.restaurerMuldo} onPurger={eleveMuldo.purgerCorbeilleEntree} onVider={eleveMuldo.viderCorbeille} dureeJours={CORBEILLE_DUREE_JOURS} />
              <SauvegardePanel showToast={showToast} estInvite={estInvite} />
            </>
          )}

          {page === "taverne" && (
            estInvite ? (
              <div className="panel-card" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
                <h2 style={{ marginTop: 0 }}>🍻🔒 Taverne réservée aux éleveurs connectés</h2>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
                  Forum, classement et prix communautaires demandent un compte (pseudo public,
                  anti-spam). Le reste de l'outil reste utilisable sans compte.
                </div>
                <button className="btn btn-coral" onClick={onQuitterInvite}>Se connecter / Créer un compte</button>
              </div>
            ) : (
              <TavernePage
                compte={compte}
                onOuvrirProfil={() => setProfilOuvert(true)}
                ouvrirClassementInitial={demandeClassementTaverne}
                onClassementInitialConsomme={() => setDemandeClassementTaverne(false)}
                brouillonInitial={brouillonTaverne}
                onBrouillonInitialConsomme={() => setBrouillonTaverne("")}
              />
            )
          )}

          {page === "moderation" && compte.estModo && <ModerationPage compte={compte} enLigne={enLigne} />}

          {page === "succes" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["muldo", "🐴", "Muldo"], ["dragodinde", "🐲", "Dragodinde"], ["volkorne", "🐎", "Volkorne"]].map(([key, icon, label]) => (
                    <button
                      key={key}
                      className="btn btn-ghost"
                      style={succesCreature === key ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined}
                      onClick={() => setSuccesCreature(key)}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
                <button className="btn btn-ghost" onClick={voirClassementDepuisSucces}>🏆 Voir le classement</button>
              </div>
              {succesCreature === "muldo" && (
                <SuccesDofusPage
                  historiqueCouleurs={eleveMuldo.historiqueCouleurs}
                  cheptel={eleveMuldo.cheptel}
                  objectifGeneration={eleveMuldo.objectifGeneration}
                  plan={eleveMuldo.planGeneration}
                  onToggleCouleur={eleveMuldo.basculerCouleurHistorique}
                  onValidateGeneration={eleveMuldo.validerGenerationHistorique}
                  onValidateAll={eleveMuldo.validerToutHistorique}
                  onResetHistory={eleveMuldo.reinitialiserHistoriqueManuel}
                  journal={eleveMuldo.journal}
                />
              )}
              {succesCreature === "dragodinde" && <DragodindeSuccesPage {...eleveDragodinde.succesProps} />}
              {succesCreature === "volkorne" && <VolkorneSuccesPage {...eleveVolkorne.succesProps} />}
            </>
          )}

          {page === "guide" && <GuidePage />}
          {page === "nouveautes" && <NouveautesPage />}
          {page === "mangeoire" && <MangeoirePage userId={compte.session?.user?.id} serveur={serveur} />}

          {page === "muldo" && (
            <>
              <SousNavOutils sousPage={sousPage} setSousPage={setSousPage} />

              {sousPage === "gps" && (
                <GpsDofusPage
                  session={eleveMuldo.sessionGps}
                  mode={eleveMuldo.modeGps}
                  setMode={eleveMuldo.setModeGps}
                  objectif={eleveMuldo.objectifGpsActif}
                  objectifCouleur={eleveMuldo.objectifGps}
                  setObjectifCouleur={eleveMuldo.setObjectifGps}
                  generationCible={eleveMuldo.generationGps}
                  setGenerationCible={eleveMuldo.setGenerationGps}
                  generationMin={eleveMuldo.generationCollectionMin}
                  setGenerationMin={eleveMuldo.setGenerationCollectionMin}
                  generationMax={eleveMuldo.generationCollectionMax}
                  setGenerationMax={eleveMuldo.setGenerationCollectionMax}
                  choixObjectif={eleveMuldo.choixObjectifGps}
                  progressionGenerations={eleveMuldo.progressionGps}
                  purification={eleveMuldo.modePurification}
                  setPurification={eleveMuldo.setModePurification}
                  optimakina={eleveMuldo.optimakina}
                  setOptimakina={eleveMuldo.setOptimakina}
                  niveauMinimumSession={eleveMuldo.niveauMinimumSession}
                  setNiveauMinimumSession={eleveMuldo.setNiveauMinimumSession}
                  suivi={eleveMuldo.gpsSuiviActif}
                  naissances={eleveMuldo.naissances}
                  journal={eleveMuldo.journal}
                  onConfirmerNaissance={eleveMuldo.confirmerNaissance}
                  onSupprimerNaissance={eleveMuldo.supprimerNaissance}
                  onRealiserUn={(g) => eleveMuldo.realiserCouplesGps((g.couples || []).slice(0, 1))}
                  onTerminerGroupe={(g) => eleveMuldo.realiserCouplesGps(g.couples || [])}
                  onAnnuler={eleveMuldo.annulerDernierCoupleGps}
                  onReinitialiser={eleveMuldo.reinitialiserSessionGps}
                  onDemarrerNouvelleSession={eleveMuldo.demarrerNouvelleSessionAccouplement}
                  onNettoyerSterilesPuisDemarrer={eleveMuldo.nettoyerSterilesPuisDemarrerSession}
                  onVoirMuldo={eleveMuldo.voirMuldo}
                  BadgeComponent={MuldoBadge}
                  generationDeCouleurFn={generationDeCouleur}
                  plierCouleurFn={plierCouleur}
                  couleursToutes={COULEURS_MULDO}
                  generationsTable={GENERATIONS_MULDO}
                  sexeFn={sexeMuldo}
                  couleurEstCanoniqueFn={couleurEstCanonique}
                  resultatsParCouple={RESULTATS_PAR_COUPLE}
                  cleCoupleCouleursFn={cleCoupleCouleurs}
                  lieuCapture="au Bassin des Muldos (Baie de Sufokia)"
                  nomObjectifLabel="Muldo objectif"
                  nomEntitePluriel="Muldos"
                  onPartagerTaverne={partagerDansTaverne}
                />
              )}

              {sousPage === "synchro" && (
                <SynchronisationFiltresPage
                  cheptel={eleveMuldo.cheptel}
                  updateCheptel={eleveMuldo.updateCheptel}
                  showToast={showToast}
                  onVoirMuldo={eleveMuldo.voirMuldo}
                  onSupprimerMuldo={(m) => {
                    if (window.confirm(`Supprimer définitivement ${m.nom || m.couleur} ? (généalogie : ce muldo a des parents ou descendants connus)`)) {
                      eleveMuldo.deleteMuldo(m.id);
                      showToast(`${m.nom || m.couleur} supprimé.`);
                    }
                  }}
                  onSupprimerMuldos={eleveMuldo.deleteMuldos}
                />
              )}

              {sousPage === "cheptel" && (
                <>
                <div className="cheptel-layout">
                  <div className="cheptel-liste">
                    <CheptelOverviewPage
                      cheptel={eleveMuldo.filtered}
                      selectedId={eleveMuldo.selectedId}
                      setSelectedId={eleveMuldo.setSelectedId}
                      filter={eleveMuldo.filter}
                      setFilter={eleveMuldo.setFilter}
                      actionsDuJour={eleveMuldo.actionsDuJour}
                      onSupprimerPlusieurs={(ids) => {
                        eleveMuldo.deleteMuldos(ids);
                        showToast(`${ids.length} muldo(s) mis à la corbeille.`);
                      }}
                      onMarquerStatutPlusieurs={(ids, statut) => {
                        eleveMuldo.marquerStatutMuldos(ids, statut);
                        showToast(`${ids.length} muldo(s) passé(s) en ${statut}.`);
                      }}
                      importProps={{
                        captureText: eleveMuldo.captureText,
                        setCaptureText: eleveMuldo.setCaptureText,
                        capturePreview: eleveMuldo.capturePreview,
                        setCapturePreview: eleveMuldo.setCapturePreview,
                        importCapture: eleveMuldo.importCapture,
                        onImport: eleveMuldo.importerCaptureDansCheptel,
                      }}
                    />
                  </div>
                  {eleveMuldo.selected && (
                    <div className="cheptel-backdrop" onClick={() => eleveMuldo.setSelectedId(null)} />
                  )}
                  {eleveMuldo.selected && (
                    <div className="cheptel-detail">
                      <div className="cheptel-detail-barre">
                        <span style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <MuldoBadge couleur={eleveMuldo.selected.couleur} taille={18} /> {eleveMuldo.selected.nom || eleveMuldo.selected.couleur}
                        </span>
                        <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => eleveMuldo.setSelectedId(null)}>
                          ✕ Fermer
                        </button>
                      </div>
                      <div className="cheptel-detail-corps">
                        <MuldoDetail muldo={eleveMuldo.selected} byId={eleveMuldo.byId} onPatch={(p) => eleveMuldo.patchMuldo(eleveMuldo.selected.id, p)} onDelete={() => eleveMuldo.deleteMuldo(eleveMuldo.selected.id)} />
                      </div>
                    </div>
                  )}
                </div>
                <ArbreGenealogiquePanel cheptel={eleveMuldo.cheptel} onSelect={eleveMuldo.setSelectedId} sexeFn={sexeMuldo} plierCouleurFn={plierCouleur} />
                </>
              )}

              {sousPage === "clonage" && (
                <ClonagePage
                  cheptel={eleveMuldo.cheptel}
                  objectif={eleveMuldo.objectifGpsActif}
                  journal={eleveMuldo.journal}
                  onVoirMuldo={eleveMuldo.voirMuldo}
                  fusion={{
                    muldos: eleveMuldo.cheptel,
                    fusionA: eleveMuldo.fusionA,
                    fusionB: eleveMuldo.fusionB,
                    setFusionA: eleveMuldo.setFusionA,
                    setFusionB: eleveMuldo.setFusionB,
                    onFusion: eleveMuldo.fusionnerSteriles,
                  }}
                />
              )}
            </>
          )}

          {page === "dragodinde" && (
            <>
              <SousNavOutils sousPage={sousPage} setSousPage={setSousPage} />
              {sousPage === "cheptel" && (
                <>
                <div className="cheptel-layout">
                  <div className="cheptel-liste">
                    <DragodindeCheptelOverviewPage
                      cheptel={eleveDragodinde.cheptel}
                      selectedId={eleveDragodinde.selectedId}
                      setSelectedId={eleveDragodinde.setSelectedId}
                      filter={eleveDragodinde.filter}
                      setFilter={eleveDragodinde.setFilter}
                      onSupprimerPlusieurs={(ids) => {
                        eleveDragodinde.deleteMuldos(ids);
                        showToast(`${ids.length} dragodinde(s) mis à la corbeille.`);
                      }}
                      onMarquerStatutPlusieurs={(ids, statut) => {
                        eleveDragodinde.marquerStatutMuldos(ids, statut);
                        showToast(`${ids.length} dragodinde(s) passé(s) en ${statut}.`);
                      }}
                    />
                  </div>
                  {eleveDragodinde.selectedId && eleveDragodinde.byId[eleveDragodinde.selectedId] && (
                    <div className="cheptel-backdrop" onClick={() => eleveDragodinde.setSelectedId(null)} />
                  )}
                  {eleveDragodinde.selectedId && eleveDragodinde.byId[eleveDragodinde.selectedId] && (
                    <div className="cheptel-detail">
                      <div className="cheptel-detail-barre">
                        <span style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <DragodindeBadge couleur={eleveDragodinde.byId[eleveDragodinde.selectedId].couleur} taille={18} /> {eleveDragodinde.byId[eleveDragodinde.selectedId].nom || eleveDragodinde.byId[eleveDragodinde.selectedId].couleur}
                        </span>
                        <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => eleveDragodinde.setSelectedId(null)}>
                          ✕ Fermer
                        </button>
                      </div>
                      <div className="cheptel-detail-corps">
                        <DragodindeDetail
                          m={eleveDragodinde.byId[eleveDragodinde.selectedId]}
                          byId={eleveDragodinde.byId}
                          onPatch={(p) => eleveDragodinde.patchMuldo(eleveDragodinde.selectedId, p)}
                          onDelete={() => eleveDragodinde.deleteMuldo(eleveDragodinde.selectedId)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                  <ArbreGenealogiquePanel cheptel={eleveDragodinde.cheptel} onSelect={eleveDragodinde.setSelectedId} sexeFn={sexeDragodinde} plierCouleurFn={plierCouleurDragodinde} />
                  <GraphiquesPanel cheptel={eleveDragodinde.cheptel} journal={eleveDragodinde.journal} instantanes={eleveDragodinde.instantanes} generationDeCouleurFn={generationDeCouleurDragodinde} sexeFn={sexeDragodinde} reproductibleFn={dragodindeReproductible} nomEntitePluriel="Dragodindes" />
                  <StatsCroisementsPanel journal={eleveDragodinde.journal} />
                  <CorbeillePanel {...eleveDragodinde.corbeilleProps} />
                </>
              )}
              {sousPage === "synchro" && (
                <DragodindeSynchronisationPage
                  {...eleveDragodinde.syncProps}
                  showToast={showToast}
                  onSupprimerMuldo={(m) => {
                    if (window.confirm(`Supprimer définitivement ${m.nom || m.couleur} ? (généalogie : ce dragodinde a des parents ou descendants connus)`)) {
                      eleveDragodinde.deleteMuldo(m.id);
                      showToast(`${m.nom || m.couleur} supprimé.`);
                    }
                  }}
                />
              )}
              {sousPage === "gps" && <DragodindeGpsPage {...eleveDragodinde.gpsProps} {...eleveDragodinde.naissancesProps} onPartagerTaverne={partagerDansTaverne} onObjectifAtteint={(couleur, sexe) => showToast(`🎯 Objectif GPS atteint ! ${couleur} ${sexe === "F" ? "♀" : "♂"} obtenu(e).`, { type: "objectif", duration: 5000 })} />}
              {sousPage === "clonage" && <DragodindeClonagePage {...eleveDragodinde.clonageProps} />}
            </>
          )}

          {page === "volkorne" && (
            <>
              <SousNavOutils sousPage={sousPage} setSousPage={setSousPage} />
              {sousPage === "cheptel" && (
                <>
                <div className="cheptel-layout">
                  <div className="cheptel-liste">
                    <VolkorneCheptelOverviewPage
                      cheptel={eleveVolkorne.cheptel}
                      selectedId={eleveVolkorne.selectedId}
                      setSelectedId={eleveVolkorne.setSelectedId}
                      filter={eleveVolkorne.filter}
                      setFilter={eleveVolkorne.setFilter}
                      onSupprimerPlusieurs={(ids) => {
                        eleveVolkorne.deleteMuldos(ids);
                        showToast(`${ids.length} volkorne(s) mis à la corbeille.`);
                      }}
                      onMarquerStatutPlusieurs={(ids, statut) => {
                        eleveVolkorne.marquerStatutMuldos(ids, statut);
                        showToast(`${ids.length} volkorne(s) passé(s) en ${statut}.`);
                      }}
                    />
                  </div>
                  {eleveVolkorne.selectedId && eleveVolkorne.byId[eleveVolkorne.selectedId] && (
                    <div className="cheptel-backdrop" onClick={() => eleveVolkorne.setSelectedId(null)} />
                  )}
                  {eleveVolkorne.selectedId && eleveVolkorne.byId[eleveVolkorne.selectedId] && (
                    <div className="cheptel-detail">
                      <div className="cheptel-detail-barre">
                        <span style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <VolkorneBadge couleur={eleveVolkorne.byId[eleveVolkorne.selectedId].couleur} taille={18} /> {eleveVolkorne.byId[eleveVolkorne.selectedId].nom || eleveVolkorne.byId[eleveVolkorne.selectedId].couleur}
                        </span>
                        <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => eleveVolkorne.setSelectedId(null)}>
                          ✕ Fermer
                        </button>
                      </div>
                      <div className="cheptel-detail-corps">
                        <VolkorneDetail
                          m={eleveVolkorne.byId[eleveVolkorne.selectedId]}
                          byId={eleveVolkorne.byId}
                          onPatch={(p) => eleveVolkorne.patchMuldo(eleveVolkorne.selectedId, p)}
                          onDelete={() => eleveVolkorne.deleteMuldo(eleveVolkorne.selectedId)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                  <ArbreGenealogiquePanel cheptel={eleveVolkorne.cheptel} onSelect={eleveVolkorne.setSelectedId} sexeFn={sexeVolkorne} plierCouleurFn={plierCouleurVolkorne} />
                  <GraphiquesPanel cheptel={eleveVolkorne.cheptel} journal={eleveVolkorne.journal} instantanes={eleveVolkorne.instantanes} generationDeCouleurFn={generationDeCouleurVolkorne} sexeFn={sexeVolkorne} reproductibleFn={volkorneReproductible} nomEntitePluriel="Volkornes" />
                  <StatsCroisementsPanel journal={eleveVolkorne.journal} />
                  <CorbeillePanel {...eleveVolkorne.corbeilleProps} />
                </>
              )}
              {sousPage === "synchro" && (
                <VolkorneSynchronisationPage
                  {...eleveVolkorne.syncProps}
                  showToast={showToast}
                  onSupprimerMuldo={(m) => {
                    if (window.confirm(`Supprimer définitivement ${m.nom || m.couleur} ? (généalogie : ce volkorne a des parents ou descendants connus)`)) {
                      eleveVolkorne.deleteMuldo(m.id);
                      showToast(`${m.nom || m.couleur} supprimé.`);
                    }
                  }}
                />
              )}
              {sousPage === "gps" && <VolkorneGpsPage {...eleveVolkorne.gpsProps} {...eleveVolkorne.naissancesProps} onPartagerTaverne={partagerDansTaverne} onObjectifAtteint={(couleur, sexe) => showToast(`🎯 Objectif GPS atteint ! ${couleur} ${sexe === "F" ? "♀" : "♂"} obtenu(e).`, { type: "objectif", duration: 5000 })} />}
              {sousPage === "clonage" && <VolkorneClonagePage {...eleveVolkorne.clonageProps} />}
            </>
          )}
        </div>
      </div>

      {eleveMuldo.showNew && <NewMuldoModal cheptel={eleveMuldo.cheptel} onClose={() => eleveMuldo.setShowNew(false)} onCreate={eleveMuldo.addMuldo} />}
      {eleveDragodinde.showNew && <NewDragodindeModal cheptel={eleveDragodinde.cheptel} onClose={() => eleveDragodinde.setShowNew(false)} onCreate={eleveDragodinde.addMuldo} />}
      {eleveVolkorne.showNew && <NewVolkorneModal cheptel={eleveVolkorne.cheptel} onClose={() => eleveVolkorne.setShowNew(false)} onCreate={eleveVolkorne.addMuldo} />}

      <OnboardingOverlay open={onboardingGpsOuvert} onClose={fermerOnboardingGps} etapes={ETAPES_ONBOARDING_GPS} titre="Découverte du GPS" />
      <OnboardingOverlay open={onboardingSiteOuvert} onClose={fermerOnboardingSite} etapes={ETAPES_ONBOARDING_SITE} titre="Visite du Registre des Abysses" />

      {profilOuvert && (
        <ProfilModal compte={compte} profilLocal={profil} setProfilLocal={setProfil} onClose={() => setProfilOuvert(false)} parrainCapture={parrainCapture} />
      )}

      {signalerBugOuvert && (
        <SignalerBugModal
          session={compte.session}
          page={page}
          sousPage={sousPage}
          onClose={() => setSignalerBugOuvert(false)}
          onEnvoye={() => showToast("Bug signalé, merci !")}
        />
      )}

      {chargerSauvegardeOuvert && (
        <ChargerSauvegardeModal
          liste={listeSauvegardesManuelles}
          onCharger={chargerEtRecharger}
          onClose={() => setChargerSauvegardeOuvert(false)}
        />
      )}

      {eleveMuldo.ficheRapide && (
        <FicheRapideModal
          muldo={eleveMuldo.ficheRapide}
          byId={eleveMuldo.byId}
          onPatch={(p) => eleveMuldo.patchMuldo(eleveMuldo.ficheRapide.id, p)}
          onDelete={() => { eleveMuldo.deleteMuldo(eleveMuldo.ficheRapide.id); eleveMuldo.setFicheRapideId(null); }}
          onClose={() => eleveMuldo.setFicheRapideId(null)}
        />
      )}

      <footer style={{
        padding: "18px 24px 22px",
        textAlign: "center",
        color: "var(--muted)",
        fontSize: 11,
        lineHeight: 1.6,
        borderTop: "1px solid var(--line)",
      }}>
        Registre des Abysses — outil communautaire d'élevage de muldos, créé par un joueur pour les joueurs.
        <br />
        Projet non affilié à Ankama. DOFUS et tous les éléments associés sont la propriété d'Ankama Games.
        Aucun contenu ni visuel du jeu n'est utilisé par cet outil.
        <br />
        © {new Date().getFullYear()} Registre des Abysses — tous droits réservés. Reproduction ou réutilisation du code interdite sans autorisation.
        {LIEN_DISCORD && (
          <>
            <br />
            <a href={LIEN_DISCORD} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>💬 Rejoindre la communauté sur Discord</a>
          </>
        )}
        <br />
        <a href="#" onClick={(e) => { e.preventDefault(); relancerParcoursGuide(); }} style={{ color: "var(--gold)" }}>🎓 Relancer le parcours guidé</a>
        {" · "}
        <a href="#" onClick={(e) => { e.preventDefault(); setPage("nouveautes"); }} style={{ color: "var(--gold)" }}>🆕 Quoi de neuf</a>
        {" · "}
        <a href="#" onClick={(e) => { e.preventDefault(); relancerOnboardingSite(); }} style={{ color: "var(--gold)" }}>🧭 Revoir la visite guidée</a>
      </footer>

      {toast && (() => {
        const type = typeof toast === "string" ? null : toast.type;
        // "error"/"success" n'avaient jusqu'ici aucune distinction visuelle avec
        // un message neutre (même bordure or) : on les différencie par couleur
        // + icône. "objectif" garde son style existant (les messages embarquent
        // déjà leur propre emoji 🎯/🎉), un icone en plus ferait doublon.
        const styleParType = {
          error: { couleur: "var(--red)", icone: "⚠️", glow: "rgba(216,91,79,.4)" },
          success: { couleur: "var(--green)", icone: "✅", glow: "rgba(104,193,111,.4)" },
          objectif: { couleur: "var(--cyan)", icone: null, glow: "var(--cyan)" },
        }[type] || { couleur: "var(--gold)", icone: null, glow: null };
        return (
          <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 90, maxWidth: "min(92vw, 640px)", pointerEvents: "none", display: "flex", alignItems: "center", gap: 8, background: "var(--panel)", border: `1px solid ${styleParType.couleur}`, color: "var(--text)", padding: "10px 16px", borderRadius: 12, fontSize: 13, boxShadow: styleParType.glow ? `0 12px 30px rgba(0,0,0,.45), 0 0 20px ${styleParType.glow}` : "0 12px 30px rgba(0,0,0,.45)", animation: "toast-in .2s ease" }}>
            {styleParType.icone && <span>{styleParType.icone}</span>}
            <span>{typeof toast === "string" ? toast : toast.msg}</span>
          </div>
        );
      })()}

      {typeof parcoursGuideEtape === "number" && (
        <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 88, maxWidth: 320, background: "var(--panel)", border: "1px solid var(--gold)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 14px 36px rgba(0,0,0,.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
              🎓 Parcours guidé · {parcoursGuideEtape + 1}/{ETAPES_PARCOURS_GUIDE.length}
            </span>
            <X size={14} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={sauterParcoursGuide} />
          </div>
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{ETAPES_PARCOURS_GUIDE[parcoursGuideEtape].texte}</div>
        </div>
      )}
    </div>
  );
}






function SousNavOutils({ sousPage, setSousPage }) {
  const outils = [
    ["cheptel", "🐴", "Cheptel"],
    ["synchro", "📷", "Synchro"],
    ["gps", "🛰️", "GPS"],
    ["clonage", "🧬", "Clonage"],
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
      {outils.map(([key, icon, label]) => (
        <button
          key={key}
          className="btn btn-ghost"
          style={sousPage === key ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined}
          onClick={() => setSousPage(key)}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
}

function AppSidebar({ page, setPage, cheptel, readyCount, fertileCount, discoveredTotal, cheptelDragodinde, cheptelVolkorne, estModo, estInvite }) {
  const nav = [
    ["dashboard", "🏠", "Dashboard"],
    ["dragodinde", "🐲", "Dragodinde"],
    ["muldo", "🐴", "Muldo"],
    ["volkorne", "🐎", "Volkorne"],
    ["mangeoire", "🍽️", "Carburant d'enclos"],
    ["taverne", "🍻", "Taverne"],
    ["succes", "🏆", "Succès"],
    ["guide", "📖", "Guide"],
    ...(estModo ? [["moderation", "🛡️", "Modération"]] : []),
  ];
  // Seule la Taverne (forum + classement) dépend d'un compte — le reste
  // (cheptels, GPS, mangeoire, succès...) reste pleinement utilisable en
  // mode invité, voir estInvite dans AppConnecte.
  const pagesReserveesCompte = new Set(["taverne"]);

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Navigation</div>
      {nav.map(([key, icon, label]) => {
        const verrouillee = estInvite && pagesReserveesCompte.has(key);
        return (
          <button
            key={key}
            className={`btn btn-ghost nav-btn ${page === key ? "nav-active" : ""}`}
            onClick={() => setPage(key)}
            title={verrouillee ? "Réservé aux éleveurs connectés" : undefined}
            style={verrouillee ? { opacity: 0.5 } : undefined}
          >
            <span style={{ fontSize: 17 }}>{icon}</span>
            <span>{label}</span>
            {verrouillee && <span style={{ marginLeft: "auto", fontSize: 12 }}>🔒</span>}
          </button>
        );
      })}

      <div className="side-metric">
        <div style={{ fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>Muldos</div>
        <div><b style={{ color: "var(--gold2)" }}>{cheptel.length}</b> enregistrés</div>
        <div><b style={{ color: "var(--green)" }}>{fertileCount}</b> fertiles</div>
        <div><b style={{ color: "var(--cyan)" }}>{readyCount}</b> prêts</div>
        <div><b style={{ color: "var(--gold2)" }}>{discoveredTotal}</b> couleurs découvertes</div>
      </div>
      <div className="side-metric">
        <div style={{ fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>Dragodindes</div>
        <div><b style={{ color: "var(--gold2)" }}>{(cheptelDragodinde || []).length}</b> enregistrés</div>
      </div>
      <div className="side-metric">
        <div style={{ fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>Volkornes</div>
        <div><b style={{ color: "var(--gold2)" }}>{(cheptelVolkorne || []).length}</b> enregistrés</div>
      </div>
    </aside>
  );
}

// Trois créatures, trois économies distinctes (couleurs, générations, prix
// différents) : un sélecteur au lieu de tout empiler dans un seul tableau.
const CREATURES_ESTIMATION = [
  { cle: "muldo", label: "Muldo", icone: "🐴", nomHdv: "Muldo", labelExtraction: "Ambre", storageKey: STORAGE_PRIX_KAMAS, generationDeCouleurFn: generationDeCouleur, badge: MuldoBadge },
  { cle: "dragodinde", label: "Dragodinde", icone: "🐲", nomHdv: "Dragodinde", labelExtraction: "Neurone de Dragodinde", storageKey: STORAGE_PRIX_KAMAS_DRAGODINDE, generationDeCouleurFn: generationDeCouleurDragodinde },
  { cle: "volkorne", label: "Volkorne", icone: "🐎", nomHdv: "Volkorne", labelExtraction: "Corne de Volkorne", storageKey: STORAGE_PRIX_KAMAS_VOLKORNE, generationDeCouleurFn: generationDeCouleurVolkorne },
];

function EstimationKamasSelecteur({ cheptelMuldo, cheptelDragodinde, cheptelVolkorne, userId, serveur }) {
  const [actif, setActif] = useState("muldo");
  const cheptelParCreature = { muldo: cheptelMuldo, dragodinde: cheptelDragodinde, volkorne: cheptelVolkorne };
  const config = CREATURES_ESTIMATION.find((c) => c.cle === actif);

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {CREATURES_ESTIMATION.map((c) => (
          <button
            key={c.cle}
            type="button"
            className="btn btn-ghost"
            style={actif === c.cle ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined}
            onClick={() => setActif(c.cle)}
          >
            {c.icone} {c.label}
          </button>
        ))}
      </div>
      <EstimationKamasTable
        key={config.cle}
        cheptel={cheptelParCreature[config.cle]}
        storageKey={config.storageKey}
        generationDeCouleurFn={config.generationDeCouleurFn}
        nomHdv={config.nomHdv}
        labelExtraction={config.labelExtraction}
        icone={config.icone}
        badge={config.badge}
        creature={config.cle}
        userId={userId}
        serveur={serveur}
      />
    </div>
  );
}

// Sous-ensemble volontairement restreint publié dans cheptels_publics : pas de
// notes privées, pas de dates, pas de jauges (amour/endurance/maturité/sérénité).
function extraireCheptelPublic(cheptel) {
  return (cheptel || []).map((m) => ({ couleur: m.couleur, sexe: m.sexe, generation: m.generation, statut: m.statut }));
}

const CREATURES_PARTAGE = [
  { cle: "muldo", label: "Muldo", icone: "🐴" },
  { cle: "dragodinde", label: "Dragodinde", icone: "🐲" },
  { cle: "volkorne", label: "Volkorne", icone: "🐎" },
];

function PartagePublicPanel({ session, pseudo, cheptelMuldo, cheptelDragodinde, cheptelVolkorne, showToast, onPartagerTaverne }) {
  const cheptelParCreature = { muldo: cheptelMuldo, dragodinde: cheptelDragodinde, volkorne: cheptelVolkorne };
  const [actif, setActif] = useState("muldo");
  const [statuts, setStatuts] = useState({}); // creature -> { maj_le } | null (jamais chargé) | "absent"
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    supabase.from("cheptels_publics").select("creature, maj_le").eq("utilisateur", session.user.id)
      .then(({ data }) => {
        const carte = { muldo: "absent", dragodinde: "absent", volkorne: "absent" };
        (data || []).forEach((l) => { carte[l.creature] = l.maj_le; });
        setStatuts(carte);
      });
    // Volontairement limité à l'id (primitif stable) plutôt qu'à l'objet
    // session, recréé à chaque rendu côté appelant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  if (!supabase || !session?.user) return null;

  const lienPublic = pseudo ? `${window.location.origin}/?voir=${encodeURIComponent(pseudo)}` : null;

  const publier = async (creature) => {
    setEnCours(true);
    const contenu = extraireCheptelPublic(cheptelParCreature[creature]);
    await supabase.from("cheptels_publics").upsert(
      { utilisateur: session.user.id, creature, contenu, maj_le: new Date().toISOString() },
      { onConflict: "utilisateur,creature" }
    );
    setStatuts((prev) => ({ ...prev, [creature]: new Date().toISOString() }));
    setEnCours(false);
    showToast?.("Cheptel publié — visible via ton lien public.");
  };

  const depublier = async (creature) => {
    setEnCours(true);
    await supabase.from("cheptels_publics").delete().eq("utilisateur", session.user.id).eq("creature", creature);
    setStatuts((prev) => ({ ...prev, [creature]: "absent" }));
    setEnCours(false);
  };

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>🔗 Cheptel public</h2>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
        Publie un instantané figé de ton cheptel (couleur/sexe/génération/statut uniquement, pas
        tes notes ni tes jauges) pour le montrer à ta guilde via un lien. Republier met à jour
        l'instantané ; rien ne se synchronise automatiquement.
      </div>
      {Object.values(statuts).some((s) => s && s !== "absent") && (
        <div className="success-chip success-ok" style={{ display: "inline-block", marginBottom: 12 }}>🏅 Premier cheptel publié</div>
      )}
      {lienPublic && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <code style={{ fontSize: 12, color: "var(--gold2)", wordBreak: "break-all" }}>{lienPublic}</code>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={async () => { if (await copierPressePapiers(lienPublic)) showToast?.("Lien copié !"); }}>Copier le lien</button>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => onPartagerTaverne?.(`Découvrez mon cheptel : ${lienPublic}`)}>🍻 Partager dans la Taverne</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {CREATURES_PARTAGE.map((c) => (
          <button key={c.cle} type="button" className="btn btn-ghost" style={actif === c.cle ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined} onClick={() => setActif(c.cle)}>
            {c.icone} {c.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {statuts[actif] === "absent" || !statuts[actif]
            ? "Pas encore publié."
            : `Publié le ${new Date(statuts[actif]).toLocaleString("fr-FR")}.`}
        </span>
        <button className="btn btn-coral" disabled={enCours} onClick={() => publier(actif)}>Publier mon cheptel {CREATURES_PARTAGE.find((c) => c.cle === actif)?.label}</button>
        {statuts[actif] && statuts[actif] !== "absent" && (
          <button className="btn btn-ghost" disabled={enCours} onClick={() => depublier(actif)}>Dépublier</button>
        )}
      </div>
    </div>
  );
}

// Programme de parrainage leger : indépendant du système d'ailes payant (pas
// de récompense automatique attribuée ici) — juste un lien personnel et un
// compteur de filleuls inscrits / actifs (ayant posté au moins un message
// dans la Taverne), affiché comme un badge de plus sur le profil.
function ParrainagePanel({ session, pseudo, showToast }) {
  const [filleuls, setFilleuls] = useState(null); // null = pas encore chargé
  const [actifs, setActifs] = useState(0);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    (async () => {
      const { data: liste } = await supabase.from("profils").select("id").eq("parrain_id", session.user.id);
      setFilleuls(liste || []);
      if (liste?.length) {
        const { data: messages } = await supabase.from("messages").select("auteur").in("auteur", liste.map((f) => f.id));
        setActifs(new Set((messages || []).map((m) => m.auteur)).size);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  if (!supabase || !session?.user) return null;

  const lienParrainage = pseudo ? `${window.location.origin}/?parrain=${encodeURIComponent(pseudo)}` : null;

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>🤝 Parrainage</h2>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
        Partage ton lien : chaque nouvel éleveur inscrit via ce lien est compté ci-dessous. Purement
        indicatif pour l'instant — aucun palier d'ailes n'est attribué automatiquement.
      </div>
      {lienParrainage && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <code style={{ fontSize: 12, color: "var(--gold2)", wordBreak: "break-all" }}>{lienParrainage}</code>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={async () => { if (await copierPressePapiers(lienParrainage)) showToast?.("Lien copié !"); }}>Copier le lien</button>
        </div>
      )}
      <div style={{ fontSize: 13 }}>
        {filleuls === null ? "Chargement…" : `${filleuls.length} filleul(s) inscrit(s) · ${actifs} actif(s) (ont posté dans la Taverne)`}
      </div>
      {actifs > 0 && (
        <div className="success-chip success-ok" style={{ display: "inline-block", marginTop: 10 }}>🤝 Parrain actif</div>
      )}
    </div>
  );
}

function CheptelPublicPage({ pseudo, cheptelViewer }) {
  const [etat, setEtat] = useState("chargement"); // chargement | introuvable | ok
  const [cheptels, setCheptels] = useState({});
  const viewerADuCheptel = CREATURES_PARTAGE.some((c) => (cheptelViewer?.[c.cle] || []).length > 0);
  const [comparer, setComparer] = useState(false);

  useEffect(() => {
    document.title = `Cheptel de ${pseudo} — Registre des Abysses`;
  }, [pseudo]);

  useEffect(() => {
    if (!supabase) { setEtat("introuvable"); return; }
    (async () => {
      const { data: profilTrouve } = await supabase.from("profils").select("id, pseudo").eq("pseudo", pseudo).maybeSingle();
      if (!profilTrouve) { setEtat("introuvable"); return; }
      const { data } = await supabase.from("cheptels_publics").select("creature, contenu, maj_le").eq("utilisateur", profilTrouve.id);
      const carte = {};
      (data || []).forEach((l) => { carte[l.creature] = l; });
      setCheptels(carte);
      setEtat("ok");
    })();
  }, [pseudo]);

  return (
    <div className="app-shell" style={{ padding: "24px 28px" }}>
      <style>{`
        :root {
          --bg: #17130f; --panel: #2b241d; --panel2: #352b22; --panel3: #403225; --line: #5b4733;
          --gold: #d6a64a; --gold2: #f0cf72; --accent: #c97935; --text: #f4ead7; --muted: #a9967c;
          --font-display: 'Fraunces', Georgia, serif; --font-ui: 'Inter', sans-serif;
        }
        body { margin: 0; background: #0c0a08; color: var(--text); font-family: var(--font-ui); }
        .panel-card {
          background:linear-gradient(180deg, var(--panel3), var(--panel2));
          border:1px solid var(--line); border-radius:18px; padding:18px 20px;
          box-shadow:0 14px 36px rgba(0,0,0,.22);
        }
        .pill {
          display:inline-flex; align-items:center; gap:6px; padding:8px 10px; border-radius:999px;
          background:rgba(0,0,0,.18); border:1px solid var(--line); color:var(--text); font-weight:700; font-size:12px;
        }
        .muldo-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
        .muldo-card {
          border-radius:16px; padding:14px; border:1px solid var(--line);
          background:linear-gradient(145deg, var(--panel3), var(--panel2));
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-display)", color: "var(--gold2)" }}>Cheptel public de {pseudo}</h1>
        {viewerADuCheptel && etat === "ok" && (
          <button
            type="button"
            onClick={() => setComparer((v) => !v)}
            style={{ background: comparer ? "var(--gold)" : "transparent", color: comparer ? "#17130f" : "var(--gold2)", border: "1px solid var(--gold)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
          >
            🔍 {comparer ? "Masquer la comparaison" : "Comparer avec mon cheptel"}
          </button>
        )}
      </div>
      {etat === "chargement" && <div style={{ color: "var(--muted)" }}>Chargement…</div>}
      {etat === "introuvable" && <div style={{ color: "var(--muted)" }}>Éleveur introuvable, ou fonctionnalité non disponible.</div>}
      {etat === "ok" && CREATURES_PARTAGE.every((c) => !cheptels[c.cle]) && (
        <div style={{ color: "var(--muted)" }}>Cet éleveur n'a encore rien publié.</div>
      )}
      {etat === "ok" && CREATURES_PARTAGE.map((c) => {
        if (!cheptels[c.cle]) return null;
        const couleursPubliees = new Set((cheptels[c.cle].contenu || []).map((m) => m.couleur));
        const couleursViewer = new Set((cheptelViewer?.[c.cle] || []).map((m) => m.couleur));
        const communes = [...couleursPubliees].filter((x) => couleursViewer.has(x)).sort((a, b) => a.localeCompare(b, "fr"));
        const seulementLui = [...couleursPubliees].filter((x) => !couleursViewer.has(x)).sort((a, b) => a.localeCompare(b, "fr"));
        const seulementMoi = [...couleursViewer].filter((x) => !couleursPubliees.has(x)).sort((a, b) => a.localeCompare(b, "fr"));
        return (
          <div className="panel-card" key={c.cle} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0 }}>{c.icone} {c.label}</h2>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>publié le {new Date(cheptels[c.cle].maj_le).toLocaleString("fr-FR")}</span>
            </div>
            {comparer && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 12, marginBottom: 4 }}>
                <div style={{ fontSize: 12 }}>
                  <b style={{ color: "var(--gold2)" }}>En commun ({communes.length})</b>
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>{communes.join(", ") || "—"}</div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <b style={{ color: "var(--gold2)" }}>Seulement {pseudo} ({seulementLui.length})</b>
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>{seulementLui.join(", ") || "—"}</div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <b style={{ color: "var(--gold2)" }}>Seulement vous ({seulementMoi.length})</b>
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>{seulementMoi.join(", ") || "—"}</div>
                </div>
              </div>
            )}
            <div className="muldo-grid" style={{ marginTop: 12 }}>
              {(cheptels[c.cle].contenu || []).map((m, i) => (
                <div className="muldo-card" key={i} style={comparer && couleursViewer.has(m.couleur) ? { cursor: "default", borderColor: "var(--gold)" } : { cursor: "default" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>{m.sexe === "F" ? "♀" : "♂"} {m.couleur}</b>
                    <span className="pill">G{m.generation}</span>
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                    {m.statut}{comparer && couleursViewer.has(m.couleur) && <span style={{ color: "var(--gold)" }}> · vous l'avez aussi</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <a href="/" style={{ color: "var(--gold)" }}>← Retour au Registre des Abysses</a>
      </div>
    </div>
  );
}

// Recherche déroulante générique sur les muldos : préfixe (sans accents/casse)
// sur le NOM ou la COULEUR, tous les résultats dans une liste scrollable.
// ---------- La Taverne : discussion entre éleveurs (Supabase) ----------
// Inscription : email réel + pseudo + mot de passe (confirmation par email).
// Connexion : pseudo OU email + mot de passe. Profils publics avec ailes,
// messages en temps réel.
// ---------- Compte : hook partagé (session + profil serveur) ----------
function useCompte() {
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState(null);
  const [profilErreur, setProfilErreur] = useState(null);
  const [pretMdp, setPretMdp] = useState(false); // lien de réinitialisation détecté

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: abo } = supabase.auth.onAuthStateChange((evenement, s) => {
      setSession(s || null);
      if (evenement === "PASSWORD_RECOVERY") setPretMdp(true);
      if (evenement === "SIGNED_OUT") setPretMdp(false);
    });
    return () => abo.subscription.unsubscribe();
  }, []);

  const rafraichirProfil = React.useCallback(() => {
    if (!supabase || !session?.user) { setProfil(null); setProfilErreur(null); return; }
    setProfilErreur(null);
    // supabase-js ne rejette jamais cette promesse (erreur réseau/RLS incluse) :
    // elle résout toujours avec { data: null, error }. Sans vérifier `error` ici,
    // setProfil(null) masque silencieusement l'échec derrière le même état que
    // "pas encore chargé", et l'UI reste bloquée sur "Chargement du profil…"
    // indéfiniment (voir ProfilModal, qui affiche ce message tant que !profil).
    supabase.from("profils").select("*").eq("id", session.user.id).single()
      .then(({ data, error }) => {
        if (error) { console.error("Chargement du profil impossible :", error); setProfilErreur(error.message); return; }
        setProfil(data || null);
      });
  }, [session]);

  useEffect(() => { rafraichirProfil(); }, [rafraichirProfil]);

  return { session, profil, profilErreur, pretMdp, setPretMdp, rafraichirProfil, estModo: !!profil?.est_modo };
}

// Filtre volontairement simple (sous-chaîne, insensible à la casse/aux
// accents) — sert à décourager les pseudos grossiers évidents, pas à être
// infranchissable. Liste courte à dessein pour limiter les faux positifs sur
// des mots-racines ambigus (ex. "con" apparaît dans trop de prénoms/mots
// innocents pour être bloqué tel quel).
const MOTS_INTERDITS_PSEUDO = [
  "merde", "putain", "salope", "connard", "connasse", "encule", "batard",
  "bite", "couille", "nique", "fdp", "ntm", "negro", "pede", "salaud", "branler",
];
function contientMotInterdit(texte) {
  const normalise = texte.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return MOTS_INTERDITS_PSEUDO.some((mot) => normalise.includes(mot));
}

// Politique de mot de passe alignée sur celle de Google (8 caractères minimum,
// mélange lettres/chiffres) plutôt que le seul minimum de 6 imposé par défaut
// par Supabase Auth.
function erreurMotDePasse(mdp) {
  if (mdp.length < 8) return "Mot de passe : 8 caractères minimum.";
  if (!/[a-zA-Z]/.test(mdp) || !/[0-9]/.test(mdp)) return "Mot de passe : au moins une lettre et un chiffre.";
  return null;
}

// ---------- Panneau d'authentification (connexion / inscription / oubli) ----------
function AuthPanel({ profilLocal, pretMdp, onFini, parrainCapture }) {
  const [pseudo, setPseudo] = useState(profilLocal?.pseudo || "");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [emailRenvoi, setEmailRenvoi] = useState("");
  const [mode, setMode] = useState("connexion");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [chargement, setChargement] = useState(false);

  // On ne bascule en "nouveau mot de passe" que sur un vrai lien de
  // réinitialisation ; sinon (y compris après déconnexion) on reste sur connexion.
  useEffect(() => {
    setMode((m) => (pretMdp ? "nouveau-mdp" : (m === "nouveau-mdp" ? "connexion" : m)));
  }, [pretMdp]);

  const valider = async () => {
    setErreur(""); setInfo(""); setChargement(true);
    try {
      if (mode === "inscription") {
        const p = pseudo.trim(); const mail = email.trim().toLowerCase();
        if (p.length < 2 || p.length > 10) throw new Error("Pseudo entre 2 et 10 caractères.");
        if (contientMotInterdit(p)) throw new Error("Ce pseudo n'est pas autorisé.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error("Adresse email invalide.");
        const erreurMdp = erreurMotDePasse(motDePasse);
        if (erreurMdp) throw new Error(erreurMdp);
        const { data: existant } = await supabase.from("profils").select("id").ilike("pseudo", p).maybeSingle();
        if (existant) throw new Error("Ce pseudo est déjà pris.");
        const { error } = await supabase.auth.signUp({ email: mail, password: motDePasse, options: { data: { pseudo: p, parrain: parrainCapture || undefined } } });
        // Message volontairement identique que l'email soit déjà pris ou non
        // (comme le flux "mot de passe oublié" ci-dessous) -- sinon n'importe
        // qui pourrait tester des adresses une par une pour savoir lesquelles
        // ont un compte sur le site.
        if (error && !/already/i.test(error.message)) throw new Error(error.message);
        setInfo(`Si cette adresse n'a pas déjà de compte, un email de confirmation vient d'être envoyé à ${mail} — clique le lien, puis connecte-toi. Sinon, connecte-toi directement.`);
        setMode("connexion"); setEmail(mail); setMotDePasse("");
      } else if (mode === "oubli") {
        const mail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error("Entre l'adresse email de ton compte.");
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin });
        if (error) throw error;
        setInfo("Si un compte existe pour cette adresse, un email de réinitialisation vient de partir.");
        setMode("connexion");
      } else if (mode === "nouveau-mdp") {
        const erreurMdp = erreurMotDePasse(motDePasse);
        if (erreurMdp) throw new Error(erreurMdp);
        const { error } = await supabase.auth.updateUser({ password: motDePasse });
        if (error) throw error;
        setInfo("Mot de passe changé, te voilà connecté !"); setMode("connexion"); setMotDePasse("");
        onFini && onFini();
      } else {
        const mail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error("Entre l'adresse email de ton compte.");
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: motDePasse });
        if (error) throw new Error(/confirm/i.test(error.message) ? "Email non confirmé : clique le lien reçu (ou renvoie-le ci-dessous)." : "Identifiants incorrects.");
        setMotDePasse(""); onFini && onFini();
      }
    } catch (e) { setErreur(e.message || "Erreur."); } finally { setChargement(false); }
  };

  const renvoyer = async () => {
    setErreur(""); setInfo("");
    const mail = emailRenvoi.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setErreur("Entre l'adresse email de ton compte."); return; }
    const { error } = await supabase.auth.resend({ type: "signup", email: mail });
    if (error) setErreur("Renvoi impossible : " + error.message);
    else setInfo(`Si un compte non confirmé existe pour ${mail}, l'email vient d'être renvoyé (vérifie les spams).`);
  };

  return (
    <div>
      {mode !== "nouveau-mdp" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[["connexion", "Connexion"], ["inscription", "Créer un compte"], ["oubli", "Mot de passe oublié"]].map(([v, t]) => (
            <button key={v} className="btn btn-ghost" style={mode === v ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined} onClick={() => { setMode(v); setErreur(""); setInfo(""); }}>{t}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {mode === "inscription" && (
          <>
            <input className="field" type="email" placeholder="Ton adresse email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: 210 }} />
            <input className="field" placeholder="Pseudo (public)" maxLength={10} value={pseudo} onChange={(e) => setPseudo(e.target.value)} style={{ width: 170 }} />
          </>
        )}
        {mode === "connexion" && (
          <input className="field" type="email" placeholder="Ton adresse email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: 210 }} />
        )}
        {mode === "oubli" && (
          <input className="field" type="email" placeholder="L'adresse email de ton compte" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: 240 }} />
        )}
        {mode !== "oubli" && (
          <input className="field" type="password" placeholder={mode === "nouveau-mdp" ? "Nouveau mot de passe" : "Mot de passe"} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} onKeyDown={(e) => e.key === "Enter" && valider()} style={{ width: 190 }} />
        )}
        <button className="btn btn-coral" disabled={chargement} onClick={valider}>
          {chargement ? "…" : mode === "inscription" ? "Rejoindre" : mode === "oubli" ? "Envoyer le lien" : mode === "nouveau-mdp" ? "Changer" : "Entrer"}
        </button>
      </div>
      {mode === "inscription" && (
        <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 6 }}>
          Ton email sert à confirmer le compte et à récupérer ton mot de passe — seul ton pseudo est visible.
        </div>
      )}
      {mode === "connexion" && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>Pas reçu l'email de confirmation ?</span>
          <input className="field" type="email" placeholder="Ton adresse email" value={emailRenvoi} onChange={(e) => setEmailRenvoi(e.target.value)} style={{ width: 210 }} />
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={renvoyer}>Renvoyer</button>
        </div>
      )}
      {erreur && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{erreur}</div>}
      {info && <div style={{ color: "var(--green)", fontSize: 12, marginTop: 8 }}>{info}</div>}
    </div>
  );
}

// ---------- Modale Profil (ouverte depuis le bouton d'en-tête) ----------
function ProfilModal({ compte, profilLocal, setProfilLocal, onClose, parrainCapture }) {
  const { session, profil, profilErreur, pretMdp, rafraichirProfil } = compte;
  const [description, setDescription] = useState("");
  const [nouveauPseudo, setNouveauPseudo] = useState("");
  const [changementPseudoEnCours, setChangementPseudoEnCours] = useState(false);
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [info, setInfo] = useState("");
  const [erreur, setErreur] = useState("");
  const [donsCumules, setDonsCumules] = useState(0);
  const [chargementDon, setChargementDon] = useState(0); // palier en cours de paiement, 0 = aucun
  const [montantLibre, setMontantLibre] = useState("");
  const [chargementDonLibre, setChargementDonLibre] = useState(false);

  useEffect(() => { setDescription(profil?.description || ""); }, [profil]);
  useEffect(() => { setNouveauPseudo(profil?.pseudo || ""); }, [profil]);

  useEffect(() => {
    if (!session) return;
    supabase.from("dons").select("montant_euros").eq("profil_id", session.user.id).then(({ data }) => {
      setDonsCumules((data || []).reduce((total, d) => total + Number(d.montant_euros), 0));
    });
  }, [session]);

  // Facture uniquement la différence jusqu'au palier visé (voir
  // supabase/functions/creer-session-don) : redirige vers Stripe Checkout
  // dans le même onglet (window.open() après un await se fait bloquer
  // silencieusement par la plupart des navigateurs, sans erreur visible —
  // symptôme observé : le bouton "ne déclenche rien"), le webhook attribue
  // le palier dès le paiement confirmé.
  const donnerPourPalier = async (n) => {
    setErreur(""); setInfo(""); setChargementDon(n);
    try {
      const { data, error } = await supabase.functions.invoke("creer-session-don", {
        body: { palier: n, retourUrl: window.location.href },
      });
      if (error) { setErreur("Paiement indisponible pour le moment : " + error.message); return; }
      if (data?.url) window.location.href = data.url;
      else if (data?.message) setInfo(data.message);
    } finally {
      setChargementDon(0);
    }
  };

  // Don libre : débloqué une fois le palier max atteint, pour continuer à
  // soutenir sans montant plafonné par un palier.
  const donnerMontantLibre = async () => {
    setErreur(""); setInfo("");
    const montant = Number(montantLibre.replace(",", "."));
    if (!Number.isFinite(montant) || montant < 0.5) { setErreur("Indique un montant valide (0,50 € minimum)."); return; }
    setChargementDonLibre(true);
    try {
      const { data, error } = await supabase.functions.invoke("creer-session-don", {
        body: { montantLibre: montant, retourUrl: window.location.href },
      });
      if (error) { setErreur("Paiement indisponible pour le moment : " + error.message); return; }
      if (data?.url) window.location.href = data.url;
      else if (data?.message) setInfo(data.message);
    } finally {
      setChargementDonLibre(false);
    }
  };

  const patcher = async (patch, message) => {
    setErreur(""); setInfo("");
    const { error } = await supabase.from("profils").update(patch).eq("id", session.user.id);
    if (error) { setErreur(error.message); return; }
    rafraichirProfil(); setInfo(message);
  };

  // Séparé de patcher() : seul ce changement a besoin de comprendre le
  // message d'erreur "pseudo_cooldown:<date>" renvoyé par le trigger SQL
  // limiter_changement_pseudo (v22) pour l'afficher joliment.
  const changerPseudo = async () => {
    setErreur(""); setInfo("");
    const p = nouveauPseudo.trim();
    if (p.length < 2 || p.length > 10) { setErreur("Pseudo entre 2 et 10 caractères."); return; }
    if (contientMotInterdit(p)) { setErreur("Ce pseudo n'est pas autorisé."); return; }
    if (p.toLowerCase() === (profil.pseudo || "").toLowerCase()) return;
    setChangementPseudoEnCours(true);
    try {
      const { data: existant } = await supabase.from("profils").select("id").ilike("pseudo", p).neq("id", session.user.id).maybeSingle();
      if (existant) { setErreur("Ce pseudo est déjà pris."); return; }
      const { error } = await supabase.from("profils").update({ pseudo: p }).eq("id", session.user.id);
      if (error) {
        const cooldown = /^pseudo_cooldown:(.+)$/.exec(error.message);
        if (cooldown) {
          const date = new Date(cooldown[1]).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
          setErreur(`Tu pourras rechanger de pseudo le ${date}.`);
        } else {
          setErreur(error.message);
        }
        return;
      }
      rafraichirProfil(); setInfo("Pseudo mis à jour.");
    } finally {
      setChangementPseudoEnCours(false);
    }
  };
  const changerMdp = async () => {
    setErreur(""); setInfo("");
    const erreurMdp = erreurMotDePasse(nouveauMdp);
    if (erreurMdp) { setErreur(erreurMdp); return; }
    const { error } = await supabase.auth.updateUser({ password: nouveauMdp });
    if (error) { setErreur(error.message); return; }
    setNouveauMdp(""); setInfo("Mot de passe changé.");
  };

  const configManquante = !supabaseEstConfigure() || !supabase;
  // Les 3 styles d'ailes ne dépendent que du palier de don — plus de
  // condition de génération validée pour muldo (abandonné, uniformise avec
  // dragodinde/volkorne qui n'ont jamais eu cette contrainte).
  const tierDon = profil ? Math.max(0, Math.min(NIVEAU_MAX_AILES, Number(profil.niveau_ailes) || 0)) : 0;
  const tiersParStyle = { dragodinde: tierDon, muldo: tierDon, volkorne: tierDon };
  const niveauEffectif = profil ? (tiersParStyle[profil.style_ailes] ?? tierDon) : 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: "40px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 100%)", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>👤 Mon profil</h2>
          <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={onClose}>✕ Fermer</button>
        </div>

        {configManquante ? (
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>Le compte en ligne nécessite la configuration Supabase.</div>
        ) : (!session || pretMdp) ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              {pretMdp ? "Choisis ton nouveau mot de passe." : "Connecte-toi ou crée ton compte d'éleveur pour discuter dans la Taverne et gagner tes ailes."}
            </div>
            <AuthPanel profilLocal={profilLocal} pretMdp={pretMdp} onFini={rafraichirProfil} parrainCapture={parrainCapture} />
          </div>
        ) : !profil ? (
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
            {profilErreur ? (
              <>
                Impossible de charger ton profil ({profilErreur}).{" "}
                <button className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={rafraichirProfil}>Réessayer</button>
              </>
            ) : "Chargement du profil…"}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <PseudoAvecAiles pseudo={profil.pseudo} soutien={niveauEffectif > 0} styleAiles={profil.style_ailes} niveau={niveauEffectif} taille={20} />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{session.user.email} <span style={{ opacity: .6 }}>(privé)</span></span>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Description publique (300 car.) — visible au survol de ton pseudo</div>
              <textarea className="field" rows={3} maxLength={300} placeholder="Éleveur de muldos depuis la 2.0…" value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical" }} />
              <button className="btn btn-coral" style={{ marginTop: 8 }} onClick={() => patcher({ description: description.trim().slice(0, 300) }, "Description enregistrée.")}>Enregistrer</button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Pseudo (10 car. max) — modifiable une fois tous les 30 jours</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="field" maxLength={10} value={nouveauPseudo} onChange={(e) => setNouveauPseudo(e.target.value)} style={{ width: 200 }} />
                <button className="btn btn-coral" disabled={changementPseudoEnCours} onClick={changerPseudo}>Changer</button>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                Style d'ailes{niveauEffectif > 0 ? ` (${nomNiveauAiles(profil.style_ailes, niveauEffectif)})` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { style: "dragodinde", label: "Dragodinde" },
                  { style: "muldo", label: "Muldo" },
                  { style: "volkorne", label: "Volkorne" },
                ].map(({ style, label }) => {
                  const tier = tiersParStyle[style];
                  const verrouille = tier < 1;
                  const actif = profil.style_ailes === style;
                  return (
                    <button
                      key={style}
                      className="btn btn-ghost"
                      disabled={verrouille}
                      style={actif ? { borderColor: "var(--gold)", color: "var(--gold2)" } : verrouille ? { opacity: .5 } : undefined}
                      title={verrouille ? "Débloqué à partir du palier de don 1" : undefined}
                      onClick={() => !verrouille && patcher({ style_ailes: style }, `Ailes ${label} équipées.`)}
                    >
                      <AileNiveau style={style} taille={36} niveau={Math.max(1, tier)} /> {label}{verrouille ? " 🔒" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input className="field" type="password" placeholder="Nouveau mot de passe" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} style={{ width: 200 }} />
              <button className="btn btn-ghost" onClick={changerMdp}>Changer le mot de passe</button>
              <button className="btn btn-ghost" onClick={() => { supabase.auth.signOut(); onClose(); }} style={{ color: "var(--red)", borderColor: "var(--red)" }}>Se déconnecter</button>
            </div>
            {erreur && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{erreur}</div>}
            {info && <div style={{ color: "var(--green)", fontSize: 12, marginTop: 8 }}>{info}</div>}

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <b>🪽 Soutien &amp; ailes</b>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                {niveauEffectif > 0
                  ? <>Palier actuel : <b style={{ color: "var(--gold2)" }}>{nomNiveauAiles(profil.style_ailes, niveauEffectif)}</b>. Merci ! 💛</>
                  : <>Le Registre est gratuit — les soutiens gagnent leurs ailes, visibles dans toute la Taverne.</>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
                {[1,2,3].map((n) => (
                  <div key={n} style={{ padding: "8px", borderRadius: 10, textAlign: "center", border: `1px solid ${n === tierDon ? "var(--gold)" : "var(--line)"}`, background: n === tierDon ? "rgba(214,166,74,.08)" : "rgba(0,0,0,.12)" }}>
                    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 3 }}>
                      <AileNiveau style="dragodinde" miroir taille={18} niveau={n} />
                      <AileNiveau style="muldo" taille={18} niveau={n} />
                      <AileNiveau style="volkorne" taille={18} niveau={n} />
                    </div>
                    <div style={{ fontWeight: 800, color: "var(--gold2)", marginTop: 4, fontSize: 13 }}>{montantPourNiveau(n)} €</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>
                  Palier attribué automatiquement dès le paiement confirmé — chaque bouton ne facture
                  que le complément si tu as déjà donné{donsCumules > 0 ? ` (${donsCumules} € cumulés)` : ""} :
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[1, 2, 3].map((n) => {
                    const montantCible = montantPourNiveau(n);
                    const atteint = donsCumules >= montantCible;
                    const reste = Math.max(Math.round((montantCible - donsCumules) * 100) / 100, 0);
                    return (
                      <button
                        key={n}
                        type="button"
                        className="btn btn-coral"
                        disabled={atteint || chargementDon === n}
                        style={atteint ? { opacity: .5 } : undefined}
                        onClick={() => donnerPourPalier(n)}
                      >
                        {atteint ? `✓ palier ${n} atteint` : chargementDon === n ? "…" : `💳 ${reste} € (palier ${n})`}
                      </button>
                    );
                  })}
                </div>
              </div>
              {donsCumules >= montantPourNiveau(NIVEAU_MAX_AILES) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>
                    Palier max atteint — merci ! Tu peux continuer à soutenir le projet avec un don libre :
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      className="field"
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="Montant en €"
                      value={montantLibre}
                      onChange={(e) => setMontantLibre(e.target.value)}
                      style={{ width: 120 }}
                    />
                    <button type="button" className="btn btn-coral" disabled={chargementDonLibre} onClick={donnerMontantLibre}>
                      {chargementDonLibre ? "…" : "💳 Faire un don libre"}
                    </button>
                  </div>
                </div>
              )}
              {erreur && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{erreur}</div>}
              {info && <div style={{ color: "var(--green)", fontSize: 12, marginTop: 8 }}>{info}</div>}
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 8 }}>
                Les boutons ci-dessus attribuent le palier automatiquement.
              </div>
            </div>
          </div>
        )}

        <SoutienPanel profil={profilLocal} setProfil={setProfilLocal} />
      </div>
    </div>
  );
}

// ---------- Modale "Signaler un bug" (bouton en-tête) ----------
function SignalerBugModal({ session, page, sousPage, onClose, onEnvoye }) {
  const [contenu, setContenu] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const configManquante = !supabaseEstConfigure() || !supabase;

  const envoyer = async () => {
    const texte = contenu.trim();
    if (texte.length < 5) { setErreur("Décris le bug en au moins 5 caractères."); return; }
    setErreur("");
    setEnvoiEnCours(true);
    const { error } = await supabase.from("signalements_bugs").insert({
      auteur: session.user.id,
      contenu: texte,
      page: `${page}${sousPage ? ` / ${sousPage}` : ""}`,
    });
    setEnvoiEnCours(false);
    if (error) { setErreur(error.message); return; }
    onEnvoye();
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Bug size={18} /> Signaler un bug</h2>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕</button>
        </div>

        {configManquante ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Le signalement de bug nécessite la configuration Supabase.</div>
        ) : !session ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Connecte-toi (ou crée un compte gratuit) pour signaler un bug — ça permet de te recontacter si on a besoin de précisions.</div>
        ) : (
          <>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>
              Décris ce qui ne va pas (ce que tu as fait, ce à quoi tu t'attendais, ce qui s'est passé). La page actuelle (<b>{page}{sousPage ? ` / ${sousPage}` : ""}</b>) est jointe automatiquement.
            </div>
            <textarea
              className="field"
              rows={5}
              maxLength={1000}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="Ex : le bouton Cloner reste grisé même après avoir choisi les deux muldos…"
              style={{ width: "100%", resize: "vertical" }}
            />
            {erreur && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{erreur}</div>}
            <button className="btn btn-coral" style={{ marginTop: 12 }} disabled={envoiEnCours} onClick={envoyer}>
              {envoiEnCours ? "Envoi…" : "Envoyer le signalement"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const STORAGE_LU_SUJETS = "taverne-lu-sujets-v1";

// Découpe un texte de message sur les URLs qu'il contient et rend chaque
// morceau soit en texte brut, soit en lien cliquable — jamais de
// dangerouslySetInnerHTML (pas de dépendance de sanitisation dans ce repo,
// et le texte lui-même n'a besoin d'aucune autre mise en forme).
const REGEX_URL = /(https?:\/\/[^\s<>"']+)/g;
function linkifierTexte(texte) {
  const morceaux = String(texte || "").split(REGEX_URL);
  return morceaux.map((morceau, i) => {
    if (i % 2 === 0) return morceau;
    // Ponctuation de fin de phrase collée à l'URL (ex. "voir https://x.com.") :
    // on la sort du lien plutôt que de l'avaler dans le href.
    const fin = /[.,!?;:)\]]+$/.exec(morceau);
    const lien = fin ? morceau.slice(0, -fin[0].length) : morceau;
    const reste = fin ? fin[0] : "";
    if (!lien) return morceau;
    return (
      <React.Fragment key={i}>
        <a href={lien} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>{lien}</a>
        {reste}
      </React.Fragment>
    );
  });
}

function TavernePage({ compte, onOuvrirProfil, ouvrirClassementInitial, onClassementInitialConsomme, brouillonInitial, onBrouillonInitialConsomme }) {
  const { session } = compte;
  const [profilsParId, setProfilsParId] = useState({});
  const [sujets, setSujets] = useState([]);
  const [statsSujets, setStatsSujets] = useState({});
  const [vue, setVue] = useState({ type: "liste" });
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [citeCible, setCiteCible] = useState(null);
  const [abonneSujet, setAbonneSujet] = useState(false);
  const [abonnementEnCours, setAbonnementEnCours] = useState(false);
  const saisieRef = React.useRef(null);
  const [luSujets, setLuSujets] = useState(() => chargerJSON(STORAGE_LU_SUJETS, {}));

  const marquerSujetLu = (sujetId) => {
    setLuSujets((prev) => {
      const next = { ...prev, [sujetId ?? "general"]: new Date().toISOString() };
      sauvegarderJSON(STORAGE_LU_SUJETS, next);
      return next;
    });
  };
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouveauTitre, setNouveauTitre] = useState("");
  const [nouveauContenu, setNouveauContenu] = useState("");
  const [erreur, setErreur] = useState("");
  const [profilPublicId, setProfilPublicId] = useState(null);
  const [dmCible, setDmCible] = useState(null);
  const [messagesPrives, setMessagesPrives] = useState([]);
  const [saisieDm, setSaisieDm] = useState("");
  const [boiteOuverte, setBoiteOuverte] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [nonLuTotal, setNonLuTotal] = useState(0);
  const [classementOuvert, setClassementOuvert] = useState(false);
  const [classement, setClassement] = useState([]);
  const [pushActif, setPushActif] = useState(false);
  const [pushErreur, setPushErreur] = useState("");
  const [pushEnCours, setPushEnCours] = useState(false);

  useEffect(() => {
    if (!session?.user || !pushSupporte()) return;
    abonnementPushActuel().then((sub) => setPushActif(!!sub)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const basculerNotificationsPush = async () => {
    if (!session?.user) return;
    setPushErreur("");
    setPushEnCours(true);
    try {
      if (pushActif) {
        await desactiverNotificationsPush(session.user.id);
        setPushActif(false);
      } else {
        await activerNotificationsPush(session.user.id);
        setPushActif(true);
      }
    } catch (e) {
      setPushErreur(e.message || "Impossible de modifier les notifications push.");
    } finally {
      setPushEnCours(false);
    }
  };

  const chargerClassement = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("profils")
      .select("id, pseudo, style_ailes, niveau_ailes, succes_generation_muldo, couleurs_decouvertes_muldo, succes_generation_dragodinde, couleurs_decouvertes_dragodinde, succes_generation_volkorne, couleurs_decouvertes_volkorne, description, cree_le")
      .order("succes_generation_muldo", { ascending: false })
      .order("couleurs_decouvertes_muldo", { ascending: false })
      .limit(20);
    setClassement(data || []);
    const carte = {};
    (data || []).forEach((p) => { carte[p.id] = p; });
    setProfilsParId((prev) => ({ ...prev, ...carte }));
  };

  // Permet d'ouvrir le classement depuis une autre page (Succès) sans dupliquer
  // l'état classementOuvert/classement : on consomme le drapeau puis on prévient
  // App() pour qu'il le réinitialise (sinon rouvrir la Taverne rouvrirait aussi
  // systématiquement le classement).
  useEffect(() => {
    if (!ouvrirClassementInitial) return;
    setClassementOuvert(true);
    chargerClassement();
    onClassementInitialConsomme?.();
    // Callback de "consommation" volontairement exclu : c'est une fonction
    // inline côté App(), la dépendre relancerait l'effet à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirClassementInitial]);

  // Pré-remplit le Comptoir général avec un brouillon venant d'ailleurs (ex.
  // partage d'un plan GPS ou d'un cheptel publié) — même logique de
  // consommation à sens unique que le classement ci-dessus.
  useEffect(() => {
    if (!brouillonInitial) return;
    setVue({ type: "sujet", id: null, titre: "🍺 Comptoir général", auteur: null });
    setSaisie(brouillonInitial);
    onBrouillonInitialConsomme?.();
    // Même raisonnement que ci-dessus pour le classement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brouillonInitial]);
  const finFil = React.useRef(null);
  const dmCibleRef = React.useRef(dmCible);
  useEffect(() => { dmCibleRef.current = dmCible; }, [dmCible]);

  // ----- Chargements -----
  const chargerProfils = async (ids) => {
    const manquants = [...new Set(ids)].filter((id) => id && !profilsParId[id]);
    if (!manquants.length) return;
    const { data } = await supabase.from("profils").select("id, pseudo, style_ailes, niveau_ailes, succes_generation_muldo, description, cree_le").in("id", manquants);
    const carte = {};
    (data || []).forEach((p) => { carte[p.id] = p; });
    setProfilsParId((prev) => ({ ...prev, ...carte }));
  };

  const chargerConversations = async () => {
    if (!supabase || !session?.user) return;
    const { data } = await supabase.from("messages_prives")
      .select("id, expediteur, destinataire, contenu, lu, cree_le")
      .or(`expediteur.eq.${session.user.id},destinataire.eq.${session.user.id}`)
      .order("cree_le", { ascending: false })
      .limit(500);
    const parPartenaire = {};
    (data || []).forEach((m) => {
      const autre = m.expediteur === session.user.id ? m.destinataire : m.expediteur;
      if (!parPartenaire[autre]) parPartenaire[autre] = { id: autre, dernier: m, nonLu: 0 };
      if (m.destinataire === session.user.id && !m.lu) parPartenaire[autre].nonLu += 1;
    });
    const liste = Object.values(parPartenaire).sort((a, b) => new Date(b.dernier.cree_le) - new Date(a.dernier.cree_le));
    setConversations(liste);
    setNonLuTotal(liste.reduce((s, c) => s + c.nonLu, 0));
    chargerProfils(liste.map((c) => c.id));
  };

  const chargerConversationFil = async (autreId) => {
    if (!supabase || !session?.user) return;
    const { data } = await supabase.from("messages_prives")
      .select("id, expediteur, destinataire, contenu, lu, cree_le")
      .or(`and(expediteur.eq.${session.user.id},destinataire.eq.${autreId}),and(expediteur.eq.${autreId},destinataire.eq.${session.user.id})`)
      .order("cree_le", { ascending: true })
      .limit(500);
    setMessagesPrives(data || []);
    chargerProfils([autreId]);
    await supabase.from("messages_prives").update({ lu: true }).eq("destinataire", session.user.id).eq("expediteur", autreId).eq("lu", false);
    chargerConversations();
  };

  const ouvrirConversation = (autreId) => {
    setDmCible(autreId);
    setBoiteOuverte(false);
    setProfilPublicId(null);
    chargerConversationFil(autreId);
  };

  const envoyerMessagePrive = async () => {
    const contenu = saisieDm.trim();
    if (!contenu || !session?.user || !dmCible) return;
    setSaisieDm("");
    const { error } = await supabase.from("messages_prives").insert({ expediteur: session.user.id, destinataire: dmCible, contenu });
    if (error) { setErreur("Message refusé : " + error.message); return; }
    chargerConversationFil(dmCible);
  };

  const supprimerSujet = async (id) => {
    if (id === null) return;
    if (!window.confirm("Supprimer définitivement ce sujet et tous ses messages ?")) return;
    const { error } = await supabase.from("sujets").delete().eq("id", id);
    if (error) { setErreur("Suppression impossible : " + error.message); return; }
    setVue({ type: "liste" });
    chargerListe();
  };

  const supprimerMessage = async (id) => {
    if (!window.confirm("Supprimer définitivement ce message ?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) { setErreur("Suppression impossible : " + error.message); return; }
    if (vue.type === "sujet") chargerFil(vue.id);
  };

  const chargerListe = async () => {
    if (!supabase) return;
    const { data: listeSujets } = await supabase.from("sujets").select("id, auteur, titre, cree_le").order("cree_le", { ascending: false }).limit(100);
    setSujets(listeSujets || []);
    const { data: derniersMessages } = await supabase.from("messages").select("sujet_id, cree_le").order("cree_le", { ascending: false }).limit(1000);
    const stats = {};
    (derniersMessages || []).forEach((m) => {
      const cle = m.sujet_id ?? "general";
      if (!stats[cle]) stats[cle] = { nb: 0, dernier: m.cree_le };
      stats[cle].nb += 1;
    });
    setStatsSujets(stats);
    chargerProfils((listeSujets || []).map((s) => s.auteur));
  };

  const chargerFil = async (sujetId) => {
    if (!supabase) return;
    let requete = supabase.from("messages").select("id, auteur, contenu, cree_le, cite_message_id").order("cree_le", { ascending: true }).limit(200);
    requete = sujetId === null ? requete.is("sujet_id", null) : requete.eq("sujet_id", sujetId);
    const { data } = await requete;
    setMessages(data || []);
    chargerProfils((data || []).map((m) => m.auteur));
  };

  useEffect(() => {
    if (!supabase) return undefined;
    chargerListe();
    if (session?.user) chargerConversations();
    const canal = supabase
      .channel("taverne-forum")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (evt) => {
        chargerListe();
        const sujetCourant = vueRef.current.type === "sujet" ? vueRef.current.id : undefined;
        if (sujetCourant !== undefined && (evt.new?.sujet_id ?? null) === sujetCourant) { chargerFil(sujetCourant); marquerSujetLu(sujetCourant); }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => {
        chargerListe();
        if (vueRef.current.type === "sujet") chargerFil(vueRef.current.id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sujets" }, () => chargerListe())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "sujets" }, () => {
        chargerListe();
        if (vueRef.current.type === "sujet") setVue({ type: "liste" });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages_prives" }, (evt) => {
        if (!session?.user) return;
        const concerne = evt.new?.expediteur === session.user.id || evt.new?.destinataire === session.user.id;
        if (!concerne) return;
        chargerConversations();
        const cible = dmCibleRef.current;
        if (cible && (evt.new.expediteur === cible || evt.new.destinataire === cible)) chargerConversationFil(cible);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // Les charger*/dmCibleRef sont volontairement exclus : ce sont des
    // fonctions/refs recréées à chaque rendu, les dépendre romprait et
    // reconstruirait l'abonnement Supabase Realtime en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const vueRef = React.useRef(vue);
  useEffect(() => { vueRef.current = vue; }, [vue]);

  useEffect(() => {
    if (vue.type === "sujet") { chargerFil(vue.id); marquerSujetLu(vue.id); }
    setCiteCible(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue.type, vue.id]);

  // Abonnement au sujet courant (notifications push) — uniquement pour un
  // vrai sujet (vue.id !== null), le Comptoir général n'a pas d'id stable.
  useEffect(() => {
    if (!session?.user || vue.type !== "sujet" || vue.id === null) { setAbonneSujet(false); return; }
    let annule = false;
    supabase.from("abonnements_sujets").select("sujet_id")
      .eq("utilisateur", session.user.id).eq("sujet_id", vue.id).maybeSingle()
      .then(({ data }) => { if (!annule) setAbonneSujet(!!data); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, vue.type, vue.id]);

  const basculerAbonnementSujet = async () => {
    if (!session?.user || vue.id === null) return;
    setAbonnementEnCours(true);
    try {
      if (abonneSujet) {
        await supabase.from("abonnements_sujets").delete().eq("utilisateur", session.user.id).eq("sujet_id", vue.id);
        setAbonneSujet(false);
      } else {
        await supabase.from("abonnements_sujets").insert({ utilisateur: session.user.id, sujet_id: vue.id });
        setAbonneSujet(true);
      }
    } finally {
      setAbonnementEnCours(false);
    }
  };

  useEffect(() => {
    finFil.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ----- Forum -----
  const envoyer = async () => {
    const contenu = saisie.trim();
    if (!contenu || !session?.user || vue.type !== "sujet") return;
    setSaisie("");
    const { error } = await supabase.from("messages").insert({
      auteur: session.user.id, contenu, sujet_id: vue.id, cite_message_id: citeCible?.id ?? null,
    });
    if (error) setErreur("Message refusé : " + error.message);
    else setCiteCible(null);
  };

  const creerSujet = async () => {
    const titre = nouveauTitre.trim();
    const contenu = nouveauContenu.trim();
    if (!session?.user) return;
    if (titre.length < 3) { setErreur("Titre du sujet : 3 caractères minimum."); return; }
    if (!contenu) { setErreur("Écris le premier message du sujet."); return; }
    const { data, error } = await supabase.from("sujets").insert({ auteur: session.user.id, titre }).select("id, titre").single();
    if (error) { setErreur("Création impossible : " + error.message); return; }
    await supabase.from("messages").insert({ auteur: session.user.id, contenu, sujet_id: data.id });
    setNouveauTitre(""); setNouveauContenu(""); setCreationOuverte(false);
    setVue({ type: "sujet", id: data.id, titre: data.titre, auteur: session.user.id });
    chargerListe();
  };

  const AuteurAile = ({ id, taille = 32 }) => {
    const p = profilsParId[id];
    if (!p) return <span style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)" }}>Éleveur</span>;
    return (
      <span
        title={p.description || undefined}
        onClick={(e) => { e.stopPropagation(); setProfilPublicId(id); }}
        style={{ cursor: "pointer" }}
      >
        <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={p.niveau_ailes} taille={taille} />
      </span>
    );
  };

  if (!supabaseEstConfigure() || !supabase) {
    return (
      <div className="panel-card">
        <h2 style={{ marginTop: 0 }}>🍻 La Taverne</h2>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          La Taverne n'est pas encore ouverte : renseigne l'URL Supabase dans
          <code style={{ color: "var(--gold2)" }}> src/configSupabase.js</code> et exécute
          <code style={{ color: "var(--gold2)" }}> supabase-setup.sql</code>.
        </div>
      </div>
    );
  }

  const lignesSujets = [
    { id: null, titre: "🍺 Comptoir général", auteur: null, epingle: true },
    ...sujets,
  ].map((s) => {
    const stat = statsSujets[s.id ?? "general"] || { nb: 0, dernier: null };
    const cle = s.id ?? "general";
    const nonLu = !!(session?.user && s.auteur === session.user.id && stat.dernier
      && (!luSujets[cle] || new Date(stat.dernier) > new Date(luSujets[cle])));
    return { ...s, ...stat, nonLu };
  }).sort((a, b) => (a.epingle ? -1 : b.epingle ? 1 : new Date(b.dernier || b.cree_le || 0) - new Date(a.dernier || a.cree_le || 0)));
  const mesSujetsNonLus = lignesSujets.filter((s) => s.nonLu).length;

  return (
    <div>
      {/* ---------- En-tête Taverne + invite de connexion ---------- */}
      <div className="panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>🍻 La Taverne des éleveurs</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => { setClassementOuvert(true); chargerClassement(); }}>🏆 Classement</button>
            {session && (
              <button className="btn btn-ghost" style={{ position: "relative" }} onClick={() => { setBoiteOuverte(true); chargerConversations(); }}>
                📬 Messages privés
                {nonLuTotal > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -6, background: "var(--red)", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>{nonLuTotal}</span>
                )}
              </button>
            )}
            {session && pushSupporte() && (
              <button
                className="btn btn-ghost"
                disabled={pushEnCours}
                title={pushActif ? "Désactiver les notifications de nouveaux messages" : "Être notifié des nouveaux messages privés même hors de l'onglet"}
                onClick={basculerNotificationsPush}
              >
                {pushActif ? "🔕 Désactiver les notifs" : "🔔 Activer les notifs"}
              </button>
            )}
            {session
              ? <span style={{ color: "var(--muted)", fontSize: 12 }}>Connecté · gère ton profil via le bouton 👤 en haut à droite</span>
              : <button className="btn btn-coral" onClick={onOuvrirProfil}>Se connecter pour participer</button>}
          </div>
        </div>
        {pushErreur && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{pushErreur}</div>}
        {!session && (
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
            La lecture est libre. Pour créer un sujet ou répondre, connecte-toi ou crée ton compte
            d'éleveur depuis le bouton <b>👤 Profil</b> en haut à droite.
          </div>
        )}
      </div>

      {/* ---------- Forum : liste des sujets ---------- */}
      {vue.type === "liste" && (
        <div className="panel-card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b>Sujets de discussion</b>
              {mesSujetsNonLus > 0 && (
                <span style={{ background: "var(--red)", color: "#fff", borderRadius: 10, fontSize: 11, padding: "2px 7px", fontWeight: 700 }} title="Nouvelles réponses à tes sujets">
                  🔔 {mesSujetsNonLus}
                </span>
              )}
            </div>
            {session && (
              <button className="btn btn-coral" onClick={() => setCreationOuverte((o) => !o)}>➕ Nouveau sujet</button>
            )}
          </div>

          {creationOuverte && session && (
            <div style={{ marginTop: 12, padding: 12, border: "1px dashed var(--line)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="field" placeholder="Titre du sujet (3-80 caractères)" maxLength={80} value={nouveauTitre} onChange={(e) => setNouveauTitre(e.target.value)} />
              <textarea className="field" placeholder="Premier message…" rows={3} maxLength={2000} value={nouveauContenu} onChange={(e) => setNouveauContenu(e.target.value)} style={{ resize: "vertical" }} />
              <div><button className="btn btn-coral" onClick={creerSujet}>Créer le sujet</button></div>
              {erreur && <div style={{ color: "var(--red)", fontSize: 12 }}>{erreur}</div>}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            {lignesSujets.map((s) => (
              <div
                key={s.id ?? "general"}
                className="row-item"
                onClick={() => setVue({ type: "sujet", id: s.id, titre: s.titre, auteur: s.auteur })}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 10px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", borderRadius: 8, flexWrap: "wrap" }}
              >
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    {s.titre}
                    {s.nonLu && <span style={{ background: "var(--red)", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>nouveau</span>}
                  </div>
                  {s.auteur && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      ouvert par <AuteurAile id={s.auteur} taille={26} />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "baseline", color: "var(--muted)", fontSize: 12 }}>
                  <span><b style={{ color: "var(--text)" }}>{s.nb}</b> message(s)</span>
                  <span>{s.dernier ? new Date(s.dernier).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                  <span style={{ color: "var(--gold2)" }}>›</span>
                </div>
              </div>
            ))}
          </div>
          {!session && (
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
              La lecture est libre — connecte-toi pour créer un sujet ou répondre.
            </div>
          )}
        </div>
      )}

      {/* ---------- Forum : fil d'un sujet ---------- */}
      {vue.type === "sujet" && (
        <div className="panel-card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => { setVue({ type: "liste" }); chargerListe(); }}>← Sujets</button>
            <h2 style={{ margin: 0, fontSize: 17 }}>{vue.titre}</h2>
            {vue.id !== null && session?.user?.id === vue.auteur && (
              <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12, color: "var(--red)", marginLeft: "auto" }} onClick={() => supprimerSujet(vue.id)}>
                <Trash2 size={13} /> Supprimer le sujet
              </button>
            )}
          </div>
          {vue.id !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
              <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => { finFil.current?.scrollIntoView({ behavior: "smooth" }); saisieRef.current?.focus(); }}>↓ Répondre</button>
              {session && (
                <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} disabled={abonnementEnCours} onClick={basculerAbonnementSujet}>
                  {abonneSujet ? "🔕 Se désabonner" : "🔔 S'abonner"}
                </button>
              )}
              {session && !abonneSujet && !pushActif && (
                <span style={{ color: "var(--muted)", fontSize: 11 }}>Active les notifications push (en haut) pour recevoir les réponses.</span>
              )}
            </div>
          )}
          <div style={{ maxHeight: 460, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 6 }}>
            {messages.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                Personne n'a encore parlé ici… lance la discussion ! 🍺
              </div>
            )}
            {messages.map((m) => {
              const citee = m.cite_message_id ? messages.find((x) => x.id === m.cite_message_id) : null;
              return (
                <div key={m.id} className="message-row" style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, flex: "0 0 auto", minWidth: 150 }}>
                    <AuteurAile id={m.auteur} taille={44} />
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>
                      {new Date(m.cree_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    {citee && (
                      <div style={{ borderLeft: "2px solid var(--gold)", background: "rgba(0,0,0,.15)", borderRadius: 8, padding: "6px 10px", marginBottom: 6, fontSize: 12, color: "var(--muted)" }}>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>
                          {profilsParId[citee.auteur]?.pseudo || "Éleveur"} a écrit :
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>{citee.contenu.slice(0, 200)}</div>
                      </div>
                    )}
                    <div style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{linkifierTexte(m.contenu)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
                    {session && (
                      <button className="btn btn-ghost" title="Citer ce message" style={{ padding: "3px 6px", fontSize: 11 }} onClick={() => { setCiteCible(m); saisieRef.current?.focus(); }}>
                        Citer
                      </button>
                    )}
                    {(session?.user?.id === m.auteur || compte.estModo) && (
                      <button
                        className="btn btn-ghost"
                        title={session?.user?.id === m.auteur ? "Supprimer ce message" : "Supprimer ce message (modération)"}
                        style={{ padding: "3px 6px", fontSize: 11, color: "var(--red)" }}
                        onClick={() => supprimerMessage(m.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={finFil} />
          </div>
          {citeCible && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, padding: "6px 10px", background: "rgba(0,0,0,.15)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--muted)" }}>
              <span>en réponse à <b>{profilsParId[citeCible.auteur]?.pseudo || "Éleveur"}</b> : {citeCible.contenu.slice(0, 80)}</span>
              <button className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 11 }} onClick={() => setCiteCible(null)}>✕</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              ref={saisieRef}
              className="field"
              placeholder={session ? "Ta réponse… (2000 caractères max)" : "Connecte-toi pour répondre"}
              maxLength={2000}
              disabled={!session}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && envoyer()}
            />
            <button className="btn btn-coral" disabled={!session || !saisie.trim()} onClick={envoyer}>Répondre</button>
          </div>
          {erreur && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{erreur}</div>}
        </div>
      )}

      {classementOuvert && (
        <ClassementModal
          classement={classement}
          onOuvrirProfil={(id) => { setClassementOuvert(false); setProfilPublicId(id); }}
          onClose={() => setClassementOuvert(false)}
        />
      )}

      {profilPublicId && profilsParId[profilPublicId] && (
        <ProfilPublicModal
          profil={profilsParId[profilPublicId]}
          estMoi={session?.user?.id === profilPublicId}
          peutEnvoyerMp={!!session?.user}
          estModo={compte.estModo}
          onClose={() => setProfilPublicId(null)}
          onMessagePrive={() => ouvrirConversation(profilPublicId)}
        />
      )}

      {boiteOuverte && (
        <BoiteReceptionModal
          conversations={conversations}
          profilsParId={profilsParId}
          onOuvrir={ouvrirConversation}
          onClose={() => setBoiteOuverte(false)}
        />
      )}

      {dmCible && session?.user && (
        <MessagesPrivesModal
          session={session}
          messages={messagesPrives}
          profilCible={profilsParId[dmCible]}
          saisie={saisieDm}
          setSaisie={setSaisieDm}
          onEnvoyer={envoyerMessagePrive}
          onClose={() => setDmCible(null)}
          onOuvrirProfil={() => setProfilPublicId(dmCible)}
        />
      )}
    </div>
  );
}

function ProfilPublicModal({ profil, estMoi, peutEnvoyerMp, onClose, onMessagePrive, estModo }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(360px, 100%)", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <PseudoAvecAiles pseudo={profil.pseudo} soutien={profil.niveau_ailes > 0} styleAiles={profil.style_ailes} niveau={profil.niveau_ailes} taille={64} />
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕</button>
        </div>
        {profil.description && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>{profil.description}</div>}
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
          Membre depuis le {profil.cree_le ? new Date(profil.cree_le).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
        </div>
        {!estMoi && peutEnvoyerMp && (
          <button className="btn btn-coral" style={{ marginTop: 16 }} onClick={onMessagePrive}>✉️ Envoyer un message privé</button>
        )}
        {!estMoi && !peutEnvoyerMp && (
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 14 }}>Connecte-toi pour envoyer un message privé.</div>
        )}
        {estModo && <FicheAdminSection profilId={profil.id} />}
      </div>
    </div>
  );
}

// Section visible uniquement des modérateurs (profils.est_modo, voir SQL v27)
// dans la fiche d'un éleveur : dernière connexion, dons cumulés, cheptel
// (compteurs + détail brut dépliable), derniers messages Taverne. Volontairement
// PAS les messages privés échangés avec d'autres utilisateurs (décision
// explicite, voir CLAUDE.md / conversation d'implémentation).
function FicheAdminSection({ profilId }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [vueComplete, setVueComplete] = useState(false);
  const [messagesOuvert, setMessagesOuvert] = useState(false);

  useEffect(() => {
    let annule = false;
    setChargement(true); setErreur(""); setDonnees(null);
    supabase.rpc("admin_fiche_utilisateur", { cible: profilId }).then(({ data, error }) => {
      if (annule) return;
      if (error) setErreur(error.message);
      else setDonnees(data);
      setChargement(false);
    });
    return () => { annule = true; };
  }, [profilId]);

  if (chargement) return <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>Chargement (modération)…</div>;
  if (erreur) return <div style={{ marginTop: 16, fontSize: 12, color: "var(--red)" }}>Modération : {erreur}</div>;
  if (!donnees) return null;

  const cheptel = donnees.cheptel || {};
  const messages = donnees.messages_recents || [];

  return (
    <div style={{ marginTop: 16, borderTop: "1px dashed var(--line)", paddingTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold2)", marginBottom: 8, letterSpacing: 0.4 }}>🛡️ MODÉRATION</div>
      <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 4 }}>
        <div>Dernière connexion : {donnees.derniere_connexion ? new Date(donnees.derniere_connexion).toLocaleString("fr-FR") : "inconnue"}</div>
        <div>Dons cumulés : {donnees.dons_cumules_euros ?? 0} €</div>
        <div>Serveur : {donnees.profil?.serveur || "—"}</div>
        <div>Cheptel : {(cheptel.muldos || []).length} muldos · {(cheptel.dragodindes || []).length} dragodindes · {(cheptel.volkornes || []).length} volkornes</div>
      </div>
      <button type="button" className="btn btn-coral" style={{ marginTop: 10, fontSize: 12, padding: "6px 12px" }} onClick={() => setVueComplete(true)}>
        🖥️ Voir son compte en entier (cheptel + GPS)
      </button>
      <button type="button" className="btn btn-ghost" style={{ marginTop: 8, marginLeft: 8, fontSize: 11, padding: "4px 8px" }} onClick={() => setMessagesOuvert((o) => !o)}>
        {messagesOuvert ? "▾" : "▸"} Messages Taverne récents ({messages.length})
      </button>
      {messagesOuvert && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflow: "auto" }}>
          {messages.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>Aucun message.</div>}
          {messages.map((m) => (
            <div key={m.id} style={{ fontSize: 11, color: "var(--muted)", borderBottom: "1px solid rgba(255,255,255,.05)", paddingBottom: 4 }}>
              <span style={{ color: "var(--text)" }}>{m.contenu}</span>
              <div>{new Date(m.cree_le).toLocaleString("fr-FR")}</div>
            </div>
          ))}
        </div>
      )}
      {vueComplete && <VueCompteModeration donnees={donnees} onFermer={() => setVueComplete(false)} />}
    </div>
  );
}

// Mirroir en lecture seule du "dashboard" d'un éleveur, ouvert depuis
// FicheAdminSection : réutilise volontairement les mêmes composants de carte
// que le vrai Cheptel (CheptelCards/DragodindeCheptelCards/VolkorneCheptelCards
// — purement présentationnels, pas de mutation possible via ces props) pour
// que l'affichage soit visuellement identique à ce que l'éleveur voit
// lui-même. Le panneau de détail ci-dessous est en revanche réécrit à part
// (pas MuldoDetail/DragodindeDetail/VolkorneDetail) : ceux-là sont câblés à
// onPatch/onDelete pour l'édition réelle, on ne veut ici aucun risque
// d'écriture accidentelle sur le compte d'un tiers.
function VueCompteModeration({ donnees, onFermer }) {
  const cheptel = donnees.cheptel || {};
  const gps = donnees.gps || {};
  const CREATURES = [
    { cle: "muldo", label: "Muldo", icone: "🐴", items: cheptel.muldos || [], gps: gps.muldo, Cartes: CheptelCards },
    { cle: "dragodinde", label: "Dragodinde", icone: "🐲", items: cheptel.dragodindes || [], gps: gps.dragodinde, Cartes: DragodindeCheptelCards },
    { cle: "volkorne", label: "Volkorne", icone: "🐎", items: cheptel.volkornes || [], gps: gps.volkorne, Cartes: VolkorneCheptelCards },
  ];
  const [creatureActive, setCreatureActive] = useState("muldo");
  const [selectedId, setSelectedId] = useState(null);
  const actif = CREATURES.find((c) => c.cle === creatureActive);
  const selected = actif.items.find((m) => m.id === selectedId) || null;
  const CartesCreature = actif.Cartes;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--bg, #0c0a08)", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ padding: "20px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>🛡️ Vue modération — {donnees.profil?.pseudo}</h2>
          <button className="btn btn-ghost" onClick={onFermer}>✕ Fermer</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Lecture seule — rien ici ne modifie le compte de {donnees.profil?.pseudo}.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {CREATURES.map((c) => (
            <button
              key={c.cle}
              type="button"
              className="btn btn-ghost"
              style={creatureActive === c.cle ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined}
              onClick={() => { setCreatureActive(c.cle); setSelectedId(null); }}
            >
              {c.icone} {c.label} ({c.items.length})
            </button>
          ))}
        </div>
        {actif.gps && (
          <div className="panel-card" style={{ marginBottom: 16 }}>
            <b style={{ color: "var(--gold2)" }}>🧭 Réglages GPS</b>
            <div style={{ fontSize: 13, marginTop: 8, display: "flex", gap: 18, flexWrap: "wrap", color: "var(--muted)" }}>
              <span>Couleur cible : <b style={{ color: "var(--text)" }}>{actif.gps.objectifCouleur || "—"}</b></span>
              {actif.gps.modeGps && <span>Mode : <b style={{ color: "var(--text)" }}>{actif.gps.modeGps}</b></span>}
              {actif.gps.generationGps != null && <span>Génération cible : <b style={{ color: "var(--text)" }}>{actif.gps.generationGps}</b></span>}
              {actif.gps.optimakina !== undefined && <span>Optimakina : <b style={{ color: "var(--text)" }}>{actif.gps.optimakina ? "oui" : "non"}</b></span>}
              {actif.gps.niveauMinimumSession != null && <span>Niveau min. : <b style={{ color: "var(--text)" }}>{actif.gps.niveauMinimumSession}</b></span>}
              {actif.gps.modePurification && <span>Purification : <b style={{ color: "var(--text)" }}>{actif.gps.modePurification}</b></span>}
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="panel-card" style={{ maxHeight: 560, overflow: "auto" }}>
            <b style={{ color: "var(--gold2)" }}>Cheptel ({actif.items.length})</b>
            <div style={{ marginTop: 10 }}>
              <CartesCreature items={actif.items} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
          <div className="panel-card">
            <b style={{ color: "var(--gold2)" }}>Fiche</b>
            {!selected && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>Clique un animal pour voir sa fiche.</div>}
            {selected && (
              <div style={{ fontSize: 13, marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div><b>{selected.nom || "(sans nom)"}</b></div>
                <div>Couleur : {selected.couleur}</div>
                <div>Génération : {selected.generation ?? "—"}</div>
                <div>Sexe : {selected.sexe}</div>
                <div>Statut : {selected.statut}{selected.sterile ? " (stérile)" : ""}</div>
                <div>Capacités : {(selected.capacites || []).filter(Boolean).join(", ") || "aucune"}</div>
                <div>Ajouté le : {selected.dateAjout ? new Date(selected.dateAjout).toLocaleDateString("fr-FR") : "—"}</div>
                {selected.notes && <div>Notes : {selected.notes}</div>}
                {(selected.parentIds || []).some(Boolean) && (
                  <div>
                    Parents : {(selected.parentIds || []).map((pid) => {
                      if (!pid) return "inconnu";
                      const parent = actif.items.find((x) => x.id === pid);
                      return parent ? (parent.nom || parent.couleur) : "hors cheptel";
                    }).join(" × ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Page réservée aux comptes est_modo (menu latéral filtré côté AppSidebar,
// bloqué une seconde fois ici — voir le point d'appel dans AppConnecte) :
// qui est en ligne (Presence Realtime, canal "presence-eleveurs" alimenté par
// tous les comptes connectés, voir l'effet dans AppConnecte) + recherche d'un
// éleveur par pseudo, ouvrant sa fiche détaillée (FicheAdminSection via
// ProfilPublicModal, cf. admin_fiche_utilisateur SQL v27).
function ModerationPage({ compte, enLigne }) {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState([]);
  const [chargement, setChargement] = useState(false);
  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 2) { setResultats([]); setChargement(false); return undefined; }
    let annule = false;
    setChargement(true);
    const t = setTimeout(() => {
      supabase.from("profils").select("id, pseudo, style_ailes, niveau_ailes, description, cree_le, serveur")
        .ilike("pseudo", `%${q}%`).limit(20)
        .then(({ data }) => { if (!annule) { setResultats(data || []); setChargement(false); } });
    }, 300);
    return () => { annule = true; clearTimeout(t); };
  }, [recherche]);

  const [profilCible, setProfilCible] = useState(null);

  // Liste complète des membres (paginée) + compteur d'essais "mode invité"
  // (table essais_invite, v32) pour estimer le taux de conversion essai ->
  // vrai compte. totalMembres sert aux deux (nombre total de comptes créés).
  const TAILLE_PAGE_MEMBRES = 30;
  const [pageMembres, setPageMembres] = useState(0);
  const [membres, setMembres] = useState(null);
  const [totalMembres, setTotalMembres] = useState(null);
  useEffect(() => {
    let annule = false;
    const debut = pageMembres * TAILLE_PAGE_MEMBRES;
    supabase.from("profils").select("id, pseudo, style_ailes, niveau_ailes, serveur, cree_le", { count: "exact" })
      .order("cree_le", { ascending: false }).range(debut, debut + TAILLE_PAGE_MEMBRES - 1)
      .then(({ data, count }) => { if (!annule) { setMembres(data || []); setTotalMembres(count ?? null); } });
    return () => { annule = true; };
  }, [pageMembres]);
  const [essaisInvite, setEssaisInvite] = useState(null);
  useEffect(() => {
    supabase.from("essais_invite").select("id", { count: "exact", head: true })
      .then(({ count }) => setEssaisInvite(count ?? 0));
  }, []);

  // Signalements de bugs (table signalements_bugs, v31) : lecture reservee
  // aux moderateurs par RLS, donc aucun risque a tout charger d'un coup (pas
  // de pagination pour un volume qui reste faible en pratique).
  const [bugs, setBugs] = useState(null);
  const [bugsAuteurs, setBugsAuteurs] = useState({});
  const chargerBugs = React.useCallback(() => {
    supabase.from("signalements_bugs").select("id, auteur, contenu, page, cree_le, traite").order("cree_le", { ascending: false }).limit(100)
      .then(({ data }) => {
        setBugs(data || []);
        const ids = [...new Set((data || []).map((b) => b.auteur).filter(Boolean))];
        if (ids.length) {
          supabase.from("profils").select("id, pseudo").in("id", ids)
            .then(({ data: profs }) => setBugsAuteurs(Object.fromEntries((profs || []).map((p) => [p.id, p.pseudo]))));
        }
      });
  }, []);
  useEffect(() => { chargerBugs(); }, [chargerBugs]);
  const marquerBugTraite = async (id, traite) => {
    setBugs((prev) => prev.map((b) => (b.id === id ? { ...b, traite } : b)));
    await supabase.from("signalements_bugs").update({ traite }).eq("id", id);
  };
  const bugsNonTraites = (bugs || []).filter((b) => !b.traite);

  return (
    <>
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>🐛 Signalements de bugs ({bugsNonTraites.length} non traités)</h3>
        {bugs === null && <div style={{ color: "var(--muted)", fontSize: 13 }}>Chargement…</div>}
        {bugs !== null && bugs.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Aucun signalement pour l'instant.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {bugs?.map((b) => (
            <div key={b.id} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--line)", opacity: b.traite ? 0.55 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  <b style={{ color: "var(--text)" }}>{bugsAuteurs[b.auteur] || "Éleveur"}</b> · {b.page || "?"} · {new Date(b.cree_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => marquerBugTraite(b.id, !b.traite)}>
                  {b.traite ? "Rouvrir" : "✓ Marquer traité"}
                </button>
              </div>
              <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{b.contenu}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>🟢 En ligne maintenant ({enLigne.length})</h3>
        {enLigne.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Personne pour l'instant.</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {enLigne.map((p, i) => (
            <div
              key={i}
              style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", cursor: p.id ? "pointer" : "default" }}
              onClick={() => p.id && setProfilCible({ id: p.id, pseudo: p.pseudo, style_ailes: p.styleAiles, niveau_ailes: p.niveauAiles, description: "", cree_le: null, serveur: null })}
            >
              <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveauAiles > 0} styleAiles={p.styleAiles} niveau={p.niveauAiles} taille={32} />
            </div>
          ))}
        </div>
      </div>
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>🔍 Rechercher un éleveur</h3>
        <input className="field" placeholder="Pseudo (2 caractères min.)…" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
        {chargement && <div style={{ color: "var(--muted)", fontSize: 12 }}>Recherche…</div>}
        {resultats.map((p) => (
          <div
            key={p.id}
            className="row-item"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", cursor: "pointer", borderRadius: 8, borderBottom: "1px solid rgba(255,255,255,.05)" }}
            onClick={() => setProfilCible(p)}
          >
            <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={p.niveau_ailes} taille={36} />
            {p.serveur && <span style={{ fontSize: 11, color: "var(--muted)" }}>· {p.serveur}</span>}
          </div>
        ))}
      </div>
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>📊 Essai → compte</h3>
        {essaisInvite === null || totalMembres === null ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Chargement…</div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            <b style={{ color: "var(--text)" }}>{essaisInvite}</b> essai(s) sans compte ·{" "}
            <b style={{ color: "var(--text)" }}>{totalMembres}</b> compte(s) créé(s) au total
            {essaisInvite > 0 && (
              <> ·{" "}
                <b style={{ color: "var(--gold2)" }}>{Math.round((totalMembres / essaisInvite) * 100)}%</b> de conversion estimée
              </>
            )}
            <div style={{ fontSize: 11, marginTop: 4, opacity: .75 }}>
              Estimation approximative : certains comptes sont créés sans jamais passer par le mode essai.
            </div>
          </div>
        )}
      </div>
      <div className="panel-card">
        <h3 style={{ marginTop: 0 }}>👥 Tous les membres{totalMembres !== null ? ` (${totalMembres})` : ""}</h3>
        {membres === null && <div style={{ color: "var(--muted)", fontSize: 13 }}>Chargement…</div>}
        {membres && membres.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Aucun membre.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
          {membres?.map((p) => (
            <div
              key={p.id}
              className="row-item"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 8px", cursor: "pointer", borderRadius: 8, borderBottom: "1px solid rgba(255,255,255,.05)" }}
              onClick={() => setProfilCible(p)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={p.niveau_ailes} taille={26} />
                {p.serveur && <span style={{ fontSize: 11, color: "var(--muted)" }}>· {p.serveur}</span>}
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                {p.cree_le ? new Date(p.cree_le).toLocaleDateString("fr-FR") : ""}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} disabled={pageMembres === 0} onClick={() => setPageMembres((p) => Math.max(0, p - 1))}>
            ← Précédent
          </button>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Page {pageMembres + 1}{totalMembres !== null ? ` / ${Math.max(1, Math.ceil(totalMembres / TAILLE_PAGE_MEMBRES))}` : ""}
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: "5px 10px", fontSize: 12 }}
            disabled={totalMembres !== null && (pageMembres + 1) * TAILLE_PAGE_MEMBRES >= totalMembres}
            onClick={() => setPageMembres((p) => p + 1)}
          >
            Suivant →
          </button>
        </div>
      </div>
      {profilCible && (
        <ProfilPublicModal
          profil={profilCible}
          estMoi={profilCible.id === compte.session?.user?.id}
          peutEnvoyerMp={false}
          estModo
          onClose={() => setProfilCible(null)}
        />
      )}
    </>
  );
}

// Liste jusqu'à 3 sauvegardes manuelles (bouton "Sauvegarder" de l'en-tête) —
// liste=null pendant le chargement initial, [] si aucune sauvegarde encore.
function ChargerSauvegardeModal({ liste, onCharger, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: "40px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>📂 Sauvegardes manuelles</h3>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕ Fermer</button>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
          3 dernières sauvegardes prises avec le bouton « Sauvegarder ». Charger une sauvegarde
          remplace toutes les données actuelles du compte.
        </div>
        {liste === null && (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>Chargement…</div>
        )}
        {liste && liste.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
            Aucune sauvegarde manuelle pour l'instant — clique « Sauvegarder » dans l'en-tête pour en créer une.
          </div>
        )}
        {liste && liste.map((s) => (
          <div
            key={s.id}
            className="row-item"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,.05)", borderRadius: 8 }}
          >
            <span>{new Date(s.cree_le).toLocaleString("fr-FR")}</span>
            <button className="btn btn-coral" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onCharger(s.id)}>Charger</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassementModal({ classement, onOuvrirProfil, onClose }) {
  const MEDAILLES = ["🥇", "🥈", "🥉"];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: "40px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>🏆 Classement des éleveurs</h3>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕ Fermer</button>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
          Classé par générations muldo validées (page Succès), puis par couleurs découvertes —
          progression Dragodinde/Volkorne affichée à titre indicatif.
        </div>
        {classement.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>Personne au classement pour l'instant.</div>
        )}
        {classement.map((p, i) => {
          return (
            <div
              key={p.id}
              className="row-item"
              onClick={() => onOuvrirProfil(p.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", borderRadius: 8, flexWrap: "wrap" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ width: 26, textAlign: "center", fontWeight: 800, color: "var(--gold2)" }}>{MEDAILLES[i] || i + 1}</span>
                <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={p.niveau_ailes} taille={40} />
              </div>
              <div style={{ display: "flex", gap: 14, color: "var(--muted)", fontSize: 12, flex: "0 0 auto" }}>
                <span title="Muldo">🐴 G<b style={{ color: "var(--text)" }}>{p.succes_generation_muldo || 0}</b> · <b style={{ color: "var(--text)" }}>{p.couleurs_decouvertes_muldo || 0}</b></span>
                <span title="Dragodinde">🐲 G<b style={{ color: "var(--text)" }}>{p.succes_generation_dragodinde || 0}</b> · <b style={{ color: "var(--text)" }}>{p.couleurs_decouvertes_dragodinde || 0}</b></span>
                <span title="Volkorne">🐎 G<b style={{ color: "var(--text)" }}>{p.succes_generation_volkorne || 0}</b> · <b style={{ color: "var(--text)" }}>{p.couleurs_decouvertes_volkorne || 0}</b></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoiteReceptionModal({ conversations, profilsParId, onOuvrir, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: "40px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>📬 Messages privés</h3>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕ Fermer</button>
        </div>
        {conversations.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
            Aucune conversation pour l'instant — clique sur un pseudo pour en démarrer une.
          </div>
        )}
        {conversations.map((c) => {
          const p = profilsParId[c.id];
          const niveauEffectif = p?.niveau_ailes || 0;
          return (
            <div
              key={c.id}
              className="row-item"
              onClick={() => onOuvrir(c.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", borderRadius: 8 }}
            >
              <div style={{ minWidth: 0 }}>
                {p ? <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={niveauEffectif} taille={40} /> : "Éleveur"}
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.dernier.contenu}</div>
              </div>
              {c.nonLu > 0 && <span style={{ background: "var(--red)", color: "#fff", borderRadius: 10, fontSize: 11, padding: "2px 7px", fontWeight: 700, flex: "0 0 auto" }}>{c.nonLu}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessagesPrivesModal({ session, messages, profilCible, saisie, setSaisie, onEnvoyer, onClose, onOuvrirProfil }) {
  const finRef = React.useRef(null);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  const niveauEffectif = profilCible?.niveau_ailes || 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12, cursor: profilCible ? "pointer" : "default" }} onClick={() => profilCible && onOuvrirProfil()}>
            {profilCible ? <PseudoAvecAiles pseudo={profilCible.pseudo} soutien={profilCible.niveau_ailes > 0} styleAiles={profilCible.style_ailes} niveau={niveauEffectif} taille={48} /> : "Éleveur"}
          </button>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕ Fermer</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
          {messages.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>Aucun message échangé pour l'instant.</div>
          )}
          {messages.map((m) => {
            const moi = m.expediteur === session.user.id;
            return (
              <div key={m.id} className="message-row" style={{ alignSelf: moi ? "flex-end" : "flex-start", maxWidth: "80%", background: moi ? "rgba(214,166,74,.16)" : "rgba(255,255,255,.05)", border: `1px solid ${moi ? "var(--gold)" : "var(--line)"}`, borderRadius: 12, padding: "8px 10px" }}>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.contenu}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, textAlign: moi ? "right" : "left" }}>
                  {new Date(m.cree_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            );
          })}
          <div ref={finRef} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            className="field"
            placeholder="Ton message privé… (2000 caractères max)"
            maxLength={2000}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onEnvoyer()}
          />
          <button className="btn btn-coral" disabled={!saisie.trim()} onClick={onEnvoyer}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

// Suggestions de clonage : classe les duos de stériles (même génération)
// selon l'utilité des couleurs qu'ils peuvent redonner — proche de l'objectif
// GPS courant, et bonus fort si plus aucun fertile de cette couleur n'existe.
// ---------- Cosmétiques de soutien ----------
// Trois styles d'ailes au choix pour les soutiens du projet, chacun sur le
// thème d'une monture Dofus : "dragodinde" (plumes dorées), "muldo" (voiles
// bleu-turquoise), "volkorne" (griffes/flammes sombres) — les 3 débloquées
// uniquement par le palier de don, aucune condition de génération.
const NOMS_NIVEAUX_AILES = {
  dragodinde: ["Envol Naissant", "Grâce Ailée", "Majesté Solaire"],
  muldo: ["Sang Neuf", "Instinct du Troupeau", "Légende Vivante"],
  volkorne: ["Braise Naissante", "Fureur Cornue", "Apocalypse Vivante"],
};
// Nombre de paliers de don réellement vendus (voir MONTANTS_NIVEAUX). Les
// dessins/images d'ailes existent en interne sur une échelle 1-5 (voir
// VISUEL_PAR_NIVEAU) : ce palier officiel n'en affiche que 3 (l'entrée, le
// milieu, le sommet) pour ne pas multiplier les paliers vendus.
const NIVEAU_MAX_AILES = 3;
// Palier de don (1-3) -> "niveau visuel" (1-5) sur lequel sont calibrés les
// dessins SVG et les images public/ailes/{style}-{n}.png : on réutilise tels
// quels les visuels du 1er, 3e et 5e niveau plutôt que d'en redessiner 3
// nouveaux, donc les fichiers -2 et -4 restent sur disque mais ne sont plus
// jamais atteints.
const VISUEL_PAR_NIVEAU = [1, 3, 5];

// Teinte de la lueur (drop-shadow) autour des images PNG, par style.
const HALO_AILES = {
  dragodinde: "rgba(240,207,114,",
  muldo: "rgba(101,199,193,",
  volkorne: "rgba(232,120,50,",
};

function nomNiveauAiles(style, niveau) {
  const n = Math.max(1, Math.min(NIVEAU_MAX_AILES, Number(niveau) || 1));
  return (NOMS_NIVEAUX_AILES[style] || NOMS_NIVEAUX_AILES.muldo)[n - 1] || "";
}

// Une image personnalisée (public/ailes/dragodinde-3.png, volkorne-5.png…)
// remplace le SVG si elle existe ; sinon l'aile vectorielle graduée prend le
// relais.
function AileNiveau({ style = "muldo", miroir = false, taille = 22, niveau = 1 }) {
  const [imageKo, setImageKo] = useState(false);
  const n = VISUEL_PAR_NIVEAU[Math.max(1, Math.min(NIVEAU_MAX_AILES, Number(niveau) || 1)) - 1];
  if (!imageKo) {
    // Les images fournies sont des PAIRES complètes (aile gauche + droite) à
    // fond transparent : on les affiche telles quelles, sans miroir ni blend.
    return (
      <img
        src={`ailes/${style}-${n}.png`}
        alt=""
        onError={() => setImageKo(true)}
        style={{
          height: Math.round(taille * (1 + (n - 1) * 0.14)),
          width: "auto",
          verticalAlign: "middle",
          filter: `drop-shadow(0 0 ${3 + n}px ${(HALO_AILES[style] || HALO_AILES.muldo)}.4))`,
        }}
      />
    );
  }
  return <AileSvg style={style} miroir={miroir} taille={taille} niveau={n} />;
}

function DemiAile({ style = "muldo", cote = "gauche", taille = 20, niveau = 1 }) {
  const [etat, setEtat] = useState("dedie"); // dedie -> moitie -> svg
  const n = VISUEL_PAR_NIVEAU[Math.max(1, Math.min(NIVEAU_MAX_AILES, Number(niveau) || 1)) - 1];
  const base = `ailes/${style}-${n}`;
  const h = Math.round(taille * (1 + (n - 1) * 0.16));
  const ombre = `drop-shadow(0 0 ${2 + n}px ${(HALO_AILES[style] || HALO_AILES.muldo)}.4))`;

  if (etat === "dedie") {
    return (
      <img
        src={`${base}-${cote}.png`}
        alt=""
        onError={() => setEtat("moitie")}
        style={{ height: h, width: "auto", verticalAlign: "middle", filter: ombre, flexShrink: 0 }}
      />
    );
  }
  if (etat === "moitie") {
    return (
      <span style={{ display: "inline-block", width: h * 0.6, height: h, overflow: "hidden", verticalAlign: "middle", flexShrink: 0 }}>
        <img
          src={`${base}.png`}
          alt=""
          onError={() => setEtat("svg")}
          style={{
            height: h, width: "auto", objectFit: "cover",
            objectPosition: cote === "gauche" ? "left center" : "right center",
            marginLeft: cote === "gauche" ? 0 : `-${h * 0.6}px`,
            filter: ombre,
          }}
        />
      </span>
    );
  }
  return <AileSvg style={style} miroir={cote === "gauche"} taille={taille} niveau={n} />;
}

function AileSvg({ style = "muldo", miroir = false, taille = 22, niveau = 1 }) {
  const n = Math.max(1, Math.min(5, Number(niveau) || 1));
  const abysses = style === "abysses";
  const teinte = abysses ? "#3fb8b1" : "var(--gold2)";
  const teinte2 = abysses ? "#173a3f" : "var(--accent)";
  const teinte3 = abysses ? "#8ff3ec" : "#fff3d0";
  const halo = abysses ? "rgba(101,199,193," : "rgba(240,207,114,";
  const tailleEffective = Math.round(taille * (1 + (n - 1) * 0.14)); // grandit fort à chaque palier
  const lueur = 2 + n * 2;

  return (
    <svg
      width={tailleEffective} height={tailleEffective} viewBox="0 0 24 24"
      style={{
        transform: miroir ? "scaleX(-1)" : "none",
        verticalAlign: "middle", flexShrink: 0,
        filter: `drop-shadow(0 0 ${lueur}px ${halo}${(0.3 + n * 0.12).toFixed(2)}))`,
        animation: n >= 4 ? "aile-lueur 2.2s ease-in-out infinite" : "none",
      }}
    >
      {abysses ? (
        <>
          {/* Membrane principale, griffue */}
          <path d="M2 13 Q5 4 21 3 L18 6 L21 6.5 L16.5 9 L20 10 L14 12 L17 14 L12 14.5 Q10 17 11 21 L8.5 18.5 L8 21.5 L6 17.5 Q3.5 15.5 2 13 Z" fill={teinte2} stroke={teinte} strokeWidth=".6" />
          {/* Veines d'énergie (dès le niveau 2) */}
          {n >= 2 && <path d="M4 12 Q8 8 18 5 M6 14 Q9 11 15 9 M8 16 Q10 13 13 12" fill="none" stroke={teinte} strokeWidth=".55" opacity={0.4 + n * 0.12} />}
          {/* Ossature apparente (niveau 3) */}
          {n >= 3 && <path d="M3 12.5 Q6 6 20 3.5 M5 14.5 Q8 10.5 16.5 8" fill="none" stroke={teinte3} strokeWidth=".45" opacity=".7" />}
          {/* Pointes acérées supplémentaires (niveau 4) */}
          {n >= 4 && <path d="M21 3 L23 1.5 L21.5 4.5 Z M20 10 L22.5 9.5 L20.5 11.5 Z M17 14 L19.5 14.5 L17.2 15.8 Z" fill={teinte} opacity=".9" />}
          {/* Flammes abyssales du Seigneur (niveau 5) */}
          {n >= 5 && <path d="M3 10 Q2 7 4.5 5.5 Q4 8 6 8.5 Q5 10.5 3 10 Z M10 4 Q10.5 1.5 13 1 Q12 3.5 13.5 4.5 Q11.5 5.5 10 4 Z" fill={teinte} opacity=".55" />}
        </>
      ) : (
        <>
          {/* Plumes maîtresses */}
          <path d="M2 16 Q4 4 22 3 Q18 7 16 8 Q19 8 21 7 Q17 12 13 12 Q16 13 18 12.5 Q14 17 10 16.5 Q12 18 13.5 18 Q8 21 4 18.5 Q2.5 17.5 2 16 Z" fill={teinte} />
          <path d="M4 15.5 Q6 7 18 5 Q13 9 11 11.5 Q8.5 14.5 6.5 17 Q5 16.5 4 15.5 Z" fill={teinte2} opacity=".75" />
          {/* Plumes plus nombreuses (niveau 2) */}
          {n >= 2 && <path d="M3 14 Q6 6 19 4 Q13.5 8.5 11.5 11 Q9 14 7.5 16.5 Q5 15.8 3 14 Z" fill={teinte3} opacity={0.14 + n * 0.04} />}
          {/* Stratification dorée (niveau 3) */}
          {n >= 3 && <path d="M2 16 Q4 4 22 3 M4 17.5 Q7 9 19 6.5 M6 18.5 Q9 12.5 15 11" fill="none" stroke={teinte3} strokeWidth=".5" opacity=".75" />}
          {/* Auréole (niveau 4) */}
          {n >= 4 && <circle cx="12" cy="6.5" r="4.6" fill="none" stroke={teinte3} strokeWidth=".6" opacity=".85" />}
          {/* Apogée : double auréole, rayons et étoile (niveau 5) */}
          {n >= 5 && (
            <>
              <circle cx="12" cy="6.5" r="6.2" fill="none" stroke={teinte} strokeWidth=".45" opacity=".6" />
              <path d="M12 0.5 L12 2.5 M5.5 2 L6.8 3.6 M18.5 2 L17.2 3.6" stroke={teinte3} strokeWidth=".6" opacity=".9" />
              <circle cx="12" cy="6.5" r="1" fill={teinte3} />
            </>
          )}
        </>
      )}
    </svg>
  );
}

const ORNEMENT_AILES = { dragodinde: "✦", muldo: "❖", volkorne: "🔥" };
const DEGRADE_AILES = {
  dragodinde: "linear-gradient(92deg, #fff3d0 10%, var(--gold2) 55%, var(--gold) 95%)",
  muldo: "linear-gradient(92deg, #bfeeea 10%, var(--cyan) 55%, #2e7f7a 95%)",
  volkorne: "linear-gradient(92deg, #ffcf9e 10%, #e87832 55%, #7a2e10 95%)",
};

function PseudoAvecAiles({ pseudo, soutien, styleAiles = "muldo", taille = 20, niveau = 1 }) {
  if (!pseudo) return null;
  if (!soutien) {
    return <span style={{ fontWeight: 700, fontSize: 14 }}>{pseudo}</span>;
  }
  const n = Math.max(1, Math.min(NIVEAU_MAX_AILES, Number(niveau) || 1));
  const visuel = VISUEL_PAR_NIVEAU[n - 1];
  const base = ORNEMENT_AILES[styleAiles] || ORNEMENT_AILES.muldo;
  const ornement = visuel >= 5 ? `✧${base}✧` : visuel >= 3 ? `${base}${base}` : base;
  const degrade = DEGRADE_AILES[styleAiles] || DEGRADE_AILES.muldo;
  return (
    <span style={{ display: "inline-flex", flexWrap: "nowrap", alignItems: "center", gap: 4, maxWidth: "100%" }} title={`Soutien du Registre — ${nomNiveauAiles(styleAiles, n)} (niveau ${n})`}>
      {/* key forcé sur les 3 éléments : DemiAile a son propre état interne de
          repli image (dédiée → moitié → SVG) qui ne se réinitialise jamais
          tout seul si `style` change, et le dégradé (background-clip: text)
          d'un span réutilisé par React ne se repeint pas toujours dans
          Chromium — le rendu reste figé sur l'ancien style tant que les
          nœuds ne sont pas recréés (d'où le "reste bloqué jusqu'au F5").
          flexShrink:0 sur les ailes + whiteSpace:nowrap sur le texte : dans
          un conteneur étroit (bouton de l'en-tête), sans ça le flex row peut
          se faire écraser/reflow verticalement une fois les ailes agrandies. */}
      <DemiAile key={`gauche-${styleAiles}`} style={styleAiles} cote="gauche" taille={taille} niveau={n} />
      <span
        key={`${styleAiles}-${n}`}
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: .4,
          whiteSpace: "nowrap",
          background: degrade,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {ornement} {pseudo} {ornement}
      </span>
      <DemiAile key={`droite-${styleAiles}`} style={styleAiles} cote="droite" taille={taille} niveau={n} />
    </span>
  );
}

// Barème sur 3 paliers : 5, 12 et 20 € — doit rester synchronisé avec la
// copie MONTANTS_NIVEAUX_EUROS dans supabase/functions/stripe-webhook et
// supabase/functions/creer-session-don (Deno ne peut pas importer ce fichier).
const MONTANTS_NIVEAUX = [5, 12, 20];
function montantPourNiveau(niveau) {
  const n = Math.max(1, Math.min(NIVEAU_MAX_AILES, Number(niveau) || 1));
  return MONTANTS_NIVEAUX[n - 1];
}

function SoutienPanel({ profil, setProfil }) {
  const set = (patch) => setProfil({ ...profil, ...patch });
  const niveau = Math.max(1, Math.min(NIVEAU_MAX_AILES, Number(profil.niveauAiles) || 1));
  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Soutien du projet</h2>
        {profil.soutien && <PseudoAvecAiles pseudo={profil.pseudo || "Éleveur"} soutien styleAiles={profil.styleAiles} niveau={niveau} taille={32} />}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
        Le Registre restera utilisable gratuitement. Les soutiens gagnent leurs ailes selon leur don, en
        trois paliers de 5 à 20 € — trois styles au choix : Dragodinde, Muldo et Volkorne.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Pseudo d'éleveur</div>
          <input
            className="field"
            placeholder="Ton pseudo…"
            maxLength={10}
            value={profil.pseudo || ""}
            onChange={(e) => set({ pseudo: e.target.value })}
            style={{ width: 200 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Style d'ailes</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { style: "dragodinde", label: "Dragodinde" },
              { style: "muldo", label: "Muldo" },
              { style: "volkorne", label: "Volkorne" },
            ].map(({ style, label }) => (
              <button
                key={style}
                type="button"
                className="btn btn-ghost"
                style={profil.styleAiles === style ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined}
                onClick={() => set({ styleAiles: style })}
              >
                <AileSvg style={style} taille={32} /> {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            Palier <b style={{ color: "var(--gold2)" }}>{niveau}</b> · {nomNiveauAiles(profil.styleAiles, niveau)} · {montantPourNiveau(niveau)} €
          </div>
          <input
            type="range"
            min={1}
            max={NIVEAU_MAX_AILES}
            value={niveau}
            onChange={(e) => set({ niveauAiles: Number(e.target.value) })}
            style={{ width: 180, accentColor: "#d6a64a" }}
          />
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, paddingBottom: 9 }} title="Interrupteur local d'aperçu — à remplacer par la validation du paiement (Stripe) en version en ligne">
          <input
            type="checkbox"
            checked={!!profil.soutien}
            onChange={(e) => set({ soutien: e.target.checked })}
          />
          Statut soutien (aperçu local)
        </label>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14, padding: "10px 12px", border: "1px dashed var(--line)", borderRadius: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <AileNiveau style="dragodinde" taille={90} niveau={niveau} />
          <span className="chiffre-hero" style={{ color: "var(--gold2)", fontSize: 13 }}>{nomNiveauAiles("dragodinde", niveau)}</span>
        </div>
        <PseudoAvecAiles pseudo={profil.pseudo || "Éleveur"} soutien styleAiles={profil.styleAiles} niveau={niveau} taille={40} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <AileNiveau style="muldo" taille={90} niveau={niveau} />
          <span className="chiffre-hero" style={{ color: "var(--cyan)", fontSize: 13 }}>{nomNiveauAiles("muldo", niveau)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <AileNiveau style="volkorne" taille={90} niveau={niveau} />
          <span className="chiffre-hero" style={{ color: "#e87832", fontSize: 13 }}>{nomNiveauAiles("volkorne", niveau)}</span>
        </div>
        <span style={{ color: "var(--muted)", fontSize: 11, alignSelf: "center" }}>
          Dépose tes visuels dans public/ailes/ (dragodinde-1.png … volkorne-5.png) pour remplacer les dessins.
        </span>
      </div>
    </div>
  );
}

// Liste canonique de tout ce qui vit dans la sauvegarde du compte (le blob
// jsonb de la table sauvegardes_elevage) — sert à la fois à l'export/import
// manuel (SauvegardePanel) et à la détection de données locales héritées
// d'avant cette migration (voir detecterDonneesLocalesHeritees). Exclut
// volontairement STORAGE_THEME et STORAGE_ONBOARDING_SITE : préférences de
// navigateur, pas de compte — elles doivent fonctionner même sans connexion
// (voir PortailConnexion) et restent donc en localStorage brut.
const CLES_SAUVEGARDE = [
  STORAGE_KEY,
  STORAGE_HISTORY_KEY,
  STORAGE_SYNC_KEY,
  STORAGE_GPS_SESSION,
  STORAGE_GPS_PARAMS,
  STORAGE_NAISSANCES,
  STORAGE_PRIX_KAMAS,
  STORAGE_JOURNAL,
  STORAGE_INSTANTANES,
  STORAGE_PROFIL,
  STORAGE_CORBEILLE,
  STORAGE_PRIX_KAMAS_DRAGODINDE,
  STORAGE_PRIX_KAMAS_VOLKORNE,
  STORAGE_SERVEUR,
  STORAGE_ONBOARDING_GPS,
  STORAGE_PARCOURS_GUIDE,
  STORAGE_LU_SUJETS,
  ...CLES_SAUVEGARDE_DRAGODINDE,
  ...CLES_SAUVEGARDE_VOLKORNE,
  ...CLES_SAUVEGARDE_MANGEOIRE,
];

// Détecte, à la première connexion d'un compte dont la sauvegarde est encore
// vide, des données laissées par une session d'avant cette migration
// (localStorage brut, jamais lié à un compte) — pour proposer un import
// explicite plutôt que de les laisser inaccessibles. Ne modifie rien :
// lecture seule, retourne un résumé de comptage ou null si rien à migrer.
function detecterDonneesLocalesHeritees() {
  let trouve = false;
  const donnees = {};
  CLES_SAUVEGARDE.forEach((cle) => {
    const brut = localStorage.getItem(cle);
    if (brut === null) return;
    trouve = true;
    try { donnees[cle] = JSON.parse(brut); } catch { donnees[cle] = brut; }
  });
  if (!trouve) return null;
  const compter = (cle) => (Array.isArray(donnees[cle]) ? donnees[cle].length : 0);
  return {
    donnees,
    resume: {
      muldos: compter(STORAGE_KEY),
      dragodindes: compter(STORAGE_KEY_DRAGODINDE),
      volkornes: compter(STORAGE_KEY_VOLKORNE),
    },
  };
}

function SauvegardePanel({ showToast, estInvite }) {
  const exporter = async () => {
    await flushToutesEcrituresDebattues();
    const donnees = obtenirCacheComplet();
    const contenu = JSON.stringify({ format: "muldo-manager", version: 2, date: new Date().toISOString(), donnees }, null, 2);
    const blob = new Blob([contenu], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `muldo-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
    showToast("Sauvegarde exportée : cheptel, généalogies, naissances, prix, historique.");
  };

  const importer = (e) => {
    const fichier = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!fichier) return;
    // Le rechargement en fin d'import re-hydrate depuis le compte Supabase ;
    // en mode invité rien n'est persisté (voir le commentaire sur modeInvite
    // dans App()), donc ce rechargement renverrait vers l'écran de connexion
    // et perdrait silencieusement les données tout juste importées.
    if (estInvite) { showToast("Connecte-toi ou crée un compte pour importer une sauvegarde."); return; }
    const lecteur = new FileReader();
    lecteur.onload = async () => {
      try {
        const parsed = JSON.parse(String(lecteur.result));
        if (parsed?.format !== "muldo-manager" || !parsed.donnees || typeof parsed.donnees !== "object") {
          showToast("Fichier invalide : ce n'est pas une sauvegarde de cet outil.");
          return;
        }
        // v1 : sauvegardes prises avant la migration Supabase, où chaque
        // valeur est la chaîne brute telle que localStorage la stockait (pas
        // forcément du JSON valide, ex. le thème stocké sans guillemets).
        const versionSource = parsed.version || 1;
        const donnees = {};
        let restaurees = 0;
        Object.entries(parsed.donnees).forEach(([cle, valeur]) => {
          if (versionSource === 1) {
            if (typeof valeur !== "string") return;
            try { donnees[cle] = JSON.parse(valeur); } catch { donnees[cle] = valeur; }
          } else {
            donnees[cle] = valeur;
          }
          restaurees += 1;
        });
        if (!restaurees) {
          showToast("Sauvegarde vide : rien à restaurer.");
          return;
        }
        await remplacerCacheComplet(donnees);
        // Rechargement : toute l'appli se réhydrate depuis le compte restauré.
        window.location.reload();
      } catch (err) {
        console.error(err);
        showToast("Import impossible : fichier illisible.");
      }
    };
    lecteur.readAsText(fichier);
  };

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <b>Sauvegarde</b>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
            {estInvite
              ? "Mode essai : rien n'est enregistré sur un compte. Exporte un fichier JSON avant de fermer la page pour ne rien perdre — tu pourras l'importer après avoir créé un compte."
              : "Tout est enregistré sur ton compte : exporte régulièrement un fichier JSON en plus (cheptel, généalogies, naissances, journal, prix, scans). L'import restaure tout et recharge la page."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-coral" onClick={exporter}>Exporter</button>
          <label
            className="btn btn-ghost"
            style={{ cursor: estInvite ? "not-allowed" : "pointer", opacity: estInvite ? 0.5 : 1 }}
            title={estInvite ? "Connecte-toi ou crée un compte pour importer une sauvegarde." : undefined}
          >
            Importer…
            <input type="file" accept="application/json,.json" disabled={estInvite} onChange={importer} style={{ display: "none" }} />
          </label>
        </div>
      </div>
    </div>
  );
}



