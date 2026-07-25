import React, { useState, useEffect } from "react";
import { flushToutesEcrituresDebattues } from "./stockage.js";
import { pushSupporte, abonnementPushActuel, activerNotificationsPush, desactiverNotificationsPush } from "./pushNotifications.js";
import { GpsDofusPage, ArbreGenealogiquePanel, CorbeillePanel, StatsCroisementsPanel, EstimationKamasTable, copierPressePapiers } from "./panneauxElevage.jsx";
import { GuidePage, NouveautesPage } from "./GuidePage.jsx";
import { OnboardingOverlay } from "./OnboardingOverlay.jsx";
import { supabase } from "./supabaseClient.js";
import { supabaseEstConfigure, LIEN_DON, LIENS_DON_STRIPE, LIEN_DISCORD } from "./configSupabase.js";
import { Waves, Save, Plus, Trash2, X } from "lucide-react";
import {
  useDragodindeElevage, DragodindeCheptelListPane, DragodindeCheptelMainPane, NewDragodindeModal,
  DragodindeSynchronisationPage, DragodindeGpsPage, DragodindeClonagePage, DragodindeSuccesPage,
  CLES_SAUVEGARDE_DRAGODINDE, generationDeCouleurDragodinde, sexeDragodinde, plierCouleurDragodinde,
  GENERATIONS_DRAGODINDE,
} from "./Dragodinde.jsx";
import {
  useVolkorneElevage, VolkorneCheptelListPane, VolkorneCheptelMainPane, NewVolkorneModal,
  VolkorneSynchronisationPage, VolkorneGpsPage, VolkorneClonagePage, VolkorneSuccesPage,
  CLES_SAUVEGARDE_VOLKORNE, generationDeCouleurVolkorne, sexeVolkorne, plierCouleurVolkorne,
  GENERATIONS_VOLKORNE,
} from "./Volkorne.jsx";
import {
  useMuldoElevage, MuldoBadge, MuldoDetail, NewMuldoModal, FicheRapideModal,
  DashboardDofusPanel, GraphiquesPanel, MemoElevagePanel, SuccesDofusPage,
  CheptelCards, CheptelOverviewPage, SynchronisationFiltresPage, ClonagePage,
  STORAGE_KEY, STORAGE_HISTORY_KEY, STORAGE_SYNC_KEY, STORAGE_GPS_SESSION,
  STORAGE_NAISSANCES, STORAGE_JOURNAL, STORAGE_INSTANTANES, STORAGE_CORBEILLE,
  CORBEILLE_DUREE_JOURS,
} from "./Muldo.jsx";
import {
  COULEURS_MULDO,
  GENERATIONS_MULDO, plierCouleur,
  couleurEstCanonique,
  generationDeCouleur,
  sexeMuldo,
  cleCoupleCouleurs,
  RESULTATS_PAR_COUPLE,
  plusHauteGenerationValidee,
  tierAilesMuldo,
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
const STORAGE_PARCOURS_GUIDE = "muldo-parcours-guide-v1";

// Bandeau de version visible dans l'en-tête. Reste "BETA vX.Y" tant que le
// site n'est pas poussé/déployé publiquement — passera à "V1" ce jour-là.
const VERSION_APP = "BETA v0.2";

// Parcours guidé pas-à-pas (au-delà du simple overlay explicatif du GPS) :
// accompagne un nouveau joueur à travers une vraie première session muldo
// (aller au GPS, réaliser un couple, confirmer la naissance obtenue), en
// détectant la progression réelle plutôt qu'un simple "Suivant" cliqué.
const ETAPES_PARCOURS_GUIDE = [
  { texte: "Direction Muldo → GPS pour lancer ta première session d'accouplements.", estFait: (ctx) => ctx.page === "muldo" && ctx.sousPage === "gps" },
  { texte: "Clique sur \"Réaliser\" pour un couple du plan proposé.", estFait: (ctx) => ctx.naissancesCount > 0 },
  { texte: "Confirme la couleur et le sexe réellement obtenus pour valider la naissance.", estFait: (ctx) => ctx.journalCount > 0 },
];


// ---------- composant principal ----------
export default function App() {
  // Cheptel public en lecture seule (?voir=pseudo) : lu une fois au montage,
  // ne change jamais après (un partage de lien recharge la page).
  const [pseudoPublic] = useState(() => new URLSearchParams(window.location.search).get("voir") || null);
  // Pseudo du parrain capturé sur un lien ?parrain=<pseudo> — transmis à
  // l'inscription (metadata signUp), sans lien avec les paliers d'ailes payants.
  const [parrainCapture] = useState(() => new URLSearchParams(window.location.search).get("parrain") || null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, opts = {}) => {
    setToast({ msg, type: opts.type });
    setTimeout(() => setToast(null), opts.duration || 2600);
  };
  // Permet d'atterrir directement sur une page via ?page=guide (utile pour le
  // sitemap et les liens partagés) — retombe sur "dashboard" si absent/invalide.
  const [page, setPage] = useState(() => {
    const demandee = new URLSearchParams(window.location.search).get("page");
    const pagesValides = ["dashboard", "dragodinde", "muldo", "volkorne", "taverne", "succes", "guide", "nouveautes"];
    return pagesValides.includes(demandee) ? demandee : "dashboard";
  });
  // Onglet actif à l'intérieur d'une section créature (Muldo/Dragodinde/Volkorne) :
  // "cheptel" | "synchro" | "gps" | "clonage". Partagé entre les 3, réinitialisé
  // implicitement en changeant de section (on ne mémorise pas par créature).
  const [sousPage, setSousPage] = useState("cheptel");
  // Créature affichée sur la page Succès (elle regroupe les 3 sous un seul onglet).
  const [succesCreature, setSuccesCreature] = useState("muldo");
  const [theme, setTheme] = useState(() => {
    const enregistre = localStorage.getItem(STORAGE_THEME);
    if (enregistre === "clair" || enregistre === "sombre") return enregistre;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "clair" : "sombre";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_THEME, theme);
  }, [theme]);
  const [onboardingGpsOuvert, setOnboardingGpsOuvert] = useState(false);
  useEffect(() => {
    if (sousPage === "gps" && !localStorage.getItem(STORAGE_ONBOARDING_GPS)) {
      setOnboardingGpsOuvert(true);
    }
  }, [sousPage]);
  const fermerOnboardingGps = () => {
    localStorage.setItem(STORAGE_ONBOARDING_GPS, "1");
    setOnboardingGpsOuvert(false);
  };
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
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_PROFIL));
      if (saved && typeof saved === "object") {
        const styleValide = ["dragodinde", "muldo", "volkorne"].includes(saved.styleAiles) ? saved.styleAiles : "muldo";
        return { pseudo: saved.pseudo || "", soutien: !!saved.soutien, styleAiles: styleValide, niveauAiles: Math.max(1, Math.min(5, Math.ceil((Number(saved.niveauAiles) || 1) / (Number(saved.niveauAiles) > 5 ? 2 : 1)))) };
      }
    } catch (e) {
      console.error(e);
    }
    return { pseudo: "", soutien: false, styleAiles: "muldo", niveauAiles: 1 };
  });
  const setProfil = (next) => {
    setProfilState(next);
    try {
      localStorage.setItem(STORAGE_PROFIL, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };
  const compte = useCompte();
  const eleveMuldo = useMuldoElevage(showToast, setToast);
  const eleveDragodinde = useDragodindeElevage();
  const eleveVolkorne = useVolkorneElevage();
  // null = jamais démarré (auto-proposé une fois) ; nombre = étape en cours ;
  // "termine"/"saute" = ne plus proposer automatiquement, relançable manuellement.
  const [parcoursGuideEtape, setParcoursGuideEtape] = useState(() => {
    const v = localStorage.getItem(STORAGE_PARCOURS_GUIDE);
    return v === null ? null : (Number.isFinite(Number(v)) ? Number(v) : v);
  });
  useEffect(() => {
    if (localStorage.getItem(STORAGE_PARCOURS_GUIDE) === null) setParcoursGuideEtape(0);
  }, []);
  useEffect(() => {
    if (typeof parcoursGuideEtape !== "number") return;
    const ctx = { page, sousPage, naissancesCount: eleveMuldo.naissances.length, journalCount: eleveMuldo.journal.length };
    if (ETAPES_PARCOURS_GUIDE[parcoursGuideEtape]?.estFait(ctx)) {
      const suivante = parcoursGuideEtape + 1;
      const valeur = suivante >= ETAPES_PARCOURS_GUIDE.length ? "termine" : suivante;
      setParcoursGuideEtape(valeur);
      localStorage.setItem(STORAGE_PARCOURS_GUIDE, String(valeur));
      if (valeur === "termine") {
        showToast("🎉 Parcours guidé terminé ! Tu maîtrises maintenant le cycle GPS → accouplement → naissance.", { type: "objectif", duration: 5000 });
      }
    }
  }, [parcoursGuideEtape, page, sousPage, eleveMuldo.naissances.length, eleveMuldo.journal.length]);
  const sauterParcoursGuide = () => {
    setParcoursGuideEtape("saute");
    localStorage.setItem(STORAGE_PARCOURS_GUIDE, "saute");
  };
  const relancerParcoursGuide = () => {
    setParcoursGuideEtape(0);
    localStorage.setItem(STORAGE_PARCOURS_GUIDE, "0");
  };
  const [profilOuvert, setProfilOuvert] = useState(false);
  useEffect(() => { if (compte.pretMdp) setProfilOuvert(true); }, [compte.pretMdp]);
  // Pousse la génération muldo la plus haute validée vers le profil Supabase
  // (auto-déclaratif) dès qu'elle change — sert de condition de déblocage
  // des ailes "muldo", en plus du palier de don.
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const gen = plusHauteGenerationValidee(eleveMuldo.cheptel, eleveMuldo.historiqueCouleurs);
    if (compte.profil.succes_generation_muldo !== gen) {
      supabase.from("profils").update({ succes_generation_muldo: gen })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
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
  }, [eleveDragodinde.cheptel, eleveDragodinde.historiqueCouleurs, compte.session, compte.profil]);
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const nb = Object.values(eleveDragodinde.historiqueCouleurs || {}).filter(Boolean).length;
    if (compte.profil.couleurs_decouvertes_dragodinde !== nb) {
      supabase.from("profils").update({ couleurs_decouvertes_dragodinde: nb })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
  }, [eleveDragodinde.historiqueCouleurs, compte.session, compte.profil]);
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const gen = plusHauteGenerationValideeGenerique(eleveVolkorne.cheptel, eleveVolkorne.historiqueCouleurs, GENERATIONS_VOLKORNE);
    if (compte.profil.succes_generation_volkorne !== gen) {
      supabase.from("profils").update({ succes_generation_volkorne: gen })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
  }, [eleveVolkorne.cheptel, eleveVolkorne.historiqueCouleurs, compte.session, compte.profil]);
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const nb = Object.values(eleveVolkorne.historiqueCouleurs || {}).filter(Boolean).length;
    if (compte.profil.couleurs_decouvertes_volkorne !== nb) {
      supabase.from("profils").update({ couleurs_decouvertes_volkorne: nb })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
  }, [eleveVolkorne.historiqueCouleurs, compte.session, compte.profil]);

  // Titre d'onglet dynamique : reflète la page (et, pour les créatures, le
  // sous-onglet) affichée — plus lisible dans l'historique/les favoris du
  // navigateur qu'un titre statique unique.
  useEffect(() => {
    // La page cheptel public (?voir=pseudo) gère son propre titre — cet effet
    // tourne quand même (hooks inconditionnels) mais ne doit pas l'écraser.
    if (pseudoPublic) return;
    const NOMS_CREATURE = { muldo: "Muldos", dragodinde: "Dragodindes", volkorne: "Volkornes" };
    const NOMS_SOUS_PAGE = { cheptel: "Cheptel", synchro: "Synchronisation", gps: "GPS", clonage: "Clonage" };
    let titre;
    if (page === "dashboard") titre = "Tableau de bord";
    else if (page === "taverne") titre = "Taverne";
    else if (page === "succes") titre = "Succès";
    else if (page === "guide") titre = "Guide";
    else if (page === "nouveautes") titre = "Quoi de neuf";
    else if (NOMS_CREATURE[page]) titre = `${NOMS_SOUS_PAGE[sousPage] || ""} ${NOMS_CREATURE[page]}`.trim();
    else titre = "Registre des Abysses";
    document.title = `${titre} — Registre des Abysses`;
  }, [page, sousPage, pseudoPublic]);

  if (pseudoPublic) {
    return (
      <CheptelPublicPage
        pseudo={pseudoPublic}
        cheptelViewer={{ muldo: eleveMuldo.cheptel, dragodinde: eleveDragodinde.cheptel, volkorne: eleveVolkorne.cheptel }}
      />
    );
  }

  if (eleveMuldo.loading) {
    return (
      <div className="app-shell loading-screen">
        <Waves size={20} style={{ marginRight: 8 }} /> Remontée des données du cheptel…
      </div>
    );
  }

  return (
    <div className="app-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;0,9..144,800;1,9..144,600&display=swap');
        :root {
          --bg: #17130f;
          --bg2: #231d17;
          --panel: #2b241d;
          --panel2: #352b22;
          --panel3: #403225;
          --line: #5b4733;
          --gold: #d6a64a;
          --gold2: #f0cf72;
          --accent: #c97935;
          --green: #68c16f;
          --cyan: #65c7c1;
          --red: #d85b4f;
          --text: #f4ead7;
          --muted: #a9967c;
          --font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
          --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --page-bg: #0c0a08;
          --shell-bg:
            radial-gradient(900px 420px at 35% -15%, rgba(214,166,74,.22), transparent 62%),
            radial-gradient(1000px 600px at 108% 112%, rgba(101,199,193,.10), transparent 58%),
            radial-gradient(700px 400px at -8% 108%, rgba(30,70,80,.35), transparent 60%),
            linear-gradient(160deg, #120f0c 0%, #1f1812 55%, #15161a 100%);
        }
        /* Thème clair — première passe, à affiner visuellement (teintes exactes
           laissées à l'appréciation du propriétaire du site). */
        :root[data-theme="clair"] {
          --bg: #f7f1e6;
          --bg2: #efe4d0;
          --panel: #fffaf0;
          --panel2: #f3e9d6;
          --panel3: #ead9bd;
          --line: #d8c39f;
          --gold: #b9822f;
          --gold2: #8f6220;
          --accent: #b56b2e;
          --green: #2f9142;
          --cyan: #1f8f88;
          --red: #b23d32;
          --text: #2b2013;
          --muted: #7a6b52;
          --page-bg: #f2ead9;
          --shell-bg:
            radial-gradient(900px 420px at 35% -15%, rgba(214,166,74,.16), transparent 62%),
            radial-gradient(1000px 600px at 108% 112%, rgba(101,199,193,.12), transparent 58%),
            radial-gradient(700px 400px at -8% 108%, rgba(180,150,100,.18), transparent 60%),
            linear-gradient(160deg, #fbf6ea 0%, #f3e8d3 55%, #eee7df 100%);
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
        :focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; border-radius: 6px; }
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
        .field:focus { outline:none; border-color:var(--gold); box-shadow:0 0 0 3px rgba(214,166,74,.14); }
        .field::placeholder { color: rgba(169,150,124,.55); }

        .btn {
          cursor:pointer; border:0; border-radius:10px; padding:10px 14px; font-size:13px; font-weight:700;
          display:inline-flex; align-items:center; justify-content:center; gap:7px;
          transition: transform .12s ease, opacity .12s ease, border-color .12s ease, background .12s ease, box-shadow .12s ease;
        }
        .btn:hover { opacity:.94; transform: translateY(-1px); }
        .btn:active { transform: scale(.98); }
        .btn:disabled { cursor: not-allowed; transform: none; }
        .btn-coral, .btn.primary {
          background:linear-gradient(180deg, var(--gold2), var(--accent)); color:#241408;
          border:1px solid rgba(255,255,255,.18);
          box-shadow:0 8px 22px rgba(201,121,53,.22);
          font-weight:800;
        }
        .btn-coral:hover { box-shadow:0 10px 26px rgba(201,121,53,.32); }
        .btn-ghost {
          background:rgba(255,255,255,.03); color:var(--muted); border:1px solid var(--line);
        }
        .btn-ghost:hover, .nav-active { color:var(--text); border-color:var(--gold); background:rgba(214,166,74,.12); }
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
          background: linear-gradient(92deg, var(--text) 20%, var(--gold2) 60%, var(--gold) 90%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .brand-mark {
          width:42px; height:42px; border-radius:13px; display:grid; place-items:center;
          background:linear-gradient(145deg, #46331f, #1b2a2c);
          border:1px solid var(--line); box-shadow:inset 0 0 18px rgba(101,199,193,.18), inset 0 0 10px rgba(214,166,74,.16);
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
          background:rgba(214,166,74,.11);
        }
        .stat-value { font-family:var(--font-display); font-size:34px; font-weight:800; color:var(--gold2); line-height:1; }
        .stat-label { color:var(--muted); font-size:11px; margin-top:8px; text-transform:uppercase; letter-spacing:1.1px; font-weight:700; }

        .hero-gps { display:grid; grid-template-columns: 1.35fr .9fr; gap:16px; align-items:stretch; }
        .gps-action {
          border-radius:22px; padding:24px; border:1px solid rgba(214,166,74,.55);
          background:
            radial-gradient(580px 220px at 20% 0%, rgba(240,207,114,.18), transparent 60%),
            linear-gradient(145deg, var(--panel3), var(--panel2));
        }
        .gps-title { color:var(--gold2); font-weight:800; letter-spacing:1.4px; text-transform:uppercase; font-size:11px; }
        .gps-target { font-family:var(--font-display); font-size:32px; margin:10px 0 12px; font-weight:800; }

        .recipe-line { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:14px; }
        .pill {
          display:inline-flex; align-items:center; gap:6px; padding:8px 10px; border-radius:999px;
          background:rgba(0,0,0,.18); border:1px solid var(--line); color:var(--text); font-weight:700; font-size:12px;
        }
        .progress-bar { height:10px; background:rgba(0,0,0,.24); border:1px solid var(--line); border-radius:999px; overflow:hidden; }
        .progress-fill { height:100%; background:linear-gradient(90deg, var(--accent), var(--gold2)); border-radius:999px; }

        .muldo-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
        .muldo-card {
          cursor:pointer; border-radius:16px; padding:14px; border:1px solid var(--line);
          background:linear-gradient(145deg, var(--panel3), var(--panel2));
          transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
        }
        .muldo-card:hover { transform:translateY(-2px); border-color:var(--gold); box-shadow:0 10px 24px rgba(0,0,0,.28); }
        .muldo-ready { border-color:rgba(104,193,111,.75); }
        .muldo-sterile { border-color:rgba(216,91,79,.65); opacity:.78; }
        .muldo-selected { box-shadow:0 0 0 2px rgba(214,166,74,.35); border-color:var(--gold); }

        .success-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(170px,1fr)); gap:10px; }
        .success-chip { padding:11px 12px; border-radius:13px; border:1px solid var(--line); background:rgba(0,0,0,.13); }
        .success-ok { border-color:rgba(104,193,111,.55); background:rgba(104,193,111,.09); }
        .success-miss { opacity:.58; }

        ::-webkit-scrollbar { width:9px; height:9px; }
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
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", opacity: eleveMuldo.saving ? 1 : 0 }}>
            <Save size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> sauvegarde…
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={() => setTheme((t) => (t === "clair" ? "sombre" : "clair"))}
              title={theme === "clair" ? "Passer en thème sombre" : "Passer en thème clair"}
              style={{ padding: "8px 12px" }}
            >
              {theme === "clair" ? "🌙" : "☀️"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setProfilOuvert(true)}
              title="Mon profil / connexion à la Taverne"
              style={{ padding: "8px 12px" }}
            >
              {compte.profil
                ? <PseudoAvecAiles pseudo={compte.profil.pseudo} soutien={compte.profil.niveau_ailes > 0} styleAiles={compte.profil.style_ailes} niveau={compte.profil.niveau_ailes} taille={24} />
                : <>👤 <span style={{ marginLeft: 6 }}>Profil / Connexion</span></>}
            </button>
            <button className="btn btn-coral" onClick={() => eleveMuldo.setShowNew(true)}><Plus size={15} /> Nouveau muldo</button>
            <button className="btn btn-coral" onClick={() => eleveDragodinde.setShowNew(true)}><Plus size={15} /> Nouveau dragodinde</button>
            <button className="btn btn-coral" onClick={() => eleveVolkorne.setShowNew(true)}><Plus size={15} /> Nouveau volkorne</button>
          </div>
        </div>
      </div>

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
        {page === "dragodinde" && sousPage === "cheptel" && <DragodindeCheptelListPane {...eleveDragodinde.cheptelListProps} />}
        {page === "volkorne" && sousPage === "cheptel" && <VolkorneCheptelListPane {...eleveVolkorne.cheptelListProps} />}

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
              <GraphiquesPanel cheptel={eleveMuldo.cheptel} journal={eleveMuldo.journal} instantanes={eleveMuldo.instantanes} />
              <EstimationKamasSelecteur cheptelMuldo={eleveMuldo.cheptel} cheptelDragodinde={eleveDragodinde.cheptel} cheptelVolkorne={eleveVolkorne.cheptel} userId={compte.session?.user?.id} />
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
              <SauvegardePanel showToast={showToast} />
            </>
          )}

          {page === "taverne" && (
            <TavernePage
              compte={compte}
              onOuvrirProfil={() => setProfilOuvert(true)}
              ouvrirClassementInitial={demandeClassementTaverne}
              onClassementInitialConsomme={() => setDemandeClassementTaverne(false)}
              brouillonInitial={brouillonTaverne}
              onBrouillonInitialConsomme={() => setBrouillonTaverne("")}
            />
          )}

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
                  <DragodindeCheptelMainPane {...eleveDragodinde.cheptelMainProps} />
                  <ArbreGenealogiquePanel cheptel={eleveDragodinde.cheptel} onSelect={eleveDragodinde.setSelectedId} sexeFn={sexeDragodinde} plierCouleurFn={plierCouleurDragodinde} />
                  <StatsCroisementsPanel journal={eleveDragodinde.journal} />
                  <CorbeillePanel {...eleveDragodinde.corbeilleProps} />
                </>
              )}
              {sousPage === "synchro" && <DragodindeSynchronisationPage {...eleveDragodinde.syncProps} showToast={showToast} />}
              {sousPage === "gps" && <DragodindeGpsPage {...eleveDragodinde.gpsProps} {...eleveDragodinde.naissancesProps} onPartagerTaverne={partagerDansTaverne} onObjectifAtteint={(couleur, sexe) => showToast(`🎯 Objectif GPS atteint ! ${couleur} ${sexe === "F" ? "♀" : "♂"} obtenu(e).`, { type: "objectif", duration: 5000 })} />}
              {sousPage === "clonage" && <DragodindeClonagePage {...eleveDragodinde.clonageProps} />}
            </>
          )}

          {page === "volkorne" && (
            <>
              <SousNavOutils sousPage={sousPage} setSousPage={setSousPage} />
              {sousPage === "cheptel" && (
                <>
                  <VolkorneCheptelMainPane {...eleveVolkorne.cheptelMainProps} />
                  <ArbreGenealogiquePanel cheptel={eleveVolkorne.cheptel} onSelect={eleveVolkorne.setSelectedId} sexeFn={sexeVolkorne} plierCouleurFn={plierCouleurVolkorne} />
                  <StatsCroisementsPanel journal={eleveVolkorne.journal} />
                  <CorbeillePanel {...eleveVolkorne.corbeilleProps} />
                </>
              )}
              {sousPage === "synchro" && <VolkorneSynchronisationPage {...eleveVolkorne.syncProps} showToast={showToast} />}
              {sousPage === "gps" && <VolkorneGpsPage {...eleveVolkorne.gpsProps} {...eleveVolkorne.naissancesProps} onPartagerTaverne={partagerDansTaverne} onObjectifAtteint={(couleur, sexe) => showToast(`🎯 Objectif GPS atteint ! ${couleur} ${sexe === "F" ? "♀" : "♂"} obtenu(e).`, { type: "objectif", duration: 5000 })} />}
              {sousPage === "clonage" && <VolkorneClonagePage {...eleveVolkorne.clonageProps} />}
            </>
          )}
        </div>
      </div>

      {eleveMuldo.showNew && <NewMuldoModal cheptel={eleveMuldo.cheptel} onClose={() => eleveMuldo.setShowNew(false)} onCreate={eleveMuldo.addMuldo} />}
      {eleveDragodinde.showNew && <NewDragodindeModal onClose={() => eleveDragodinde.setShowNew(false)} onCreate={eleveDragodinde.addMuldo} />}
      {eleveVolkorne.showNew && <NewVolkorneModal onClose={() => eleveVolkorne.setShowNew(false)} onCreate={eleveVolkorne.addMuldo} />}

      <OnboardingOverlay open={onboardingGpsOuvert} onClose={fermerOnboardingGps} />

      {profilOuvert && (
        <ProfilModal compte={compte} profilLocal={profil} setProfilLocal={setProfil} onClose={() => setProfilOuvert(false)} parrainCapture={parrainCapture} />
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
      </footer>

      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 90, maxWidth: "min(92vw, 640px)", pointerEvents: "none", background: "var(--panel)", border: `1px solid ${toast.type === "objectif" ? "var(--cyan)" : "var(--gold)"}`, color: "var(--text)", padding: "10px 16px", borderRadius: 12, fontSize: 13, boxShadow: toast.type === "objectif" ? "0 12px 30px rgba(0,0,0,.45), 0 0 24px var(--cyan)" : "0 12px 30px rgba(0,0,0,.45)", animation: "fondu .15s ease" }}>
          {typeof toast === "string" ? toast : toast.msg}
        </div>
      )}

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

function AppSidebar({ page, setPage, cheptel, readyCount, fertileCount, discoveredTotal, cheptelDragodinde, cheptelVolkorne }) {
  const nav = [
    ["dashboard", "🏠", "Dashboard"],
    ["dragodinde", "🐲", "Dragodinde"],
    ["muldo", "🐴", "Muldo"],
    ["volkorne", "🐎", "Volkorne"],
    ["taverne", "🍻", "Taverne"],
    ["succes", "🏆", "Succès"],
    ["guide", "📖", "Guide"],
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Navigation</div>
      {nav.map(([key, icon, label]) => (
        <button
          key={key}
          className={`btn btn-ghost nav-btn ${page === key ? "nav-active" : ""}`}
          onClick={() => setPage(key)}
        >
          <span style={{ fontSize: 17 }}>{icon}</span>
          <span>{label}</span>
        </button>
      ))}

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

function EstimationKamasSelecteur({ cheptelMuldo, cheptelDragodinde, cheptelVolkorne, userId }) {
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
    if (!supabase || !session?.user) { setProfil(null); return; }
    supabase.from("profils").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfil(data || null));
  }, [session]);

  useEffect(() => { rafraichirProfil(); }, [rafraichirProfil]);

  return { session, profil, pretMdp, setPretMdp, rafraichirProfil };
}

// ---------- Panneau d'authentification (connexion / inscription / oubli) ----------
function AuthPanel({ profilLocal, pretMdp, onFini, parrainCapture }) {
  const [pseudo, setPseudo] = useState(profilLocal?.pseudo || "");
  const [email, setEmail] = useState("");
  const [identifiant, setIdentifiant] = useState("");
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

  const resoudreEmail = async (id) => {
    if (id.includes("@")) return id.trim().toLowerCase();
    const { data } = await supabase.rpc("email_pour_pseudo", { p: id });
    return data || null;
  };

  const valider = async () => {
    setErreur(""); setInfo(""); setChargement(true);
    try {
      if (mode === "inscription") {
        const p = pseudo.trim(); const mail = email.trim().toLowerCase();
        if (p.length < 2 || p.length > 20) throw new Error("Pseudo entre 2 et 20 caractères.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error("Adresse email invalide.");
        if (motDePasse.length < 6) throw new Error("Mot de passe : 6 caractères minimum.");
        const { data: existant } = await supabase.from("profils").select("id").ilike("pseudo", p).maybeSingle();
        if (existant) throw new Error("Ce pseudo est déjà pris.");
        const { error } = await supabase.auth.signUp({ email: mail, password: motDePasse, options: { data: { pseudo: p, parrain: parrainCapture || undefined } } });
        if (error) throw new Error(/already/i.test(error.message) ? "Un compte existe déjà avec cet email." : error.message);
        setInfo(`Email de confirmation envoyé à ${mail} — clique le lien, puis connecte-toi.`);
        setMode("connexion"); setIdentifiant(p); setMotDePasse("");
      } else if (mode === "oubli") {
        const mail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error("Entre l'adresse email de ton compte.");
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin });
        if (error) throw error;
        setInfo("Si un compte existe pour cette adresse, un email de réinitialisation vient de partir.");
        setMode("connexion");
      } else if (mode === "nouveau-mdp") {
        if (motDePasse.length < 6) throw new Error("Mot de passe : 6 caractères minimum.");
        const { error } = await supabase.auth.updateUser({ password: motDePasse });
        if (error) throw error;
        setInfo("Mot de passe changé, te voilà connecté !"); setMode("connexion"); setMotDePasse("");
        onFini && onFini();
      } else {
        const id = identifiant.trim();
        if (!id) throw new Error("Entre ton pseudo ou ton email.");
        const mail = await resoudreEmail(id);
        if (!mail) throw new Error("Pseudo inconnu dans la Taverne.");
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
            <input className="field" placeholder="Pseudo (public)" maxLength={20} value={pseudo} onChange={(e) => setPseudo(e.target.value)} style={{ width: 170 }} />
          </>
        )}
        {mode === "connexion" && (
          <input className="field" placeholder="Pseudo ou email" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} style={{ width: 210 }} />
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
  const { session, profil, pretMdp, rafraichirProfil } = compte;
  const [description, setDescription] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [info, setInfo] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => { setDescription(profil?.description || ""); }, [profil]);

  const patcher = async (patch, message) => {
    setErreur(""); setInfo("");
    const { error } = await supabase.from("profils").update(patch).eq("id", session.user.id);
    if (error) { setErreur(error.message); return; }
    rafraichirProfil(); setInfo(message);
  };
  const changerMdp = async () => {
    setErreur(""); setInfo("");
    if (nouveauMdp.length < 6) { setErreur("Mot de passe : 6 caractères minimum."); return; }
    const { error } = await supabase.auth.updateUser({ password: nouveauMdp });
    if (error) { setErreur(error.message); return; }
    setNouveauMdp(""); setInfo("Mot de passe changé.");
  };

  const configManquante = !supabaseEstConfigure() || !supabase;
  // "muldo" est conditionné au succès de génération (déjà réellement suivi
  // dans l'appli) en plus du don ; "dragodinde"/"volkorne" ne dépendent pour
  // l'instant que du palier de don, faute de suivi d'élevage pour ces
  // montures — à resserrer plus tard quand ces pages existeront.
  const tierMuldo = profil ? tierAilesMuldo(profil.niveau_ailes, profil.succes_generation_muldo) : 0;
  const tierDon = profil ? Math.max(0, Math.min(5, Number(profil.niveau_ailes) || 0)) : 0;
  const tiersParStyle = { dragodinde: tierDon, muldo: tierMuldo, volkorne: tierDon };
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
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>Chargement du profil…</div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <PseudoAvecAiles pseudo={profil.pseudo} soutien={niveauEffectif > 0} styleAiles={profil.style_ailes} niveau={niveauEffectif} taille={40} />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{session.user.email} <span style={{ opacity: .6 }}>(privé)</span></span>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Description publique (300 car.) — visible au survol de ton pseudo</div>
              <textarea className="field" rows={3} maxLength={300} placeholder="Éleveur de muldos depuis la 2.0…" value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical" }} />
              <button className="btn btn-coral" style={{ marginTop: 8 }} onClick={() => patcher({ description: description.trim().slice(0, 300) }, "Description enregistrée.")}>Enregistrer</button>
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
                      title={verrouille ? (
                        style === "muldo"
                          ? `Débloqué à partir de la génération 2 validée (page Succès) et d'un don palier 1 — actuellement génération ${profil.succes_generation_muldo || 0} validée`
                          : "Débloqué à partir du palier de don 1"
                      ) : undefined}
                      onClick={() => !verrouille && patcher({ style_ailes: style }, `Ailes ${label} équipées.`)}
                    >
                      <AileNiveau style={style} taille={36} niveau={Math.max(1, tier)} /> {label}{verrouille ? " 🔒" : ""}
                    </button>
                  );
                })}
              </div>
              {tierMuldo < 1 && (
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 6 }}>
                  Ailes muldo : débloquées par palier de don ET par succès de génération (palier × 2). Génération actuellement
                  validée : <b>{profil.succes_generation_muldo || 0}</b> — valide plus de générations dans la page Succès pour progresser.
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input className="field" type="password" placeholder="Nouveau mot de passe" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} style={{ width: 200 }} />
              <button className="btn btn-ghost" onClick={changerMdp}>Changer le mot de passe</button>
              <button className="btn btn-ghost" onClick={() => { supabase.auth.signOut(); onClose(); }}>Se déconnecter</button>
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
                {[1,2,3,4,5].map((n) => (
                  <div key={n} style={{ padding: "8px", borderRadius: 10, textAlign: "center", border: `1px solid ${n === profil.niveau_ailes ? "var(--gold)" : "var(--line)"}`, background: n === profil.niveau_ailes ? "rgba(214,166,74,.08)" : "rgba(0,0,0,.12)" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 3 }}>
                      <AileNiveau style="dragodinde" miroir taille={32} niveau={n} />
                      <AileNiveau style="muldo" taille={32} niveau={n} />
                      <AileNiveau style="volkorne" taille={32} niveau={n} />
                    </div>
                    <div style={{ fontWeight: 800, color: "var(--gold2)", marginTop: 4, fontSize: 13 }}>{montantPourNiveau(n)} €</div>
                  </div>
                ))}
              </div>
              {LIENS_DON_STRIPE.some(Boolean) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>
                    Palier attribué automatiquement dès le paiement confirmé :
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {LIENS_DON_STRIPE.map((lien, i) => {
                      const n = i + 1;
                      if (!lien) return null;
                      const url = `${lien}${lien.includes("?") ? "&" : "?"}client_reference_id=${encodeURIComponent(session.user.id)}`;
                      return (
                        <a
                          key={n}
                          className="btn btn-coral"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "none", display: "inline-flex" }}
                        >
                          💳 {montantPourNiveau(n)} €
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              {LIEN_DON && (
                <a className="btn btn-ghost" href={LIEN_DON} target="_blank" rel="noreferrer" style={{ marginTop: 12, textDecoration: "none", display: "inline-flex" }}>💛 Don manuel (PayPal)</a>
              )}
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 8 }}>
                {LIENS_DON_STRIPE.some(Boolean)
                  ? "Les boutons ci-dessus attribuent le palier automatiquement. Le don PayPal reste manuel : indique ton pseudo dans le message, attribution sous quelques jours."
                  : "Indique ton pseudo dans le message du don : les ailes sont attribuées manuellement (Stripe automatisera ça plus tard)."}
              </div>
            </div>
          </div>
        )}

        <SoutienPanel profil={profilLocal} setProfil={setProfilLocal} />
      </div>
    </div>
  );
}

const STORAGE_LU_SUJETS = "taverne-lu-sujets-v1";

function TavernePage({ compte, onOuvrirProfil, ouvrirClassementInitial, onClassementInitialConsomme, brouillonInitial, onBrouillonInitialConsomme }) {
  const { session } = compte;
  const [profilsParId, setProfilsParId] = useState({});
  const [sujets, setSujets] = useState([]);
  const [statsSujets, setStatsSujets] = useState({});
  const [vue, setVue] = useState({ type: "liste" });
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [luSujets, setLuSujets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_LU_SUJETS)) || {}; } catch (e) { return {}; }
  });

  const marquerSujetLu = (sujetId) => {
    setLuSujets((prev) => {
      const next = { ...prev, [sujetId ?? "general"]: new Date().toISOString() };
      try { localStorage.setItem(STORAGE_LU_SUJETS, JSON.stringify(next)); } catch (e) { console.error(e); }
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
  }, [ouvrirClassementInitial]);

  // Pré-remplit le Comptoir général avec un brouillon venant d'ailleurs (ex.
  // partage d'un plan GPS ou d'un cheptel publié) — même logique de
  // consommation à sens unique que le classement ci-dessus.
  useEffect(() => {
    if (!brouillonInitial) return;
    setVue({ type: "sujet", id: null, titre: "🍺 Comptoir général", auteur: null });
    setSaisie(brouillonInitial);
    onBrouillonInitialConsomme?.();
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
    let requete = supabase.from("messages").select("id, auteur, contenu, cree_le").order("cree_le", { ascending: true }).limit(200);
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
  }, [session?.user?.id]);

  const vueRef = React.useRef(vue);
  useEffect(() => { vueRef.current = vue; }, [vue]);

  useEffect(() => {
    if (vue.type === "sujet") { chargerFil(vue.id); marquerSujetLu(vue.id); }
  }, [vue.type, vue.id]);

  useEffect(() => {
    finFil.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ----- Forum -----
  const envoyer = async () => {
    const contenu = saisie.trim();
    if (!contenu || !session?.user || vue.type !== "sujet") return;
    setSaisie("");
    const { error } = await supabase.from("messages").insert({
      auteur: session.user.id, contenu, sujet_id: vue.id,
    });
    if (error) setErreur("Message refusé : " + error.message);
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

  const AuteurAile = ({ id, taille = 16 }) => {
    const p = profilsParId[id];
    if (!p) return <span style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)" }}>Éleveur</span>;
    const niveauEffectif = p.style_ailes === "muldo"
      ? tierAilesMuldo(p.niveau_ailes, p.succes_generation_muldo)
      : p.niveau_ailes;
    return (
      <span
        title={p.description || undefined}
        onClick={(e) => { e.stopPropagation(); setProfilPublicId(id); }}
        style={{ cursor: "pointer" }}
      >
        <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={niveauEffectif} taille={taille} />
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
                      ouvert par <AuteurAile id={s.auteur} taille={13} />
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
          <div style={{ maxHeight: 460, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 6 }}>
            {messages.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                Personne n'a encore parlé ici… lance la discussion ! 🍺
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, borderBottom: "1px solid rgba(255,255,255,.04)", paddingBottom: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, flex: "0 0 auto", minWidth: 150 }}>
                  <AuteurAile id={m.auteur} taille={32} />
                  <span style={{ color: "var(--muted)", fontSize: 10 }}>
                    {new Date(m.cree_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontSize: 13, paddingTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere", flex: "1 1 auto" }}>{m.contenu}</div>
                {session?.user?.id === m.auteur && (
                  <button className="btn btn-ghost" title="Supprimer ce message" style={{ padding: "3px 6px", fontSize: 11, color: "var(--red)", flex: "0 0 auto" }} onClick={() => supprimerMessage(m.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            <div ref={finFil} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
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

function ProfilPublicModal({ profil, estMoi, peutEnvoyerMp, onClose, onMessagePrive }) {
  const niveauEffectif = profil.style_ailes === "muldo"
    ? tierAilesMuldo(profil.niveau_ailes, profil.succes_generation_muldo)
    : profil.niveau_ailes;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(360px, 100%)", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <PseudoAvecAiles pseudo={profil.pseudo} soutien={profil.niveau_ailes > 0} styleAiles={profil.style_ailes} niveau={niveauEffectif} taille={32} />
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
          const niveauEffectif = p.style_ailes === "muldo" ? tierAilesMuldo(p.niveau_ailes, p.succes_generation_muldo) : p.niveau_ailes;
          return (
            <div
              key={p.id}
              className="row-item"
              onClick={() => onOuvrirProfil(p.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", borderRadius: 8, flexWrap: "wrap" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ width: 26, textAlign: "center", fontWeight: 800, color: "var(--gold2)" }}>{MEDAILLES[i] || i + 1}</span>
                <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={niveauEffectif} taille={20} />
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
          const niveauEffectif = p ? (p.style_ailes === "muldo" ? tierAilesMuldo(p.niveau_ailes, p.succes_generation_muldo) : p.niveau_ailes) : 0;
          return (
            <div
              key={c.id}
              className="row-item"
              onClick={() => onOuvrir(c.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", borderRadius: 8 }}
            >
              <div style={{ minWidth: 0 }}>
                {p ? <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={niveauEffectif} taille={20} /> : "Éleveur"}
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
  const niveauEffectif = profilCible ? (profilCible.style_ailes === "muldo" ? tierAilesMuldo(profilCible.niveau_ailes, profilCible.succes_generation_muldo) : profilCible.niveau_ailes) : 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, var(--panel3), var(--panel2))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12, cursor: profilCible ? "pointer" : "default" }} onClick={() => profilCible && onOuvrirProfil()}>
            {profilCible ? <PseudoAvecAiles pseudo={profilCible.pseudo} soutien={profilCible.niveau_ailes > 0} styleAiles={profilCible.style_ailes} niveau={niveauEffectif} taille={24} /> : "Éleveur"}
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
              <div key={m.id} style={{ alignSelf: moi ? "flex-end" : "flex-start", maxWidth: "80%", background: moi ? "rgba(214,166,74,.16)" : "rgba(255,255,255,.05)", border: `1px solid ${moi ? "var(--gold)" : "var(--line)"}`, borderRadius: 12, padding: "8px 10px" }}>
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
// bleu-turquoise, débloquées par succès de génération en plus du don — voir
// tierAilesMuldo) et "volkorne" (griffes/flammes sombres).
const NOMS_NIVEAUX_AILES = {
  dragodinde: ["Envol Naissant", "Plume Dorée", "Grâce Ailée", "Splendeur Céleste", "Majesté Solaire"],
  muldo: ["Sang Neuf", "Robe Affirmée", "Instinct du Troupeau", "Sagesse du Cheptel", "Légende Vivante"],
  volkorne: ["Braise Naissante", "Griffe Ardente", "Fureur Cornue", "Rugissement Infernal", "Apocalypse Vivante"],
};

// Teinte de la lueur (drop-shadow) autour des images PNG, par style.
const HALO_AILES = {
  dragodinde: "rgba(240,207,114,",
  muldo: "rgba(101,199,193,",
  volkorne: "rgba(232,120,50,",
};

function nomNiveauAiles(style, niveau) {
  const n = Math.max(1, Math.min(5, Number(niveau) || 1));
  return (NOMS_NIVEAUX_AILES[style] || NOMS_NIVEAUX_AILES.muldo)[n - 1] || "";
}

// Une image personnalisée (public/ailes/dragodinde-3.png, volkorne-5.png…)
// remplace le SVG si elle existe ; sinon l'aile vectorielle graduée prend le
// relais.
function AileNiveau({ style = "muldo", miroir = false, taille = 22, niveau = 1 }) {
  const [imageKo, setImageKo] = useState(false);
  const n = Math.max(1, Math.min(5, Number(niveau) || 1));
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
  const n = Math.max(1, Math.min(5, Number(niveau) || 1));
  const base = `ailes/${style}-${n}`;
  const h = Math.round(taille * (1 + (n - 1) * 0.16));
  const ombre = `drop-shadow(0 0 ${2 + n}px ${(HALO_AILES[style] || HALO_AILES.muldo)}.4))`;

  if (etat === "dedie") {
    return (
      <img
        src={`${base}-${cote}.png`}
        alt=""
        onError={() => setEtat("moitie")}
        style={{ height: h, width: "auto", verticalAlign: "middle", filter: ombre }}
      />
    );
  }
  if (etat === "moitie") {
    return (
      <span style={{ display: "inline-block", width: h * 0.6, height: h, overflow: "hidden", verticalAlign: "middle" }}>
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
  const n = Math.max(1, Math.min(5, Number(niveau) || 1));
  const base = ORNEMENT_AILES[styleAiles] || ORNEMENT_AILES.muldo;
  const ornement = n >= 5 ? `✧${base}✧` : n >= 3 ? `${base}${base}` : base;
  const degrade = DEGRADE_AILES[styleAiles] || DEGRADE_AILES.muldo;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={`Soutien du Registre — ${nomNiveauAiles(styleAiles, n)} (niveau ${n})`}>
      <DemiAile style={styleAiles} cote="gauche" taille={taille} niveau={n} />
      <span style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: .4,
        background: degrade,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}>
        {ornement} {pseudo} {ornement}
      </span>
      <DemiAile style={styleAiles} cote="droite" taille={taille} niveau={n} />
    </span>
  );
}

// Barème sur 5 paliers : 5, 8, 12, 16 et 20 €.
const MONTANTS_NIVEAUX = [5, 8, 12, 16, 20];
function montantPourNiveau(niveau) {
  const n = Math.max(1, Math.min(5, Number(niveau) || 1));
  return MONTANTS_NIVEAUX[n - 1];
}

function SoutienPanel({ profil, setProfil }) {
  const set = (patch) => setProfil({ ...profil, ...patch });
  const niveau = Math.max(1, Math.min(5, Number(profil.niveauAiles) || 1));
  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Soutien du projet</h2>
        {profil.soutien && <PseudoAvecAiles pseudo={profil.pseudo || "Éleveur"} soutien styleAiles={profil.styleAiles} niveau={niveau} taille={32} />}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
        Le Registre restera utilisable gratuitement. Les soutiens gagnent leurs ailes selon leur don, en
        cinq paliers de 5 à 20 € — trois styles au choix : Dragodinde, Muldo (débloqué aussi par succès de
        génération) et Volkorne.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Pseudo d'éleveur</div>
          <input
            className="field"
            placeholder="Ton pseudo…"
            maxLength={20}
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
                title={style === "muldo" ? "Aperçu local — en vrai, débloquées par palier de don ET succès de génération" : undefined}
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
            max={5}
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
          <span style={{ color: "var(--gold2)", fontSize: 11, fontWeight: 700 }}>{nomNiveauAiles("dragodinde", niveau)}</span>
        </div>
        <PseudoAvecAiles pseudo={profil.pseudo || "Éleveur"} soutien styleAiles={profil.styleAiles} niveau={niveau} taille={40} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <AileNiveau style="muldo" taille={90} niveau={niveau} />
          <span style={{ color: "var(--cyan)", fontSize: 11, fontWeight: 700 }}>{nomNiveauAiles("muldo", niveau)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <AileNiveau style="volkorne" taille={90} niveau={niveau} />
          <span style={{ color: "#e87832", fontSize: 11, fontWeight: 700 }}>{nomNiveauAiles("volkorne", niveau)}</span>
        </div>
        <span style={{ color: "var(--muted)", fontSize: 11, alignSelf: "center" }}>
          Dépose tes visuels dans public/ailes/ (dragodinde-1.png … volkorne-5.png) pour remplacer les dessins.
        </span>
      </div>
    </div>
  );
}

const CLES_SAUVEGARDE = [
  STORAGE_KEY,
  STORAGE_HISTORY_KEY,
  STORAGE_SYNC_KEY,
  STORAGE_GPS_SESSION,
  STORAGE_NAISSANCES,
  STORAGE_PRIX_KAMAS,
  STORAGE_JOURNAL,
  STORAGE_INSTANTANES,
  STORAGE_PROFIL,
  STORAGE_CORBEILLE,
  STORAGE_PRIX_KAMAS_DRAGODINDE,
  STORAGE_PRIX_KAMAS_VOLKORNE,
  ...CLES_SAUVEGARDE_DRAGODINDE,
  ...CLES_SAUVEGARDE_VOLKORNE,
];

function SauvegardePanel({ showToast }) {
  const exporter = () => {
    flushToutesEcrituresDebattues();
    const donnees = {};
    CLES_SAUVEGARDE.forEach((cle) => {
      const valeur = localStorage.getItem(cle);
      if (valeur !== null) donnees[cle] = valeur;
    });
    const contenu = JSON.stringify({ format: "muldo-manager", version: 1, date: new Date().toISOString(), donnees }, null, 2);
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
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        const parsed = JSON.parse(String(lecteur.result));
        if (parsed?.format !== "muldo-manager" || !parsed.donnees || typeof parsed.donnees !== "object") {
          showToast("Fichier invalide : ce n'est pas une sauvegarde de cet outil.");
          return;
        }
        let restaurees = 0;
        CLES_SAUVEGARDE.forEach((cle) => {
          if (typeof parsed.donnees[cle] === "string") {
            localStorage.setItem(cle, parsed.donnees[cle]);
            restaurees += 1;
          }
        });
        if (!restaurees) {
          showToast("Sauvegarde vide : rien à restaurer.");
          return;
        }
        // Rechargement : toute l'appli se réhydrate depuis le stockage restauré.
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
            Tout vit dans le stockage de CE navigateur : exporte régulièrement un fichier JSON
            (cheptel, généalogies, naissances, journal, prix, scans). L'import restaure tout et recharge la page.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-coral" onClick={exporter}>Exporter</button>
          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            Importer…
            <input type="file" accept="application/json,.json" onChange={importer} style={{ display: "none" }} />
          </label>
        </div>
      </div>
    </div>
  );
}



