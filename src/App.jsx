import React, { useState, useEffect, useMemo, useCallback } from "react";
import { chargerJSON, sauvegarderJSON, creerEcritureDebattue, flushToutesEcrituresDebattues } from "./stockage.js";
import { pushSupporte, abonnementPushActuel, activerNotificationsPush, desactiverNotificationsPush } from "./pushNotifications.js";
import { CorbeillePanel, ArbreGenealogiquePanel, StatsCroisementsPanel, BebesARenommerPanel, copierPressePapiers, exporterFicheImage, GpsDofusPage } from "./panneauxElevage.jsx";
import { supabase } from "./supabaseClient.js";
import { supabaseEstConfigure, LIEN_DON } from "./configSupabase.js";
import { Plus, Trash2, Waves, Heart, Zap, Sparkles, Droplets, AlertTriangle, X, Skull, Baby, Save } from "lucide-react";
import {
  useDragodindeElevage, DragodindeCheptelListPane, DragodindeCheptelMainPane,
  DragodindeSynchronisationPage, DragodindeGpsPage, DragodindeClonagePage, DragodindeSuccesPage,
  CLES_SAUVEGARDE_DRAGODINDE, generationDeCouleurDragodinde, sexeDragodinde, plierCouleurDragodinde,
} from "./Dragodinde.jsx";
import {
  useVolkorneElevage, VolkorneCheptelListPane, VolkorneCheptelMainPane,
  VolkorneSynchronisationPage, VolkorneGpsPage, VolkorneClonagePage, VolkorneSuccesPage,
  CLES_SAUVEGARDE_VOLKORNE, generationDeCouleurVolkorne, sexeVolkorne, plierCouleurVolkorne,
} from "./Volkorne.jsx";
import {
  COLORS, COULEURS_MULDO, GENERATION_10_MULDO, OBJECTIFS_COULEURS, CAPACITES_MULDO,
  capacitesMuldo, normaliserMuldo, FATIGUE_OBSOLETE, STOCK_INITIAL_COULEURS,
  RECETTES_SPECIALES_MULDO, RECETTES_COULEURS, recettesPourCouleur, recettesBicoloreAuto,
  GENERATIONS_MULDO, couleursGenerationJusqua, plierCouleur, indexCouleursCanoniques,
  canonicaliserCouleur, distanceLevenshtein, toleranceOCR, correspondanceFloue,
  clesMonocoloresPliees, couleurEstCanonique, stockCouleurDisponible,
  meilleureRecettePourCouleur, construireEtapesPourCouleur, generationDeCouleur,
  CHEPTEL_INITIAL_AUTO, sexeMuldo, reproRestantesMuldo, muldoReproductible,
  couleurPresenteCheptel, chercherCouplePourRecette, construirePlanPourCouleur,
  analyserGenerationCible, cleCoupleCouleurs, toutesLesRecettesProgression,
  RESULTATS_PAR_COUPLE, couleursNaissancePossibles, genererNomCourt, couleursAncetres,
  distancesVersObjectif, construireCheminVersObjectif, distancesEtParentsVersObjectif,
  construireArbreCouples, scoreCoupleObjectif, affectationMaximale,
  optimiserSessionAccouplements, progressionParGeneration, plusHauteGenerationValidee,
  tierAilesMuldo, choisirObjectifGpsAutomatique, ancestorSet, collisionScore,
  collisionLabel, readinessScore, getNextAction, isBreedReady, generationGoalScore,
  geneticPartners,
} from "./muldoGenetique.js";
import {
  normaliserTexteOCR, extraireNombreDansLigne, analyserTexteCaptureMuldo,
  stockMF, analyseRecettesPourCible, actionsAvecCouleur,
} from "./muldoOCR.js";


const STATUTS = ["Fertile", "Féconde", "Stérile", "Sénile"];
const JAUGES = [
  { key: "amour", label: "Amour", icon: Heart },
  { key: "endurance", label: "Endurance", icon: Zap },
  { key: "maturite", label: "Maturité", icon: Sparkles },
  { key: "serenite", label: "Sérénité", icon: Droplets },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = "cheptel-muldos-v1";
const STORAGE_HISTORY_KEY = "muldo-historique-couleurs-v1";
const STORAGE_SYNC_KEY = "muldo-synchronisation-filtres-v1";
const STORAGE_GPS_SESSION = "gps-session-v1";
const STORAGE_NAISSANCES = "muldo-naissances-attente-v1";
const STORAGE_PRIX_KAMAS = "muldo-prix-kamas-v1";
const STORAGE_PRIX_KAMAS_DRAGODINDE = "dragodinde-prix-kamas-v1";
const STORAGE_PRIX_KAMAS_VOLKORNE = "volkorne-prix-kamas-v1";
const STORAGE_JOURNAL = "muldo-journal-naissances-v1";
const STORAGE_INSTANTANES = "muldo-instantanes-v1";
const STORAGE_PROFIL = "muldo-profil-v1";
const STORAGE_CORBEILLE = "muldo-corbeille-v1";
const CORBEILLE_DUREE_JOURS = 30;


// ---------- composant principal ----------
export default function App() {
  const [cheptel, setCheptel] = useState(CHEPTEL_INITIAL_AUTO);
  const [selectedId, setSelectedId] = useState(null);
  const [ficheRapideId, setFicheRapideId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState(null);
  const [couleurCible, setCouleurCible] = useState("Prune");
  const [fusionA, setFusionA] = useState("");
  const [fusionB, setFusionB] = useState("");
  const [stocksCouleurs, setStocksCouleurs] = useState(STOCK_INITIAL_COULEURS);
  const [captureText, setCaptureText] = useState("");
  const [capturePreview, setCapturePreview] = useState("");
  const [objectifGeneration, setObjectifGeneration] = useState(6);
  const [objectifGps, setObjectifGps] = useState("Prune");
  const [modeGps, setModeGps] = useState("couleur");
  const [generationGps, setGenerationGps] = useState(7);
  const [generationCollectionMin, setGenerationCollectionMin] = useState(2);
  const [generationCollectionMax, setGenerationCollectionMax] = useState(10);
  const [modePurification, setModePurification] = useState(false);
  const [optimakina, setOptimakina] = useState(false);
  const [niveauMinimumSession, setNiveauMinimumSession] = useState(0);
  const [historiqueCouleurs, setHistoriqueCouleurs] = useState({});
  const [page, setPage] = useState("dashboard");
  // Onglet actif à l'intérieur d'une section créature (Muldo/Dragodinde/Volkorne) :
  // "cheptel" | "synchro" | "gps" | "clonage". Partagé entre les 3, réinitialisé
  // implicitement en changeant de section (on ne mémorise pas par créature).
  const [sousPage, setSousPage] = useState("cheptel");
  // Créature affichée sur la page Succès (elle regroupe les 3 sous un seul onglet).
  const [succesCreature, setSuccesCreature] = useState("muldo");
  const [naissances, setNaissances] = useState([]);
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
  const eleveDragodinde = useDragodindeElevage();
  const eleveVolkorne = useVolkorneElevage();
  const [profilOuvert, setProfilOuvert] = useState(false);
  useEffect(() => { if (compte.pretMdp) setProfilOuvert(true); }, [compte.pretMdp]);
  // Pousse la génération muldo la plus haute validée vers le profil Supabase
  // (auto-déclaratif) dès qu'elle change — sert de condition de déblocage
  // des ailes "muldo", en plus du palier de don.
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const gen = plusHauteGenerationValidee(cheptel, historiqueCouleurs);
    if (compte.profil.succes_generation_muldo !== gen) {
      supabase.from("profils").update({ succes_generation_muldo: gen })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
  }, [cheptel, historiqueCouleurs, compte.session, compte.profil]);
  // Pousse le nombre de couleurs muldo découvertes vers le profil Supabase —
  // alimente le classement des éleveurs de la Taverne (auto-déclaratif, comme
  // succes_generation_muldo ci-dessus).
  useEffect(() => {
    if (!supabase || !compte.session?.user || !compte.profil) return;
    const nb = Object.values(historiqueCouleurs || {}).filter(Boolean).length;
    if (compte.profil.couleurs_decouvertes_muldo !== nb) {
      supabase.from("profils").update({ couleurs_decouvertes_muldo: nb })
        .eq("id", compte.session.user.id)
        .then(() => compte.rafraichirProfil());
    }
  }, [historiqueCouleurs, compte.session, compte.profil]);
  const [instantanes, setInstantanes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_INSTANTANES));
      return Array.isArray(saved) ? saved : [];
    } catch (e) {
      return [];
    }
  });
  const [journal, setJournal] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_JOURNAL));
      return Array.isArray(saved) ? saved : [];
    } catch (e) {
      return [];
    }
  });
  const [corbeille, setCorbeille] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_CORBEILLE));
      const limite = Date.now() - CORBEILLE_DUREE_JOURS * 24 * 60 * 60 * 1000;
      const purge = (Array.isArray(saved) ? saved : []).filter((e) => new Date(e.supprimeLe).getTime() > limite);
      localStorage.setItem(STORAGE_CORBEILLE, JSON.stringify(purge));
      return purge;
    } catch (e) {
      return [];
    }
  });
  const [gpsSuivi, setGpsSuivi] = useState({
    mode: "couleur",
    objectif: "Prune",
    purification: false,
    consommes: [],
    historique: [],
    totalInitial: 0,
  });

  const byId = useMemo(() => Object.fromEntries(cheptel.map((m) => [m.id, m])), [cheptel]);


  const fusionnerSteriles = (couleurChoisie, sexeChoisi) => {
    if (!fusionA || !fusionB || fusionA === fusionB) {
      setToast({ type: "error", msg: "Choisis deux muldos stériles différents." });
      return;
    }

    const parentA = byId[fusionA];
    const parentB = byId[fusionB];

    if (!parentA || !parentB) {
      setToast({ type: "error", msg: "Fusion impossible : muldo introuvable." });
      return;
    }

    // Règles du clonage (3.5) : deux montures de MÊME génération détruites →
    // une nouvelle Fertile d'une des deux couleurs, généalogie conservée,
    // capacités perdues, jauges remises à zéro.
    if (generationDeCouleur(parentA.couleur) !== generationDeCouleur(parentB.couleur)) {
      setToast({ type: "error", msg: "Clonage impossible : les deux muldos doivent être de la même génération." });
      return;
    }
    // Résultat réel saisi par l'utilisateur si fourni (page Clonage), sinon
    // tirage aléatoire (ancien panneau Cheptel, qui appelle sans argument).
    const couleurValide = typeof couleurChoisie === "string"
      && (couleurChoisie === parentA.couleur || couleurChoisie === parentB.couleur);
    const couleurResultat = couleurValide
      ? couleurChoisie
      : (Math.random() < 0.5 ? parentA : parentB).couleur;
    const sexeResultat = sexeChoisi === "M" ? "Mâle"
      : sexeChoisi === "F" ? "Femelle"
      : (Math.random() < 0.5 ? "Mâle" : "Femelle");
    const nomCourt = genererNomCourt(couleurResultat);
    const nouveau = {
      id: crypto.randomUUID(),
      nom: nomCourt,
      couleur: couleurResultat,
      generation: generationDeCouleur(couleurResultat),
      sexe: sexeResultat,
      statut: "Fertile",
      sterile: false,
      senile: false,
      capacites: [], // le clonage fait perdre les capacités
      amour: 0,
      endurance: 0,
      maturite: 0,
      serenite: 50,
      reproDone: 0,
      reproMax: 1,
      reproRestantes: 1,
      reproductionsRestantes: 1,
      parentIds: [parentA.id, parentB.id],
      parents: [parentA.id, parentB.id],
      note: `Clonage : ${parentA.nom || parentA.id} + ${parentB.nom || parentB.id}${couleurValide ? "" : " — résultat tiré au hasard, corrige couleur/sexe si besoin"}`,
    };
    copierPressePapiers(nomCourt);

    setCheptel((prev) => prev.filter((m) => m.id !== fusionA && m.id !== fusionB).concat(nouveau));
    setJournal((prev) => {
      const next = [...prev, {
        date: new Date().toISOString(),
        type: "clonage",
        male: parentA.couleur,
        femelle: parentB.couleur,
        espere: null,
        obtenu: couleurResultat,
        sexe: sexeResultat === "Femelle" ? "F" : "M",
        nom: nomCourt,
      }];
      try {
        localStorage.setItem(STORAGE_JOURNAL, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
    setFusionA("");
    setFusionB("");
    setToast({ type: "success", msg: `Clonage effectué : ${nouveau.couleur} fertile créé — renomme-le « ${nouveau.nom} » en jeu (copié). Capacités perdues, jauges à zéro.` });
  };

  const selected = selectedId ? byId[selectedId] : null;
  // Ouvre la fiche d'un muldo directement là où on se trouve (GPS, Clonage,
  // Dashboard, Synchronisation…) au lieu de forcer une navigation vers Cheptel.
  const voirMuldo = (id) => setFicheRapideId(id);
  const ficheRapide = ficheRapideId ? byId[ficheRapideId] : null;

  const analyseCible = useMemo(() => analyseRecettesPourCible(couleurCible, cheptel), [couleurCible, cheptel]);
  const actionsSelection = useMemo(() => selected ? actionsAvecCouleur(selected.couleur, cheptel) : [], [selected, cheptel]);

  const importCapture = useMemo(() => analyserTexteCaptureMuldo(captureText), [captureText]);

  const importerCaptureDansCheptel = () => {
    if (importCapture.length === 0) {
      setToast({ type: "error", msg: "Aucune couleur reconnue dans le texte de la capture." });
      return;
    }

    const nouveaux = [];
    let index = 1;

    importCapture.forEach((ligne) => {
      const total = ligne.male + ligne.femelle + ligne.inconnu;

      for (let i = 0; i < total; i += 1) {
        let sexe = "Femelle";
        if (i < ligne.male) sexe = "Mâle";
        else if (i < ligne.male + ligne.femelle) sexe = "Femelle";
        else sexe = i % 2 === 0 ? "Mâle" : "Femelle";

        nouveaux.push({
          id: crypto.randomUUID(),
          nom: `Import capture ${ligne.couleur} #${index}`,
          sexe,
          couleur: ligne.couleur,
          generation: generationDeCouleur(ligne.couleur),
          statut: "Fertile",
          sterile: false,
          capacites: [],
          capacite1: "Aucune",
          capacite2: "Aucune",
          reproductrice: false,
          reproDone: 0,
          reproMax: 1,
          reproRestantes: 1,
          reproductionsRestantes: 1,
          amour: 100,
          endurance: 100,
          maturite: 100,
          serenite: 50,
          note: "Créé depuis une capture importée. Sexe à vérifier si l'OCR n'était pas clair.",
        });
        index += 1;
      }
    });

    setCheptel((prev) => prev.concat(nouveaux));
    setStocksCouleurs((prev) => {
      const next = { ...prev };
      importCapture.forEach((ligne) => {
        next[ligne.couleur] = Number(next[ligne.couleur] || 0) + ligne.total;
      });
      return next;
    });

    setToast({ type: "success", msg: `${nouveaux.length} muldo(s) importé(s) depuis la capture.` });
  };


  const stockComplet = useMemo(() => {
    const comptageCheptel = cheptel.reduce((acc, m) => {
      acc[m.couleur] = (acc[m.couleur] || 0) + 1;
      return acc;
    }, {});

    return Object.fromEntries(
      COULEURS_MULDO.map((couleur) => [
        couleur,
        Math.max(Number(stocksCouleurs[couleur] || 0), Number(comptageCheptel[couleur] || 0)),
      ])
    );
  }, [cheptel, stocksCouleurs]);


  const planGeneration = useMemo(() => analyserGenerationCible(objectifGeneration, cheptel, byId, historiqueCouleurs), [objectifGeneration, cheptel, byId, historiqueCouleurs]);

  const progressionGps = useMemo(
    () => progressionParGeneration(cheptel, historiqueCouleurs),
    [cheptel, historiqueCouleurs]
  );

  const choixObjectifGps = useMemo(
    () => choisirObjectifGpsAutomatique({
      mode: modeGps,
      objectifCouleur: objectifGps,
      generationCible: generationGps,
      generationMin: generationCollectionMin,
      generationMax: generationCollectionMax,
      cheptel,
      historiqueCouleurs,
    }),
    [
      modeGps,
      objectifGps,
      generationGps,
      generationCollectionMin,
      generationCollectionMax,
      cheptel,
      historiqueCouleurs,
    ]
  );

  const objectifGpsActif = choixObjectifGps.objectif || objectifGps;

  const gpsSuiviActif = gpsSuivi.mode === modeGps
    && gpsSuivi.objectif === objectifGpsActif
    && gpsSuivi.purification === modePurification
    ? gpsSuivi
    : {
        mode: modeGps,
        objectif: objectifGpsActif,
        purification: modePurification,
        consommes: [],
        historique: [],
        totalInitial: 0,
      };

  const cheptelGpsDisponible = useMemo(() => {
    const idsConsommes = new Set(gpsSuiviActif.consommes || []);
    return cheptel.filter((m) => !idsConsommes.has(m.id));
  }, [cheptel, gpsSuiviActif.consommes]);

  const sessionGps = useMemo(
    () => optimiserSessionAccouplements(cheptelGpsDisponible, objectifGpsActif, modePurification, optimakina, niveauMinimumSession),
    [cheptelGpsDisponible, objectifGpsActif, modePurification, optimakina, niveauMinimumSession]
  );

  const sauvegarderSuiviGps = useCallback((next) => {
    setGpsSuivi(next);
    try {
      localStorage.setItem(STORAGE_GPS_SESSION, JSON.stringify(next));
    } catch (e) {
      console.error("Erreur de sauvegarde de la session GPS", e);
    }
  }, []);

  const synchroniserContexteGps = useCallback(() => {
    if (
      gpsSuivi.mode === modeGps
      && gpsSuivi.objectif === objectifGpsActif
      && gpsSuivi.purification === modePurification
    ) return;

    const totalInitial = optimiserSessionAccouplements(
      cheptel,
      objectifGpsActif,
      modePurification
    ).couples.length;

    sauvegarderSuiviGps({
      mode: modeGps,
      objectif: objectifGpsActif,
      purification: modePurification,
      consommes: [],
      historique: [],
      totalInitial,
    });
  }, [
    gpsSuivi.mode,
    gpsSuivi.objectif,
    gpsSuivi.purification,
    modeGps,
    objectifGpsActif,
    modePurification,
    cheptel,
    sauvegarderSuiviGps,
  ]);

  const realiserCouplesGps = useCallback((couplesARealiser) => {
    synchroniserContexteGps();
    setGpsSuivi((prev) => {
      const contexteValide = prev.mode === modeGps
        && prev.objectif === objectifGpsActif
        && prev.purification === modePurification;

      const base = contexteValide
        ? prev
        : {
            mode: modeGps,
            objectif: objectifGpsActif,
            purification: modePurification,
            consommes: [],
            historique: [],
            totalInitial: optimiserSessionAccouplements(
              cheptel,
              objectifGpsActif,
              modePurification
            ).couples.length,
          };

      const deja = new Set(base.consommes || []);
      const nouvellesPaires = [];
      (couplesARealiser || []).forEach((c) => {
        if (!c?.male?.id || !c?.femelle?.id) return;
        if (deja.has(c.male.id) || deja.has(c.femelle.id)) return;
        deja.add(c.male.id);
        deja.add(c.femelle.id);
        nouvellesPaires.push([c.male.id, c.femelle.id]);
      });

      const next = {
        ...base,
        consommes: [...deja],
        historique: [...(base.historique || []), ...nouvellesPaires],
        totalInitial: base.totalInitial || optimiserSessionAccouplements(
          cheptel,
          objectifGpsActif,
          modePurification
        ).couples.length,
      };

      try {
        localStorage.setItem(STORAGE_GPS_SESSION, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    // Chaque couple réalisé ouvre une naissance à confirmer (immédiate et
    // garantie depuis la 3.5) : le croisement ne donne pas forcément le
    // résultat de la recette, donc on attend la saisie du résultat réel.
    setNaissances((prev) => {
      const dejaPaires = new Set(prev.map((n) => `${n.maleId}|${n.femelleId}`));
      const ajouts = (couplesARealiser || [])
        .filter((c) => c?.male?.id && c?.femelle?.id && !dejaPaires.has(`${c.male.id}|${c.femelle.id}`))
        .map((c) => ({
          id: uid(),
          maleId: c.male.id,
          femelleId: c.femelle.id,
          maleNom: c.male.nom || c.male.couleur,
          femelleNom: c.femelle.nom || c.femelle.couleur,
          maleCouleur: c.male.couleur,
          femelleCouleur: c.femelle.couleur,
          resultatEspere: c.resultat || null,
          possibles: [...new Set([
            ...couleursNaissancePossibles(c.male.couleur, c.femelle.couleur),
            ...couleursAncetres(c.male, cheptel),
            ...couleursAncetres(c.femelle, cheptel),
          ])],
          date: new Date().toISOString(),
        }));
      if (!ajouts.length) return prev;
      const suivant = [...prev, ...ajouts];
      try {
        localStorage.setItem(STORAGE_NAISSANCES, JSON.stringify(suivant));
      } catch (e) {
        console.error(e);
      }
      return suivant;
    });
  }, [
    cheptel,
    modeGps,
    objectifGpsActif,
    modePurification,
    synchroniserContexteGps,
  ]);

  const annulerDernierCoupleGps = useCallback(() => {
    setGpsSuivi((prev) => {
      if (
        prev.mode !== modeGps
        || prev.objectif !== objectifGpsActif
        || prev.purification !== modePurification
        || !(prev.historique || []).length
      ) return prev;

      const historique = [...prev.historique];
      const dernierePaire = historique.pop();
      const aRetirer = new Set(dernierePaire || []);
      const next = {
        ...prev,
        historique,
        consommes: (prev.consommes || []).filter((id) => !aRetirer.has(id)),
      };
      try {
        localStorage.setItem(STORAGE_GPS_SESSION, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }

      // Retire aussi la naissance en attente correspondant à ce couple annulé.
      const [maleId, femelleId] = dernierePaire || [];
      setNaissances((anciennes) => {
        const suivantes = anciennes.filter((n) => !(n.maleId === maleId && n.femelleId === femelleId));
        if (suivantes.length === anciennes.length) return anciennes;
        try {
          localStorage.setItem(STORAGE_NAISSANCES, JSON.stringify(suivantes));
        } catch (e) {
          console.error(e);
        }
        return suivantes;
      });

      return next;
    });
  }, [modeGps, objectifGpsActif, modePurification]);

  const reinitialiserSessionGps = useCallback(() => {
    const totalInitial = optimiserSessionAccouplements(
      cheptel,
      objectifGpsActif,
      modePurification
    ).couples.length;
    sauvegarderSuiviGps({
      mode: modeGps,
      objectif: objectifGpsActif,
      purification: modePurification,
      consommes: [],
      historique: [],
      totalInitial,
    });
  }, [
    cheptel,
    modeGps,
    objectifGpsActif,
    modePurification,
    sauvegarderSuiviGps,
  ]);

  const objectifsCouleurs = useMemo(() => {
    return OBJECTIFS_COULEURS.map((couleur) => {
      const recettes = RECETTES_COULEURS[couleur] || [];
      const possedes = stockComplet[couleur] || 0;

      const recettesAnalysees = recettes.map((recette) => {
        const dispoParents = recette.map((p) => ({
          couleur: p,
          stock: stockComplet[p] || 0,
        }));

        return {
          parents: recette,
          dispoParents,
          faisable: dispoParents.every((p) => p.stock > 0),
        };
      });

      const faisable = recettesAnalysees.some((r) => r.faisable);

      return {
        couleur,
        possedes,
        recettes: recettesAnalysees,
        faisable,
        status: possedes > 0 ? "obtenu" : faisable ? "possible" : "bloque",
      };
    });
  }, [stockComplet]);

  const prochainObjectif = useMemo(() => {
    return objectifsCouleurs.find((o) => o.status === "possible")
      || objectifsCouleurs.find((o) => o.status === "bloque")
      || null;
  }, [objectifsCouleurs]);

  const enregistrerHistoriqueCouleurs = useCallback((nextHistory) => {
    setHistoriqueCouleurs(nextHistory);
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(nextHistory));
    } catch (e) {
      console.error("Erreur de sauvegarde historique couleurs", e);
    }
  }, []);

  const basculerCouleurHistorique = useCallback((couleur, active) => {
    setHistoriqueCouleurs((prev) => {
      const next = { ...prev };
      if (active) next[couleur] = true;
      else delete next[couleur];
      try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Erreur de sauvegarde historique couleurs", e);
      }
      return next;
    });
  }, []);

  const validerGenerationHistorique = useCallback((generation) => {
    setHistoriqueCouleurs((prev) => {
      const next = { ...prev };
      (GENERATIONS_MULDO[generation] || []).forEach((couleur) => { next[couleur] = true; });
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const validerToutHistorique = useCallback(() => {
    const next = {};
    Object.values(GENERATIONS_MULDO).flat().forEach((couleur) => { next[couleur] = true; });
    enregistrerHistoriqueCouleurs(next);
  }, [enregistrerHistoriqueCouleurs]);

  const reinitialiserHistoriqueManuel = useCallback(() => {
    const next = {};
    cheptel.forEach((m) => { if (m.couleur) next[m.couleur] = true; });
    enregistrerHistoriqueCouleurs(next);
  }, [cheptel, enregistrerHistoriqueCouleurs]);

  // chargement initial
  useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  const savedHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
  const savedGpsSession = localStorage.getItem(STORAGE_GPS_SESSION);
  const savedNaissances = localStorage.getItem(STORAGE_NAISSANCES);

  if (savedNaissances) {
    try {
      const parsed = JSON.parse(savedNaissances);
      if (Array.isArray(parsed)) setNaissances(parsed);
    } catch (e) {
      console.error("Naissances en attente illisibles", e);
    }
  }

  if (saved) {
    try {
      const parsedCheptel = JSON.parse(saved);
      if (Array.isArray(parsedCheptel)) setCheptel(parsedCheptel.map(normaliserMuldo));
    } catch (e) {
      console.error("Cheptel illisible", e);
    }
  }

  if (savedHistory) {
    try {
      const parsedHistory = JSON.parse(savedHistory);
      if (parsedHistory && typeof parsedHistory === "object") setHistoriqueCouleurs(parsedHistory);
    } catch (e) {
      console.error("Historique des couleurs illisible", e);
    }
  }

  if (savedGpsSession) {
    try {
      const parsed = JSON.parse(savedGpsSession);
      setGpsSuivi({
        mode: parsed.mode || "couleur",
        objectif: parsed.objectif || "Prune",
        purification: Boolean(parsed.purification),
        consommes: Array.isArray(parsed.consommes) ? parsed.consommes : [],
        historique: Array.isArray(parsed.historique) ? parsed.historique : [],
        totalInitial: Number(parsed.totalInitial || 0),
      });
    } catch (e) {
      console.error("Session GPS illisible", e);
    }
  }

  setLoading(false);
}, []);

useEffect(() => {
  if (loading) return;

  setHistoriqueCouleurs((prev) => {
    const next = { ...prev };
    cheptel.forEach((m) => {
      if (m.couleur) next[m.couleur] = true;
    });

    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erreur de sauvegarde historique couleurs", e);
    }

    return next;
  });
}, [cheptel, loading]);

const ecrireCheptelDebattue = useMemo(() => creerEcritureDebattue(STORAGE_KEY), []);
  const persist = useCallback(async (next) => {
    setSaving(true);
    ecrireCheptelDebattue(next);
    setSaving(false);
  }, [ecrireCheptelDebattue]);

  const updateCheptel = useCallback((updater) => {
    setCheptel((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      return next;
    });
  }, [persist]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Instantané quotidien pour la courbe de progression : un point par jour,
  // pris dès que le cheptel est chargé (limité aux 365 derniers).
  useEffect(() => {
    if (!cheptel.length) return;
    const aujourdhui = new Date().toISOString().slice(0, 10);
    setInstantanes((prev) => {
      const point = {
        date: aujourdhui,
        total: cheptel.length,
        fertiles: cheptel.filter(muldoReproductible).length,
        couleurs: new Set(cheptel.map((m) => m.couleur)).size,
        naissances: journal.length,
      };
      const dernier = prev[prev.length - 1];
      // Le point du jour suit les changements de la journée (dernière valeur gagne).
      if (dernier && dernier.date === aujourdhui) {
        if (dernier.total === point.total && dernier.fertiles === point.fertiles
          && dernier.couleurs === point.couleurs && dernier.naissances === point.naissances) return prev;
        const next = [...prev.slice(0, -1), point];
        try {
          localStorage.setItem(STORAGE_INSTANTANES, JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      }
      const next = [...prev, point].slice(-365);
      try {
        localStorage.setItem(STORAGE_INSTANTANES, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, [cheptel, journal.length]);

  const persisterNaissances = (next) => {
    try {
      localStorage.setItem(STORAGE_NAISSANCES, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };

  // Naissance confirmée en jeu : on enregistre la couleur RÉELLEMENT obtenue
  // (pas forcément le résultat de la recette) et le sexe, on ajoute le bébé au
  // cheptel avec sa généalogie, et on consomme la reproduction des parents.
  const confirmerNaissance = (naissanceId, couleurChoisie, sexe, encoreUnBebe = false) => {
    const n = naissances.find((x) => x.id === naissanceId);
    if (!n || !couleurChoisie || !sexe) return;
    const couleur = canonicaliserCouleur(couleurChoisie);
    const nomCourt = genererNomCourt(couleur);
    const bebe = normaliserMuldo({
      id: uid(),
      nom: nomCourt,
      sexe,
      couleur,
      generation: generationDeCouleur(couleur),
      statut: "Fertile",
      sterile: false,
      capacites: [],
      amour: 0,
      endurance: 0,
      maturite: 0,
      serenite: 50,
      parentIds: [n.maleId, n.femelleId],
      notes: `Né(e) ${new Date().toLocaleDateString("fr-FR")} · parents : ${n.maleNom} × ${n.femelleNom}${n.resultatEspere && n.resultatEspere !== couleur ? ` · résultat espéré : ${n.resultatEspere}` : ""}`,
      dateAjout: new Date().toISOString(),
    });
    updateCheptel((prev) => [
      ...prev.map((m) => (m.id === n.maleId || m.id === n.femelleId)
        ? { ...m, reproDone: 1, reproMax: 1, reproRestantes: 0, reproductionsRestantes: 0, sterile: true, statut: "Stérile" }
        : m),
      bebe,
    ]);
    setNaissances((prev) => {
      // Capacité Reproducteur : la portée peut compter 2 bébés. On garde alors
      // l'entrée pour saisir le second (couleur et sexe indépendants).
      const next = encoreUnBebe
        ? prev.map((x) => (x.id === naissanceId ? { ...x, second: true } : x))
        : prev.filter((x) => x.id !== naissanceId);
      persisterNaissances(next);
      return next;
    });
    setJournal((prev) => {
      const next = [...prev, {
        date: new Date().toISOString(),
        male: n.maleCouleur,
        femelle: n.femelleCouleur,
        espere: n.resultatEspere || null,
        obtenu: couleur,
        sexe,
        nom: nomCourt,
      }];
      try {
        localStorage.setItem(STORAGE_JOURNAL, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
    copierPressePapiers(nomCourt);
    showToast(`${encoreUnBebe ? "Bébé 1/2 enregistré" : "Naissance enregistrée"} : ${couleur} ${sexe === "F" ? "♀" : "♂"} — renomme-le « ${nomCourt} » en jeu (déjà copié)${encoreUnBebe ? ". Confirme maintenant le 2e bébé." : ""}`);
  };

  const supprimerNaissance = (naissanceId) => {
    setNaissances((prev) => {
      const next = prev.filter((x) => x.id !== naissanceId);
      persisterNaissances(next);
      return next;
    });
  };

  const addMuldo = (data) => {
    const m = {
      id: uid(),
      nom: data.nom || "Sans nom",
      sexe: data.sexe || "F",
      couleur: data.couleur || COULEURS_MULDO[0],
      generation: Number(data.generation) || 1,
      statut: data.statut || "Fertile",
      sterile: data.statut === "Stérile",
      capacites: (data.capacites || []).filter((c) => c && c !== "Aucune").slice(0, 2),
      capacite1: data.capacites?.[0] || "Aucune",
      capacite2: data.capacites?.[1] || "Aucune",
      reproductrice: (data.capacites || []).includes("Reproductrice"),
      amour: 0, endurance: 0, maturite: 0, serenite: 50, fatigue: 0,
      reproDone: data.statut === "Stérile" ? 1 : 0,
      reproMax: 1,
      reproRestantes: data.statut === "Stérile" ? 0 : 1,
      reproductionsRestantes: data.statut === "Stérile" ? 0 : 1,
      parentIds: data.parentIds || [],
      notes: "",
      dateAjout: new Date().toISOString(),
    };
    updateCheptel((prev) => [...prev, m]);
    setSelectedId(m.id);
    copierPressePapiers(m.nom);
    setJournal((prev) => {
      const next = [...prev, {
        date: new Date().toISOString(),
        type: "ajout",
        male: null,
        femelle: null,
        espere: null,
        obtenu: m.couleur,
        sexe: sexeMuldo(m) || m.sexe,
        nom: m.nom,
      }];
      try {
        localStorage.setItem(STORAGE_JOURNAL, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
    showToast(`${m.nom} ajouté au cheptel — nom copié pour le renommage en jeu (Ctrl+V).`);
    setShowNew(false);
  };

  const patchMuldo = (id, patch) => {
    updateCheptel((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const deleteMuldo = (id) => {
    const muldo = byId[id];
    updateCheptel((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (muldo) {
      setCorbeille((prev) => {
        const next = [{ muldo, supprimeLe: new Date().toISOString() }, ...prev].slice(0, 100);
        try { localStorage.setItem(STORAGE_CORBEILLE, JSON.stringify(next)); } catch (e) { console.error(e); }
        return next;
      });
    }
  };

  const restaurerMuldo = (id) => {
    const entree = corbeille.find((e) => e.muldo.id === id);
    if (!entree) return;
    updateCheptel((prev) => [...prev, entree.muldo]);
    setCorbeille((prev) => {
      const next = prev.filter((e) => e.muldo.id !== id);
      try { localStorage.setItem(STORAGE_CORBEILLE, JSON.stringify(next)); } catch (e) { console.error(e); }
      return next;
    });
  };

  const purgerCorbeilleEntree = (id) => {
    setCorbeille((prev) => {
      const next = prev.filter((e) => e.muldo.id !== id);
      try { localStorage.setItem(STORAGE_CORBEILLE, JSON.stringify(next)); } catch (e) { console.error(e); }
      return next;
    });
  };

  const viderCorbeille = () => {
    if (!window.confirm("Vider définitivement la corbeille ? Cette action est irréversible.")) return;
    setCorbeille(() => {
      try { localStorage.setItem(STORAGE_CORBEILLE, JSON.stringify([])); } catch (e) { console.error(e); }
      return [];
    });
  };

  // Raccourci de début de session : bascule en masse tous les "Féconde"
  // (repos terminé côté jeu) vers "Fertile", puis relance le plan GPS —
  // évite de repasser un par un sur chaque fiche avant chaque session.
  const demarrerNouvelleSessionAccouplement = () => {
    const nb = cheptel.filter((m) => m.statut === "Féconde").length;
    if (nb > 0) {
      updateCheptel((prev) => prev.map((m) => (m.statut === "Féconde" ? { ...m, statut: "Fertile" } : m)));
    }
    reinitialiserSessionGps();
    showToast(nb > 0 ? `${nb} muldo(s) passé(s) en Fertile — nouvelle session lancée.` : "Nouvelle session lancée.");
  };

  // Remise à zéro après un suivi de clonage/session mal tenu : les stériles
  // partent à la corbeille (jamais de suppression définitive directe, comme
  // pour deleteMuldo) et tout le reste repasse Fertile, prêt à s'accoupler.
  const nettoyerSterilesPuisDemarrerSession = (forcerJauges = false) => {
    const steriles = cheptel.filter((m) => m.sterile === true || m.statut === "Stérile");
    const restants = cheptel.filter((m) => !(m.sterile === true || m.statut === "Stérile"));

    if (steriles.length) {
      setCorbeille((prev) => {
        const next = [
          ...steriles.map((muldo) => ({ muldo, supprimeLe: new Date().toISOString() })),
          ...prev,
        ].slice(0, 100);
        try { localStorage.setItem(STORAGE_CORBEILLE, JSON.stringify(next)); } catch (e) { console.error(e); }
        return next;
      });
      if (selectedId && steriles.some((m) => m.id === selectedId)) setSelectedId(null);
    }

    updateCheptel(() => restants.map((m) => ({
      ...m,
      statut: "Fertile",
      sterile: false,
      reproDone: 0,
      reproRestantes: 1,
      reproductionsRestantes: 1,
      ...(forcerJauges ? { amour: 100, endurance: 100, maturite: 100 } : {}),
    })));

    reinitialiserSessionGps();
    const suffixeJauges = forcerJauges ? " (jauges amour/endurance/maturité forcées à 100 — donnée fictive, à corriger si besoin)" : "";
    showToast(
      steriles.length
        ? `${steriles.length} muldo(s) stérile(s) mis à la corbeille, ${restants.length} repassé(s) Fertile${suffixeJauges} — nouvelle session lancée.`
        : `${restants.length} muldo(s) repassé(s) Fertile${suffixeJauges} — nouvelle session lancée.`
    );
  };

  const registerBirth = (parentAId, parentBId) => {
    const a = byId[parentAId], b = byId[parentBId];
    if (!a || !b) return;
    const child = {
      id: uid(),
      nom: `${a.couleur[0]}${b.couleur[0]}-${uid().slice(0, 4)}`,
      sexe: Math.random() > 0.5 ? "F" : "M",
      couleur: Math.random() > 0.5 ? a.couleur : b.couleur,
      generation: Math.max(a.generation, b.generation) + 1,
      statut: "Fertile",
      sterile: false,
      capacites: [],
      capacite1: "Aucune",
      capacite2: "Aucune",
      reproductrice: false,
      amour: 0, endurance: 0, maturite: 0, serenite: 50, fatigue: 0,
      reproDone: 0,
      reproMax: 1,
      reproRestantes: 1,
      reproductionsRestantes: 1,
      parentIds: [a.id, b.id],
      notes: "Issu d'un accouplement enregistré",
      dateAjout: new Date().toISOString(),
    };
    updateCheptel((prev) => [
      ...prev.map((m) => {
        if (m.id === a.id || m.id === b.id) {
          return {
            ...m,
            reproDone: 1,
            reproMax: 1,
            reproRestantes: 0,
            reproductionsRestantes: 0,
            sterile: true,
            statut: "Stérile",
          };
        }
        return m;
      }),
      child,
    ]);
    showToast(`Naissance enregistrée : ${child.nom}`);
  };

  // ---------- suggestions d'accouplement ----------
  const suggestions = useMemo(() => {
    const candidates = cheptel.filter(muldoReproductible);
    const males = candidates.filter((m) => sexeMuldo(m) === "M");
    const females = candidates.filter((m) => sexeMuldo(m) === "F");
    const pairs = [];
    females.forEach((f) => {
      males.forEach((m) => {
        const coll = collisionScore(f, m, byId);
        if (coll >= 99) return;
        const readiness = (readinessScore(f) + readinessScore(m)) / 2;
        const score = generationGoalScore(f, m, byId);
        const targetGen = Math.max(Number(f.generation ?? 1), Number(m.generation ?? 1)) + 1;
        pairs.push({ f, m, coll, readiness, score, targetGen });
      });
    });
    return pairs.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [cheptel, byId]);

  const actionsDuJour = useMemo(() => {
    const groups = { maturite: [], amour: [], endurance: [], pret: [], repos: [], termine: [] };
    cheptel.forEach((m) => {
      const action = getNextAction(m);
      if (!groups[action.key]) groups[action.key] = [];
      groups[action.key].push({ muldo: m, action });
    });
    return groups;
  }, [cheptel]);

  const filtered = cheptel.filter((m) =>
    (m.nom + m.couleur).toLowerCase().includes(filter.toLowerCase())
  );

  const readyCount = actionsDuJour.pret.length;
  const fertileCount = cheptel.filter((m) => muldoReproductible(m)).length;
  const sterileCount = cheptel.length - fertileCount;
  const discoveredTotal = Object.values(historiqueCouleurs || {}).filter(Boolean).length;

  if (loading) {
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
        }
        * { box-sizing: border-box; }
        /* Neutralise ENTIÈREMENT le gabarit Vite par défaut (index.css) :
           - #root limité à 1280px + padding = bandes noires ;
           - body en display:flex = #root rétréci à son contenu et collé à gauche. */
        html, body {
          margin:0 !important; padding:0 !important;
          background:#0c0a08;
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
          background:
            radial-gradient(900px 420px at 35% -15%, rgba(214,166,74,.22), transparent 62%),
            radial-gradient(1000px 600px at 108% 112%, rgba(101,199,193,.10), transparent 58%),
            radial-gradient(700px 400px at -8% 108%, rgba(30,70,80,.35), transparent 60%),
            linear-gradient(160deg, #120f0c 0%, #1f1812 55%, #15161a 100%);
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
          background:linear-gradient(180deg, rgba(53,43,34,.9), rgba(35,29,23,.72));
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
          background:linear-gradient(180deg, rgba(43,36,29,.95), rgba(22,22,25,.98));
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
          background:rgba(23,19,15,.72);
        }
        /* Pas d'overflow ici : un conteneur overflow:auto qui ne défile pas
           lui-même capturerait le position:sticky de la fiche cheptel. C'est
           la page entière qui défile. */
        .main-view { flex:1; padding:24px 28px; min-width:0; max-width:1500px; margin-inline:auto; }
        .main-view > * + * { margin-top:16px; }

        .panel-card {
          background:linear-gradient(180deg, rgba(53,43,34,.96), rgba(43,36,29,.96));
          border:1px solid var(--line); border-radius:18px; padding:18px 20px;
          box-shadow:0 14px 36px rgba(0,0,0,.22);
        }
        .panel-card > h2:first-child, .panel-card h2 { margin-top:0; }

        .stat-grid { display:grid; grid-template-columns: repeat(4, minmax(150px,1fr)); gap:14px; margin-bottom:16px; }
        .stat-card {
          position:relative; overflow:hidden; min-height:116px; padding:18px; border-radius:18px;
          background:linear-gradient(145deg, rgba(64,50,37,.96), rgba(37,30,23,.96));
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
            linear-gradient(145deg, rgba(65,48,31,.96), rgba(37,29,20,.96));
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
          background:linear-gradient(145deg, rgba(53,43,34,.96), rgba(34,28,22,.96));
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
          background:linear-gradient(180deg, rgba(53,43,34,.98), rgba(43,36,29,.98));
          box-shadow:0 18px 44px rgba(0,0,0,.4);
          animation: detail-in .18s ease;
        }
        @keyframes detail-in { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:none; } }
        .cheptel-detail-barre {
          position:sticky; top:0; z-index:5;
          display:flex; justify-content:space-between; align-items:center; gap:10px;
          padding:10px 14px;
          background:linear-gradient(180deg, rgba(64,50,37,.98), rgba(53,43,34,.98));
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
            <div className="brand-title">Registre des Abysses</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Élevage de Muldos · GPS génération · Succès</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", opacity: saving ? 1 : 0 }}>
            <Save size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> sauvegarde…
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            <button className="btn btn-coral" onClick={() => setShowNew(true)}><Plus size={15} /> Nouveau muldo</button>
          </div>
        </div>
      </div>

      <div className="layout">
        <AppSidebar
          page={page}
          setPage={setPage}
          cheptel={cheptel}
          readyCount={readyCount}
          fertileCount={fertileCount}
          discoveredTotal={discoveredTotal}
          cheptelDragodinde={eleveDragodinde.cheptel}
          cheptelVolkorne={eleveVolkorne.cheptel}
        />

        {page === "muldo" && sousPage === "cheptel" && (
          <div className="tech-column">
            <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
              <input className="field" placeholder="Rechercher un muldo…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
              <CheptelCards
                items={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
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
                cheptel={cheptel}
                plan={planGeneration}
                historiqueCouleurs={historiqueCouleurs}
                actionsDuJour={actionsDuJour}
                suggestions={suggestions}
                registerBirth={registerBirth}
                onVoirMuldo={voirMuldo}
              />
              <GraphiquesPanel cheptel={cheptel} journal={journal} instantanes={instantanes} />
              <EstimationKamasSelecteur cheptelMuldo={cheptel} cheptelDragodinde={eleveDragodinde.cheptel} cheptelVolkorne={eleveVolkorne.cheptel} />
              <MemoElevagePanel />
              <CorbeillePanel corbeille={corbeille} onRestaurer={restaurerMuldo} onPurger={purgerCorbeilleEntree} onVider={viderCorbeille} dureeJours={CORBEILLE_DUREE_JOURS} />
              <SauvegardePanel showToast={showToast} />
            </>
          )}

          {page === "taverne" && (
            <TavernePage compte={compte} onOuvrirProfil={() => setProfilOuvert(true)} />
          )}

          {page === "succes" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
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
              {succesCreature === "muldo" && (
                <SuccesDofusPage
                  historiqueCouleurs={historiqueCouleurs}
                  cheptel={cheptel}
                  objectifGeneration={objectifGeneration}
                  plan={planGeneration}
                  onToggleCouleur={basculerCouleurHistorique}
                  onValidateGeneration={validerGenerationHistorique}
                  onValidateAll={validerToutHistorique}
                  onResetHistory={reinitialiserHistoriqueManuel}
                />
              )}
              {succesCreature === "dragodinde" && <DragodindeSuccesPage {...eleveDragodinde.succesProps} />}
              {succesCreature === "volkorne" && <VolkorneSuccesPage {...eleveVolkorne.succesProps} />}
            </>
          )}

          {page === "muldo" && (
            <>
              <SousNavOutils sousPage={sousPage} setSousPage={setSousPage} />

              {sousPage === "gps" && (
                <GpsDofusPage
                  session={sessionGps}
                  mode={modeGps}
                  setMode={setModeGps}
                  objectif={objectifGpsActif}
                  objectifCouleur={objectifGps}
                  setObjectifCouleur={setObjectifGps}
                  generationCible={generationGps}
                  setGenerationCible={setGenerationGps}
                  generationMin={generationCollectionMin}
                  setGenerationMin={setGenerationCollectionMin}
                  generationMax={generationCollectionMax}
                  setGenerationMax={setGenerationCollectionMax}
                  choixObjectif={choixObjectifGps}
                  progressionGenerations={progressionGps}
                  purification={modePurification}
                  setPurification={setModePurification}
                  optimakina={optimakina}
                  setOptimakina={setOptimakina}
                  niveauMinimumSession={niveauMinimumSession}
                  setNiveauMinimumSession={setNiveauMinimumSession}
                  suivi={gpsSuiviActif}
                  naissances={naissances}
                  journal={journal}
                  onConfirmerNaissance={confirmerNaissance}
                  onSupprimerNaissance={supprimerNaissance}
                  onRealiserUn={(g) => realiserCouplesGps((g.couples || []).slice(0, 1))}
                  onTerminerGroupe={(g) => realiserCouplesGps(g.couples || [])}
                  onAnnuler={annulerDernierCoupleGps}
                  onReinitialiser={reinitialiserSessionGps}
                  onDemarrerNouvelleSession={demarrerNouvelleSessionAccouplement}
                  onNettoyerSterilesPuisDemarrer={nettoyerSterilesPuisDemarrerSession}
                  onVoirMuldo={voirMuldo}
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
                />
              )}

              {sousPage === "synchro" && (
                <SynchronisationFiltresPage
                  cheptel={cheptel}
                  updateCheptel={updateCheptel}
                  showToast={showToast}
                  onVoirMuldo={voirMuldo}
                  onSupprimerMuldo={(m) => {
                    if (window.confirm(`Supprimer définitivement ${m.nom || m.couleur} ? (généalogie : ce muldo a des parents ou descendants connus)`)) {
                      deleteMuldo(m.id);
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
                      cheptel={filtered}
                      selectedId={selectedId}
                      setSelectedId={setSelectedId}
                      filter={filter}
                      setFilter={setFilter}
                      actionsDuJour={actionsDuJour}
                      importProps={{
                        captureText,
                        setCaptureText,
                        capturePreview,
                        setCapturePreview,
                        importCapture,
                        onImport: importerCaptureDansCheptel,
                      }}
                    />
                  </div>
                  {selected && (
                    <div className="cheptel-backdrop" onClick={() => setSelectedId(null)} />
                  )}
                  {selected && (
                    <div className="cheptel-detail">
                      <div className="cheptel-detail-barre">
                        <span style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <MuldoBadge couleur={selected.couleur} taille={18} /> {selected.nom || selected.couleur}
                        </span>
                        <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setSelectedId(null)}>
                          ✕ Fermer
                        </button>
                      </div>
                      <div className="cheptel-detail-corps">
                        <MuldoDetail muldo={selected} byId={byId} onPatch={(p) => patchMuldo(selected.id, p)} onDelete={() => deleteMuldo(selected.id)} />
                      </div>
                    </div>
                  )}
                </div>
                <ArbreGenealogiquePanel cheptel={cheptel} onSelect={setSelectedId} sexeFn={sexeMuldo} plierCouleurFn={plierCouleur} />
                </>
              )}

              {sousPage === "clonage" && (
                <ClonagePage
                  cheptel={cheptel}
                  objectif={objectifGpsActif}
                  journal={journal}
                  onVoirMuldo={voirMuldo}
                  fusion={{
                    muldos: cheptel,
                    fusionA,
                    fusionB,
                    setFusionA,
                    setFusionB,
                    onFusion: fusionnerSteriles,
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
              {sousPage === "gps" && <DragodindeGpsPage {...eleveDragodinde.gpsProps} {...eleveDragodinde.naissancesProps} />}
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
              {sousPage === "gps" && <VolkorneGpsPage {...eleveVolkorne.gpsProps} {...eleveVolkorne.naissancesProps} />}
              {sousPage === "clonage" && <VolkorneClonagePage {...eleveVolkorne.clonageProps} />}
            </>
          )}
        </div>
      </div>

      {showNew && <NewMuldoModal cheptel={cheptel} onClose={() => setShowNew(false)} onCreate={addMuldo} />}

      {profilOuvert && (
        <ProfilModal compte={compte} profilLocal={profil} setProfilLocal={setProfil} onClose={() => setProfilOuvert(false)} />
      )}

      {ficheRapide && (
        <FicheRapideModal
          muldo={ficheRapide}
          byId={byId}
          onPatch={(p) => patchMuldo(ficheRapide.id, p)}
          onDelete={() => { deleteMuldo(ficheRapide.id); setFicheRapideId(null); }}
          onClose={() => setFicheRapideId(null)}
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
      </footer>

      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 90, maxWidth: "min(92vw, 640px)", pointerEvents: "none", background: "var(--panel)", border: "1px solid var(--gold)", color: "var(--text)", padding: "10px 16px", borderRadius: 12, fontSize: 13, boxShadow: "0 12px 30px rgba(0,0,0,.45)", animation: "fondu .15s ease" }}>
          {typeof toast === "string" ? toast : toast.msg}
        </div>
      )}
    </div>
  );
}






function ImportCapturePanel({ captureText, setCaptureText, capturePreview, setCapturePreview, importCapture, onImport }) {
  const totalReconnu = importCapture.reduce((sum, l) => sum + l.total, 0);

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCapturePreview(URL.createObjectURL(file));
  };

  return (
    <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.line}`, background: COLORS.panel }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.glow, marginBottom: 10, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
        Import capture Dofus
      </div>

      <div style={{ fontSize: 11.5, color: COLORS.muted, fontFamily: "Inter, sans-serif", lineHeight: 1.45, marginBottom: 10 }}>
        Première version semi-auto : importe un screen, puis colle le texte lu par OCR/téléphone/outil Windows. L'appli transforme le texte en stock.
      </div>

      <input className="field" type="file" multiple accept="image/*" onChange={onFile} />

      {capturePreview && (
        <img src={capturePreview} alt="Capture Dofus" style={{ width: "100%", maxHeight: 130, objectFit: "cover", borderRadius: 8, border: `1px solid ${COLORS.line}`, marginTop: 8 }} />
      )}

      <textarea
        className="field"
        rows={5}
        value={captureText}
        onChange={(e) => setCaptureText(e.target.value)}
        placeholder={"Colle ici le texte détecté, exemple :\nDoré mâle 10\nDoré femelle 9\nÉbène 24"}
        style={{ marginTop: 8, resize: "vertical" }}
      />

      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 11, color: totalReconnu > 0 ? COLORS.glow : COLORS.muted, fontFamily: "Inter, sans-serif" }}>
          {totalReconnu > 0 ? `${totalReconnu} muldo(s) reconnu(s)` : "Aucun muldo reconnu"}
        </div>
        <button className="btn btn-coral" onClick={onImport}>Importer</button>
      </div>

      {importCapture.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 90, overflow: "auto", borderTop: `1px solid ${COLORS.line}`, paddingTop: 6 }}>
          {importCapture.map((l) => (
            <div key={l.couleur} style={{ fontSize: 11, color: COLORS.text, fontFamily: "Inter, sans-serif", marginBottom: 3 }}>
              {l.couleur} — ♂ {l.male} / ♀ {l.femelle} / ? {l.inconnu} / total {l.total}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function AssistantCroisementsPanel({ couleurCible, setCouleurCible, analyseCible, selected, actionsSelection }) {
  const objectifs = OBJECTIFS_COULEURS;

  return (
    <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.line}`, background: COLORS.panel }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.glow, marginBottom: 10, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
        Assistant croisements
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 11, color: COLORS.muted, marginBottom: 5, fontFamily: "Inter, sans-serif" }}>
          Je veux obtenir
        </label>
        <select className="field" value={couleurCible} onChange={(e) => setCouleurCible(e.target.value)}>
          {objectifs.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {analyseCible.length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
            Recettes pas encore renseignées pour cette couleur.
          </div>
        )}

        {analyseCible.slice(0, 6).map((r, idx) => (
          <div key={`${r.parentA}-${r.parentB}-${idx}`} style={{ padding: 8, borderRadius: 8, background: COLORS.panelAlt, border: `1px solid ${r.possible ? COLORS.glow : COLORS.line}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: r.possible ? COLORS.glow : r.partiel ? COLORS.gold : COLORS.text, fontFamily: "Inter, sans-serif" }}>
              {r.possible ? "✅ Possible" : r.partiel ? "⚠️ Partiel" : "❌ Impossible"}
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.text, fontFamily: "Inter, sans-serif", marginTop: 3 }}>
              {r.parentA} × {r.parentB}
            </div>
            <div style={{ fontSize: 10.5, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 3 }}>
              {r.parentA}: ♂ {r.stockA.male} / ♀ {r.stockA.femelle} — {r.parentB}: ♂ {r.stockB.male} / ♀ {r.stockB.femelle}
            </div>
            <div style={{ fontSize: 10.5, color: r.possible ? COLORS.glow : COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 3 }}>
              Couples possibles : {r.couples}
              {r.manque.length > 0 ? ` — Manque : ${r.manque.join(", ")}` : ""}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
          Que faire avec la monture sélectionnée ?
        </div>

        {!selected && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
            Sélectionne une monture dans le registre.
          </div>
        )}

        {selected && actionsSelection.length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
            {selected.couleur} n'est pas encore utilisée dans les recettes renseignées.
          </div>
        )}

        {selected && actionsSelection.slice(0, 6).map((a, idx) => (
          <div key={`${a.cible}-${a.partenaire}-${idx}`} style={{ fontSize: 11.5, color: a.disponible ? COLORS.glow : COLORS.muted, fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
            {a.disponible ? "✅" : "❌"} Viser {a.cible} avec {a.partenaire}
            <span style={{ color: COLORS.muted }}> — stock partenaire : ♂ {a.stockPartenaire.male} / ♀ {a.stockPartenaire.femelle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}



function PlanificateurGenerationPanel({ objectifGeneration, setObjectifGeneration, plan, stockComplet, historiqueCouleurs }) {
  const action = plan.actionImmediate;
  const decouvertesTotal = Object.values(historiqueCouleurs || {}).filter(Boolean).length;

  return (
    <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.line}`, background: COLORS.panel }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.gold, marginBottom: 10, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
        GPS génération V2
      </div>

      <label style={{ display: "block", fontSize: 11, color: COLORS.muted, marginBottom: 5, fontFamily: "Inter, sans-serif" }}>
        Je veux compléter jusqu'à la génération
      </label>
      <select className="field" value={objectifGeneration} onChange={(e) => setObjectifGeneration(Number(e.target.value))}>
        {[1,2,3,4,5,6,7,8,9,10].map((g) => <option key={g} value={g}>Génération {g}</option>)}
      </select>

      <div style={{ marginTop: 10, padding: 10, background: COLORS.panelAlt, borderRadius: 8, border: `1px solid ${COLORS.line}` }}>
        <div style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 800, color: COLORS.glow }}>
          Présentes : {plan.possedees.length} / {plan.objectif.length}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
          Succès historique : {plan.decouvertes.length} / {plan.objectif.length} jusqu'à G{objectifGeneration} · {decouvertesTotal} couleur(s) déjà vues au total
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
          Jamais obtenues : {plan.jamaisDecouvertes.length > 0 ? plan.jamaisDecouvertes.slice(0, 6).join(", ") : "aucune"}{plan.jamaisDecouvertes.length > 6 ? "…" : ""}
        </div>
      </div>

      {action ? (
        <div style={{ marginTop: 10, padding: 10, background: COLORS.panelAlt, borderRadius: 8, border: `1px solid ${action.nouvelleCouleur ? COLORS.glow : COLORS.gold}` }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>Action à faire maintenant</div>
          <div style={{ fontSize: 13, color: action.nouvelleCouleur ? COLORS.glow : COLORS.gold, fontFamily: "Inter, sans-serif", fontWeight: 800, marginTop: 3 }}>
            {action.nouvelleCouleur ? "⭐ Nouvelle couleur : " : "🧬 Créer "}
            {action.couleur} <span style={{ color: COLORS.muted }}>G{action.generation}</span>
          </div>

          {action.couple && (
            <div style={{ fontSize: 11, color: COLORS.text, fontFamily: "Inter, sans-serif", marginTop: 5, lineHeight: 1.45 }}>
              Parents : ♂ <b>{action.couple.male.nom}</b> ({action.couple.male.couleur}) × ♀ <b>{action.couple.femelle.nom}</b> ({action.couple.femelle.couleur})
              <br />
              Recette : {action.recette.join(" × ")}
            </div>
          )}

          <div style={{ fontSize: 10.5, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 6 }}>
            Le GPS cherche d'abord un croisement proche de G{objectifGeneration}. S'il est bloqué, il descend G{objectifGeneration - 1}, G{objectifGeneration - 2}, etc.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 10, padding: 10, background: COLORS.panelAlt, borderRadius: 8, border: `1px solid ${COLORS.danger}` }}>
          <div style={{ fontSize: 13, color: COLORS.danger, fontFamily: "Inter, sans-serif", fontWeight: 800 }}>
            Aucun croisement faisable trouvé
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
            Il te manque probablement les parents de base, ou les sexes/reproductions restantes ne permettent pas encore un couple.
          </div>
        </div>
      )}

      {plan.etapes.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 145, overflow: "auto", paddingRight: 4 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginBottom: 5 }}>Plan proche de l'objectif</div>
          {plan.etapes.slice(0, 12).map((e, idx) => (
            <div key={`${e.couleur}-${idx}`} style={{ fontSize: 11.5, color: e.nouvelleCouleur ? COLORS.glow : COLORS.text, fontFamily: "Inter, sans-serif", marginBottom: 5 }}>
              {idx + 1}. {e.nouvelleCouleur ? "⭐" : "🧬"} <b>{e.couleur}</b>
              <span style={{ color: COLORS.muted }}> — {e.recette.join(" × ")}</span>
            </div>
          ))}
          {plan.etapes.length > 12 && <div style={{ fontSize: 11, color: COLORS.muted }}>+ {plan.etapes.length - 12} étape(s)</div>}
        </div>
      )}
    </div>
  );
}

function ObjectifsCouleursPanel({ stockComplet, stocksCouleurs, setStocksCouleurs, objectifs, prochainObjectif }) {
  const updateStock = (couleur, value) => {
    setStocksCouleurs((prev) => ({
      ...prev,
      [couleur]: Math.max(0, Number(value) || 0),
    }));
  };

  return (
    <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.line}`, background: COLORS.panel }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.glow, marginBottom: 10, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
        Objectifs couleurs
      </div>

      {prochainObjectif && (
        <div style={{ marginBottom: 12, padding: 10, background: COLORS.panelAlt, borderRadius: 8, border: `1px solid ${prochainObjectif.status === "possible" ? COLORS.glow : COLORS.gold}` }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>Prochaine cible</div>
          <div style={{ fontSize: 16, fontFamily: "Inter, sans-serif", fontWeight: 800, color: prochainObjectif.status === "possible" ? COLORS.glow : COLORS.gold }}>
            {prochainObjectif.couleur}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.text, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
            Recette possible : {
              prochainObjectif.recettes?.find((r) => r.faisable)
                ? prochainObjectif.recettes.find((r) => r.faisable).dispoParents.map((p) => `${p.couleur} (${p.stock})`).join(" × ")
                : "aucune avec ton stock actuel"
            }
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {objectifs.map((objectif) => (
          <div key={objectif.couleur} style={{ padding: 8, background: COLORS.panelAlt, borderRadius: 7, border: `1px solid ${COLORS.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
              <span>{objectif.possedes > 0 ? "✓" : objectif.faisable ? "🟢" : "❌"} {objectif.couleur}</span>
              <span style={{ color: objectif.possedes > 0 ? COLORS.glow : objectif.faisable ? COLORS.glow : COLORS.danger }}>
                {objectif.possedes}
              </span>
            </div>
            {objectif.possedes === 0 && objectif.recettes?.length > 0 && (
              <div style={{ fontSize: 10.5, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
                {objectif.recettes.slice(0, 2).map((r, idx) => (
                  <div key={idx} style={{ color: r.faisable ? COLORS.glow : COLORS.muted }}>
                    {r.faisable ? "Possible : " : "Manque : "}
                    {r.dispoParents.map((p) => `${p.couleur} (${p.stock})`).join(" × ")}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 52px", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
        {COULEURS_MULDO.map((couleur) => {
          const n = stockComplet[couleur] || 0;
          const isTarget = OBJECTIFS_COULEURS.includes(couleur);
          const danger = n === 0 && isTarget;

          return (
            <React.Fragment key={couleur}>
              <div style={{ fontSize: 12, color: danger ? COLORS.danger : n <= 2 ? COLORS.gold : COLORS.text, fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center" }}>
                {danger ? "❌ " : n > 0 ? "✓ " : "• "}{couleur}
              </div>
              <input
                className="field"
                type="number"
                min={0}
                value={stocksCouleurs[couleur] ?? 0}
                onChange={(e) => updateStock(couleur, e.target.value)}
                style={{ padding: "4px 6px", fontSize: 11, height: 25 }}
              />
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
        Mets à jour les compteurs depuis les filtres Dofus. Les couleurs à 0 restent tes cibles.
      </div>
    </div>
  );
}

function ActionGroup({ title, items, onSelect }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginBottom: 5 }}>{title} · {items.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.slice(0, 5).map(({ muldo, action }) => (
          <button key={muldo.id} className="btn btn-ghost" onClick={() => onSelect(muldo.id)} style={{ justifyContent: "space-between", padding: "7px 9px", fontSize: 11 }}>
            <span>{muldo.sexe === "F" ? "♀" : "♂"} {muldo.nom}</span>
            <span style={{ color: action.color }}>{action.objet}</span>
          </button>
        ))}
        {items.length > 5 && (
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", paddingLeft: 4 }}>+ {items.length - 5} autre(s)</div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ muldo }) {
  const action = getNextAction(muldo);
  return (
    <div style={{ marginBottom: 20, padding: 12, background: COLORS.panelAlt, border: `1px solid ${action.color}`, borderRadius: 10 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: action.color, marginBottom: 6, fontFamily: "Inter, sans-serif", fontWeight: 800 }}>
        Action conseillée
      </div>
      <div style={{ fontSize: 16, fontFamily: "Inter, sans-serif", fontWeight: 800 }}>{action.label}</div>
      <div style={{ fontSize: 12, color: COLORS.text, fontFamily: "Inter, sans-serif", marginTop: 5 }}>Objet / zone : <b>{action.objet}</b></div>
      <div style={{ fontSize: 11.5, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 5 }}>{action.detail}</div>
    </div>
  );
}

// Fiche d'un muldo ouverte par-dessus la page courante (GPS, Clonage,
// Dashboard, Synchronisation…) — pas besoin de quitter la page pour
// supprimer ou corriger un muldo saisi par erreur.
function FicheRapideModal({ muldo, byId, onPatch, onDelete, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: "40px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", background: "linear-gradient(180deg, rgba(53,43,34,.99), rgba(43,36,29,.99))", border: "1px solid var(--gold)", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>
            <MuldoBadge couleur={muldo.couleur} taille={18} /> {muldo.nom || muldo.couleur}
          </span>
          <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={onClose}>✕ Fermer</button>
        </div>
        <MuldoDetail muldo={muldo} byId={byId} onPatch={onPatch} onDelete={onDelete} />
      </div>
    </div>
  );
}

// ---------- fiche détail ----------
function MuldoDetail({ muldo, byId, onPatch, onDelete }) {
  const readiness = readinessScore(muldo);
  const pere = muldo.parentIds?.[0] ? byId[muldo.parentIds[0]] : null;
  const mere = muldo.parentIds?.[1] ? byId[muldo.parentIds[1]] : null;

  const partners = geneticPartners(
    muldo,
    Object.values(byId),
    byId
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <input className="field" style={{ fontSize: 20, fontFamily: "'Iowan Old Style', Georgia, serif", padding: "4px 8px", background: "transparent", border: "1px solid transparent" }}
            value={muldo.nom} onChange={(e) => onPatch({ nom: e.target.value })} />
          <div style={{ fontSize: 11.5, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 4, paddingLeft: 8 }}>
            Génération {muldo.generation} · Ajouté le {new Date(muldo.dateAjout).toLocaleDateString("fr-FR")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => exporterFicheImage(muldo, { teintesFn: teintesDeCouleur, slugFn: slugCouleur, nomCreature: "muldos" })} title="Télécharger une image de cette fiche, à partager sur Discord/le forum">🖼️ Exporter</button>
          <button className="btn btn-ghost" onClick={onDelete}><Trash2 size={13} /> Retirer</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <LabeledSelect label="Sexe" value={muldo.sexe} options={[["F", "♀ Femelle"], ["M", "♂ Mâle"]]} onChange={(v) => onPatch({ sexe: v })} />
        <LabeledSelect label="Couleur" value={muldo.couleur} options={COULEURS_MULDO.map((c) => [c, c])} onChange={(v) => onPatch({ couleur: v })} />
        <LabeledSelect label="Statut" value={muldo.statut} options={STATUTS.map((s) => [s, s])} onChange={(v) => onPatch({ statut: v })} />
        <div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>Reproduction 3.5</div>
          <button
            className={`btn ${muldoReproductible(muldo) ? "btn-coral" : "btn-ghost"}`}
            style={{ width: "100%" }}
            onClick={() => {
              const devientSterile = muldoReproductible(muldo);
              onPatch({
                statut: devientSterile ? "Stérile" : "Fertile",
                sterile: devientSterile,
                reproDone: devientSterile ? 1 : 0,
                reproMax: 1,
                reproRestantes: devientSterile ? 0 : 1,
                reproductionsRestantes: devientSterile ? 0 : 1,
              });
            }}
          >
            {muldoReproductible(muldo) ? "1 reproduction disponible" : "Stérile — remettre fertile"}
          </button>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>Niveau (optionnel, pour la génération cible)</div>
          <input
            className="field"
            type="number"
            min={0}
            max={200}
            placeholder="?"
            value={muldo.niveau ?? ""}
            onChange={(e) => onPatch({ niveau: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.gold, marginBottom: 10, fontWeight: 900 }}>Capacités</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[0, 1].map((index) => {
            const valeurs = capacitesMuldo(muldo);
            return (
              <LabeledSelect
                key={index}
                label={`Capacité ${index + 1}`}
                value={valeurs[index] || "Aucune"}
                options={CAPACITES_MULDO.map((c) => [c, c])}
                onChange={(value) => {
                  const next = [...valeurs];
                  if (value === "Aucune") next.splice(index, 1);
                  else next[index] = value;
                  const propres = [...new Set(next.filter((c) => c && c !== "Aucune"))].slice(0, 2);
                  onPatch({
                    capacites: propres,
                    capacite1: propres[0] || "Aucune",
                    capacite2: propres[1] || "Aucune",
                    reproductrice: propres.includes("Reproductrice"),
                  });
                }}
              />
            );
          })}
        </div>
      </div>

      <ActionCard muldo={muldo} />

      {/* Jauges */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.glow, marginBottom: 10, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
          Jauges d'élevage — prêt à {Math.round(readiness)}%
        </div>
        {JAUGES.map(({ key, label, icon: Icon }) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.muted }}><Icon size={12} /> {label}</span>
              <span>{muldo[key]}%</span>
            </div>
            <input type="range" min={0} max={100} value={muldo[key]} onChange={(e) => onPatch({ [key]: Number(e.target.value) })}
              style={{ width: "100%", accentColor: COLORS.coral }} />
          </div>
        ))}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.muted }}><Skull size={12} /> Fatigue</span>
            <span>{muldo.fatigue ?? 0}/240</span>
          </div>
          <input type="range" min={0} max={240} value={muldo.fatigue ?? 0} onChange={(e) => onPatch({ fatigue: Number(e.target.value) })}
            style={{ width: "100%", accentColor: COLORS.coral }} />
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 6, display: "flex", gap: 6 }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          Pour féconder : maturité, endurance et amour au maximum. La sérénité doit être positive pour monter l'amour, négative pour l'endurance.
        </div>
      </div>

      {/* Généalogie */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.glow, marginBottom: 10, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
          Généalogie
        </div>
        <div style={{ fontSize: 12.5, fontFamily: "Inter, sans-serif", color: COLORS.text }}>
          Père : {pere ? pere.nom : "inconnu / sauvage"} · Mère : {mere ? mere.nom : "inconnu / sauvage"}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
          Renseigner les parents permet d'éviter les collisions génétiques (consanguinité) lors des suggestions d'accouplement.
        </div>

      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.glow, marginBottom: 10, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
          Assistant génétique
        </div>

        {partners.map(({ partner, score, coll }) => (
          <div
            key={partner.id}
            style={{
              padding: 8,
              marginBottom: 6,
              background: COLORS.panelAlt,
              borderRadius: 6,
              border: `1px solid ${COLORS.line}`,
            }}
          >
            <b>{partner.nom}</b> ({partner.couleur})
            <div style={{ fontSize: 11, color: COLORS.muted }}>
              Score : {score} · Consanguinité : {coll}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: COLORS.glow, marginBottom: 8, fontFamily: "Inter, sans-serif", fontWeight: 700 }}>Notes</div>
        <textarea className="field" rows={3} value={muldo.notes} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Objectif de croisement, makina utilisée, remarques…" />
      </div>
    </div>
  );
}

function LabeledSelect({ label, value, options, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>{label}</div>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ---------- modale nouveau muldo ----------
function NewMuldoModal({ cheptel, onClose, onCreate }) {
  const [form, setForm] = useState(() => ({
    nom: genererNomCourt(COULEURS_MULDO[0]),
    sexe: "F", couleur: COULEURS_MULDO[0], generation: generationDeCouleur(COULEURS_MULDO[0]), statut: "Fertile",
    capacite1: "Aucune", capacite2: "Aucune", pere: "", mere: "",
  }));
  // Tant que l'utilisateur n'a pas saisi son propre nom, on suit la couleur.
  const [nomPersonnalise, setNomPersonnalise] = useState(false);
  // Filtre optionnel : choisir d'abord la génération restreint les couleurs
  // proposées ; sans filtre, toute la liste (G1 → G10) est disponible.
  const [filtreGeneration, setFiltreGeneration] = useState("");
  const couleursProposees = filtreGeneration
    ? (GENERATIONS_MULDO[Number(filtreGeneration)] || [])
    : couleursGenerationJusqua(10);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const changerCouleur = (couleur) => {
    setForm((f) => ({
      ...f,
      couleur,
      generation: generationDeCouleur(couleur),
      nom: nomPersonnalise && f.nom ? f.nom : genererNomCourt(couleur),
    }));
  };
  const changerFiltreGeneration = (valeur) => {
    setFiltreGeneration(valeur);
    if (valeur) {
      const liste = GENERATIONS_MULDO[Number(valeur)] || [];
      if (liste.length && !liste.includes(form.couleur)) changerCouleur(liste[0]);
    }
  };
  const males = cheptel.filter((m) => m.sexe === "M");
  const femelles = cheptel.filter((m) => m.sexe === "F");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,15,19,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 22, width: 380, color: COLORS.text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontFamily: "'Iowan Old Style', Georgia, serif" }}>Nouveau spécimen</div>
          <X size={16} style={{ cursor: "pointer", color: COLORS.muted }} onClick={onClose} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="field"
              placeholder="Nom du muldo"
              value={form.nom}
              onChange={(e) => { set("nom", e.target.value); setNomPersonnalise(e.target.value.trim() !== ""); }}
              title="Nom proposé automatiquement (valide pour le renommage en jeu) — modifie-le librement"
            />
            <button
              type="button"
              className="btn btn-ghost"
              title="Proposer un autre nom"
              style={{ padding: "0 12px", flexShrink: 0 }}
              onClick={() => { set("nom", genererNomCourt(form.couleur)); setNomPersonnalise(false); }}
            >
              ↻
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              title="Copier ce nom pour le renommage en jeu"
              style={{ padding: "0 12px", flexShrink: 0 }}
              onClick={() => copierPressePapiers(form.nom)}
            >
              📋
            </button>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>Sexe</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: "center", ...(form.sexe === "M" ? { borderColor: "#6fa8dc", color: "#6fa8dc", background: "rgba(111,168,220,.1)" } : {}) }}
                onClick={() => set("sexe", "M")}
              >
                ♂ Mâle
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: "center", ...(form.sexe === "F" ? { borderColor: "#d98ec0", color: "#d98ec0", background: "rgba(217,142,192,.1)" } : {}) }}
                onClick={() => set("sexe", "F")}
              >
                ♀ Femelle
              </button>
            </div>
          </div>
          <LabeledSelect
            label="Génération (filtre les couleurs)"
            value={filtreGeneration}
            options={[["", "Toutes les générations"], ...Array.from({ length: 10 }, (_, i) => [String(i + 1), `Génération ${i + 1}`])]}
            onChange={changerFiltreGeneration}
          />
          <LabeledSelect
            label={`Couleur${filtreGeneration ? ` (G${filtreGeneration} · ${couleursProposees.length} choix)` : ""}`}
            value={form.couleur}
            options={couleursProposees.map((c) => [c, c])}
            onChange={changerCouleur}
          />
          <LabeledSelect label="Capacité 1" value={form.capacite1} options={CAPACITES_MULDO.map((c) => [c, c])} onChange={(v) => set("capacite1", v)} />
          <LabeledSelect label="Capacité 2" value={form.capacite2} options={CAPACITES_MULDO.map((c) => [c, c])} onChange={(v) => set("capacite2", v)} />
          <LabeledSelect label="Père (optionnel)" value={form.pere} options={[["", "Inconnu / sauvage"], ...males.map((m) => [m.id, m.nom])]} onChange={(v) => set("pere", v)} />
          <LabeledSelect label="Mère (optionnel)" value={form.mere} options={[["", "Inconnue / sauvage"], ...femelles.map((m) => [m.id, m.nom])]} onChange={(v) => set("mere", v)} />
        </div>
        <button className="btn btn-coral" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
          onClick={() => onCreate({ ...form, nom: form.nom.trim() || genererNomCourt(form.couleur), capacites: [form.capacite1, form.capacite2], parentIds: [form.pere || null, form.mere || null] })}>
          <Plus size={14} /> Ajouter au cheptel
        </button>
      </div>
    </div>
  );
}


function DashboardPanel({cheptel,plan,historiqueCouleurs}){
 const fertiles=cheptel.filter(m=>m.statut!=="Stérile").length;
 const dec=Object.keys(historiqueCouleurs||{}).length;
 return <div>
 <h1>🏠 Tableau de bord</h1>
 <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(150px,1fr))",gap:12}}>
 <div style={{background:"#2b2722",padding:16,borderRadius:10}}><b>Cheptel</b><div>{cheptel.length}</div></div>
 <div style={{background:"#2b2722",padding:16,borderRadius:10}}><b>Fertiles</b><div>{fertiles}</div></div>
 <div style={{background:"#2b2722",padding:16,borderRadius:10}}><b>Découvertes</b><div>{dec}</div></div>
 <div style={{background:"#2b2722",padding:16,borderRadius:10}}><b>Objectif</b><div>G{plan.generation}</div></div>
 </div>
 {plan.actionImmediate && <div style={{marginTop:20,background:"#2b2722",padding:20,borderRadius:10}}>
 <h2>🎯 Action recommandée</h2>
 <div>{plan.actionImmediate.couleur}</div>
 </div>}
 </div>
}


// Barre d'onglets affichée en entrant dans une section créature (Muldo,
// Dragodinde, Volkorne) — permet de passer de Cheptel à Synchro/GPS/Clonage
// sans repasser par le menu latéral.
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

function StatCard({ value, label, emoji }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 22, marginBottom: 12 }}>{emoji}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// Petit bouton pour ouvrir la fiche d'un muldo (page Cheptel) depuis une
// suggestion (accouplement, clonage) — pratique pour le supprimer ou le
// repasser stérile en cas d'erreur de saisie, sans devoir le rechercher.
function DashboardDofusPanel({ cheptel, plan, historiqueCouleurs, actionsDuJour, suggestions, registerBirth, onVoirMuldo }) {
  const fertiles = cheptel.filter((m) => muldoReproductible(m)).length;
  const prets = actionsDuJour.pret.length;
  const dec = Object.values(historiqueCouleurs || {}).filter(Boolean).length;
  const pct = plan.objectif.length ? Math.round((plan.decouvertes.length / plan.objectif.length) * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "var(--gold)", fontSize: 12, fontWeight: 950, letterSpacing: 1.6, textTransform: "uppercase" }}>Tableau de bord</div>
        <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>Vue générale de l'élevage</h1>
      </div>

      <div className="stat-grid">
        <StatCard value={cheptel.length} label="Muldos" emoji="🐴" />
        <StatCard value={fertiles} label="Fertiles" emoji="🌱" />
        <StatCard value={prets} label="Prêts" emoji="⚡" />
        <StatCard value={dec} label="Découvertes" emoji="🏆" />
      </div>

      <div className="hero-gps">
        <BigGpsCard plan={plan} />
        <div className="panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <b>Progression jusqu'à G{plan.generation}</b>
            <span style={{ color: "var(--gold2)", fontWeight: 900 }}>{pct}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
            {plan.decouvertes.length} découvertes / {plan.objectif.length} couleurs attendues.
          </div>
          <div style={{ marginTop: 16, color: "var(--muted)", fontSize: 13 }}>
            Manquantes : {plan.jamaisDecouvertes.slice(0, 8).join(", ") || "aucune"}
            {plan.jamaisDecouvertes.length > 8 ? "…" : ""}
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Accouplements conseillés</h2>
        {suggestions.length === 0 && <div style={{ color: "var(--muted)" }}>Aucun couple conseillé pour le moment.</div>}
        {suggestions.slice(0, 3).map((s, i) => {
          const cl = collisionLabel(s.coll);
          return (
            <div key={i} style={{ padding: 12, borderRadius: 14, border: "1px solid var(--line)", background: "rgba(0,0,0,.12)", marginBottom: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <b>♀ {s.f.nom}</b>
                <BoutonFiche id={s.f.id} onVoir={onVoirMuldo} label={s.f.nom} />
              </span>
              <span style={{ color: "var(--gold2)", margin: "0 6px" }}>×</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <b>♂ {s.m.nom}</b>
                <BoutonFiche id={s.m.id} onVoir={onVoirMuldo} label={s.m.nom} />
              </span>
              <div style={{ color: cl.color, fontSize: 12, marginTop: 4 }}>{cl.label}</div>
              <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => registerBirth(s.f.id, s.m.id)}>
                <Baby size={13} /> Marquer accouplés → naissance
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BigGpsCard({ plan }) {
  const action = plan.actionImmediate;

  return (
    <div className="gps-action">
      <div className="gps-title">Objectif GPS actuel</div>
      <div className="gps-target">{action ? action.couleur : `Génération ${plan.generation}`}</div>

      {action ? (
        <>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Action immédiate recommandée</div>
          <div className="recipe-line">
            {(action.recette || []).map((p) => <span key={p} className="pill">{p}</span>)}
            {action.recette?.length === 2 && <span style={{ color: "var(--gold2)", fontWeight: 950 }}>→</span>}
            <span className="pill" style={{ borderColor: "var(--gold)", color: "var(--gold2)" }}>{action.couleur}</span>
          </div>
          {action.couple && (
            <div style={{ marginTop: 18, padding: 12, borderRadius: 14, background: "rgba(0,0,0,.16)", border: "1px solid var(--line)" }}>
              Couple trouvé : <b>♂ {action.couple.male?.nom}</b> × <b>♀ {action.couple.femelle?.nom}</b>
            </div>
          )}
        </>
      ) : (
        <div style={{ color: "var(--muted)", marginTop: 12 }}>
          Aucune action immédiate trouvée. Vérifie le stock ou augmente l'objectif.
        </div>
      )}
    </div>
  );
}

function GpsSessionControls({ objectif, setObjectif, purification, setPurification, session }) {
  return (
    <div style={{ padding: 16, borderBottom: "1px solid var(--line)" }}>
      <div className="sidebar-title" style={{ marginLeft: 0 }}>Optimiseur global</div>
      <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Objectif final</label>
      <select className="field" value={objectif} onChange={(e) => setObjectif(e.target.value)}>
        {COULEURS_MULDO.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
        <input type="checkbox" checked={purification} onChange={(e) => setPurification(e.target.checked)} />
        Autoriser les croisements de même couleur (purification)
      </label>
      <div className="side-metric">
        <b style={{ color: "var(--gold2)" }}>{session.couples.length} couples</b><br />
        {session.utilises} / {session.totalFertiles} Muldos utilisées<br />
        {session.restants.length} sans partenaire
      </div>
    </div>
  );
}

// ---------- Identité visuelle des couleurs ----------
// Chaque monocolore a sa teinte ; un bicolore = pastille coupée en deux.
// Si une image locale existe (public/muldos/<slug>.png, ex. dore-et-amande.png),
// elle remplace automatiquement le badge généré.
const PALETTE_MULDO = {
  "dore": "#E3B341",
  "ebene": "#2E2620",
  "indigo": "#3D4E9E",
  "pourpre": "#8E3A6E",
  "orchidee": "#C97FD1",
  "roux": "#B65A2A",
  "amande": "#AECf8B",
  "ivoire": "#EFE8D0",
  "turquoise": "#35BFBF",
  "prune": "#6C3B78",
  "emeraude": "#2FA05A",
  "ambre": "#E0851F",
  "corail": "#F0705A",
  "azur": "#3A9BE0",
  "aigue marine": "#7FD6C9",
};

function teintesDeCouleur(couleur) {
  const parties = plierCouleur(couleur).split(" et ").map((p) => p.trim());
  return parties.map((p) => PALETTE_MULDO[p] || "#6b6156");
}

function slugCouleur(couleur) {
  return plierCouleur(couleur).replace(/\s+/g, "-");
}

function MuldoBadge({ couleur, taille = 22 }) {
  const [imageKo, setImageKo] = useState(false);
  const teintes = teintesDeCouleur(couleur);
  const r = taille / 2;

  if (!imageKo) {
    return (
      <img
        src={`muldos/${slugCouleur(couleur)}.png`}
        alt=""
        title={couleur}
        onError={() => setImageKo(true)}
        style={{ width: taille, height: taille, objectFit: "contain", verticalAlign: "middle", borderRadius: 4 }}
      />
    );
  }

  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" style={{ verticalAlign: "middle", flexShrink: 0 }}>
      <title>{couleur}</title>
      {teintes.length >= 2 ? (
        <>
          <path d="M 12 1 A 11 11 0 0 0 12 23 Z" fill={teintes[0]} />
          <path d="M 12 1 A 11 11 0 0 1 12 23 Z" fill={teintes[1]} />
        </>
      ) : (
        <circle cx="12" cy="12" r="11" fill={teintes[0]} />
      )}
      <circle cx="12" cy="12" r="11" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
    </svg>
  );
}

// Génère et télécharge une image "carte d'éleveur" (900x520) pour un muldo —
// pensée pour être partagée telle quelle sur Discord/le forum. Dessine la
// pastille de couleur à la main (mêmes teintes que MuldoBadge) plutôt que de
// charger une image externe, pour rester fiable même sans visuel personnalisé.

function formatKamas(n) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0))} k`;
}

// Estimation de la valeur du cheptel. Dofus n'expose pas d'API HDV : les prix
// sont saisis à la main par couleur (une fois), persistés, et le total suit
// automatiquement l'évolution du cheptel. Les stériles sont comptés avec une
// décote réglable (leur valeur réelle est surtout le recyclage).
function EstimationKamasTable({ cheptel, storageKey, generationDeCouleurFn, nomHdv, labelExtraction, icone, badge: Badge }) {
  const [config, setConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved === "object") {
        return {
          prix: saved.prix || {},
          decoteSterile: Number.isFinite(saved.decoteSterile) ? saved.decoteSterile : 20,
          prixAmbre: Number.isFinite(saved.prixAmbre) ? saved.prixAmbre : 20000,
        };
      }
    } catch (e) {
      console.error("Grille de prix illisible", e);
    }
    return { prix: {}, decoteSterile: 20, prixAmbre: 20000 };
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  }, [config, storageKey]);

  const lignes = useMemo(() => {
    const parCouleur = new Map();
    (cheptel || []).forEach((m) => {
      const c = m.couleur;
      if (!parCouleur.has(c)) parCouleur.set(c, { couleur: c, fertiles: 0, steriles: 0, seniles: 0 });
      const ligne = parCouleur.get(c);
      if (m.senile) ligne.seniles += 1;
      else if (m.sterile) ligne.steriles += 1;
      else ligne.fertiles += 1;
    });
    return [...parCouleur.values()]
      .map((l) => {
        const prixUnitaire = Number(config.prix[l.couleur]) || 0;
        const sousTotal = l.fertiles * prixUnitaire
          + (l.steriles + l.seniles) * prixUnitaire * (config.decoteSterile / 100);
        const generation = generationDeCouleurFn(l.couleur);
        // Extraction : rendement = numéro de génération en ressources (dès la gen 2).
        // Exception : un individu SÉNILE ne rend qu'une seule ressource.
        const valeurExtraction = generation >= 2
          ? ((l.fertiles + l.steriles) * generation + l.seniles * 1) * (Number(config.prixAmbre) || 0)
          : 0;
        return { ...l, prixUnitaire, sousTotal, generation, valeurExtraction };
      })
      .sort((a, b) => (a.generation - b.generation) || a.couleur.localeCompare(b.couleur, "fr"));
  }, [cheptel, config, generationDeCouleurFn]);

  const total = lignes.reduce((n, l) => n + l.sousTotal, 0);
  const totalExtraction = lignes.reduce((n, l) => n + l.valeurExtraction, 0);
  const totalOptimal = lignes.reduce((n, l) => n + Math.max(l.sousTotal, l.valeurExtraction), 0);
  const sansPrix = lignes.filter((l) => !l.prixUnitaire).length;

  // Clic sur une couleur → copie "<Créature> <Couleur>" (nom exact à l'HDV créatures).
  const [copie, setCopie] = useState(null);
  const copierNomHdv = async (couleur) => {
    if (await copierPressePapiers(`${nomHdv} ${couleur}`)) {
      setCopie(couleur);
      setTimeout(() => setCopie((c) => (c === couleur ? null : c)), 1500);
    }
  };

  const setPrixCouleur = (couleur, valeur) => {
    setConfig((prev) => ({
      ...prev,
      prix: { ...prev.prix, [couleur]: valeur === "" ? "" : Math.max(0, Number(valeur) || 0) },
    }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{icone} Valeur estimée — {nomHdv}</h2>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--gold)", fontSize: 22, fontWeight: 900 }}>{formatKamas(total)}</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>
            extraction : {formatKamas(totalExtraction)} · optimum (meilleur des deux par ligne) : {formatKamas(totalOptimal)}
          </div>
        </div>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
        Saisis le prix HDV unitaire par couleur (persisté sur ce navigateur) — pas d'API officielle, donc
        mise à jour manuelle. Clique sur une couleur pour copier son nom complet et le coller dans la
        recherche de l'HDV créatures.{" "}
        {sansPrix > 0 && <span style={{ color: "#e8896a" }}>{sansPrix} couleur(s) sans prix : elles comptent pour 0.</span>}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
        Valeur d'un stérile :
        <input
          type="number"
          className="field"
          min={0}
          max={100}
          value={config.decoteSterile}
          onChange={(e) => setConfig((prev) => ({ ...prev, decoteSterile: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
          style={{ width: 70 }}
        />
        % du prix d'un fertile
        <span style={{ margin: "0 6px", color: "var(--text-faint, var(--muted))" }}>·</span>
        Prix de « {labelExtraction} » :
        <input
          type="number"
          className="field"
          min={0}
          value={config.prixAmbre}
          onChange={(e) => setConfig((prev) => ({ ...prev, prixAmbre: Math.max(0, Number(e.target.value) || 0) }))}
          style={{ width: 90 }}
        />
        k (extraction : génération × quantité, dès la gen 2)
      </label>

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <div style={{ minWidth: 640, display: "grid", gridTemplateColumns: "minmax(150px, 1fr) 60px 60px 130px 120px 120px", gap: 8, fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <span>Couleur</span><span>Fert.</span><span>Stér.</span><span>Prix unitaire</span><span style={{ textAlign: "right" }}>Sous-total HDV</span><span style={{ textAlign: "right" }}>Extraction</span>
        </div>
        {lignes.map((l) => (
          <div key={l.couleur} style={{ minWidth: 640, display: "grid", gridTemplateColumns: "minmax(150px, 1fr) 60px 60px 130px 120px 120px", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
            <span>
              <button
                type="button"
                onClick={() => copierNomHdv(l.couleur)}
                title={`Copier « ${nomHdv} ${l.couleur} » pour la recherche HDV`}
                style={{ background: "none", border: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
              >
                {Badge ? <Badge couleur={l.couleur} taille={18} /> : icone}{" "}{l.couleur}
              </button>{" "}
              <span style={{ color: "var(--muted)", fontSize: 11 }}>G{l.generation}</span>
              {copie === l.couleur && (
                <span style={{ color: "var(--gold)", fontSize: 11, marginLeft: 6 }}>✓ copié</span>
              )}
            </span>
            <span>{l.fertiles}</span>
            <span style={{ color: "var(--muted)" }}>{l.steriles}</span>
            <input
              type="number"
              className="field"
              min={0}
              placeholder="prix en k"
              value={config.prix[l.couleur] ?? ""}
              onChange={(e) => setPrixCouleur(l.couleur, e.target.value)}
              style={{ width: "100%", padding: "4px 8px" }}
            />
            <span style={{ textAlign: "right", color: l.sousTotal ? "var(--text)" : "var(--muted)" }}>{formatKamas(l.sousTotal)}</span>
            <span
              title={l.generation >= 2
                ? `${l.fertiles + l.steriles} individu(s) × ${l.generation} ${labelExtraction}(s) × ${formatKamas(config.prixAmbre)}${l.valeurExtraction > l.sousTotal ? " — l'extraction rapporte plus que la vente HDV" : ""}`
                : "Génération 1 : extraction impossible"}
              style={{
                textAlign: "right",
                color: l.valeurExtraction > l.sousTotal && l.valeurExtraction > 0 ? "var(--gold)" : "var(--muted)",
                fontWeight: l.valeurExtraction > l.sousTotal && l.valeurExtraction > 0 ? 700 : 400,
              }}
            >
              {l.generation >= 2 ? formatKamas(l.valeurExtraction) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Trois créatures, trois économies distinctes (couleurs, générations, prix
// différents) : un sélecteur au lieu de tout empiler dans un seul tableau.
const CREATURES_ESTIMATION = [
  { cle: "muldo", label: "Muldo", icone: "🐴", nomHdv: "Muldo", labelExtraction: "Ambre", storageKey: STORAGE_PRIX_KAMAS, generationDeCouleurFn: generationDeCouleur, badge: MuldoBadge },
  { cle: "dragodinde", label: "Dragodinde", icone: "🐲", nomHdv: "Dragodinde", labelExtraction: "Neurone de Dragodinde", storageKey: STORAGE_PRIX_KAMAS_DRAGODINDE, generationDeCouleurFn: generationDeCouleurDragodinde },
  { cle: "volkorne", label: "Volkorne", icone: "🐎", nomHdv: "Volkorne", labelExtraction: "Corne de Volkorne", storageKey: STORAGE_PRIX_KAMAS_VOLKORNE, generationDeCouleurFn: generationDeCouleurVolkorne },
];

function EstimationKamasSelecteur({ cheptelMuldo, cheptelDragodinde, cheptelVolkorne }) {
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
      />
    </div>
  );
}

// Recherche déroulante générique sur les muldos : préfixe (sans accents/casse)
// sur le NOM ou la COULEUR, tous les résultats dans une liste scrollable.
function RechercheMuldoDeroulante({ muldos, valeurId, onChoisir, placeholder, exclureId }) {
  const [recherche, setRecherche] = useState("");
  const [ferme, setFerme] = useState(true);

  const etiquette = (m) => `${m.nom || m.id?.slice(0, 6)} — ${m.couleur} ${sexeMuldo(m) === "F" ? "♀" : sexeMuldo(m) === "M" ? "♂" : "?"} · G${generationDeCouleur(m.couleur)} · ${muldoReproductible(m) ? "fertile" : "stérile"}`;
  const choisi = (muldos || []).find((m) => m.id === valeurId) || null;
  const prefixe = plierCouleur(recherche.trim());
  // L'ordre est décidé par l'appelant (ex. priorité même couleur/même sexe
  // pour le clonage) : on filtre seulement par préfixe, sans re-trier.
  const suggestions = (!ferme && prefixe)
    ? (muldos || [])
        .filter((m) => m.id !== exclureId
          && (plierCouleur(m.nom || "").startsWith(prefixe) || plierCouleur(m.couleur || "").startsWith(prefixe)))
        .slice(0, 60)
    : [];

  return (
    <div style={{ position: "relative", minWidth: 260 }}>
      <input
        className="field"
        placeholder={placeholder}
        value={recherche}
        onChange={(e) => { setRecherche(e.target.value); setFerme(false); }}
        style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
      />
      {choisi && (
        <div style={{ color: "var(--gold)", fontSize: 12, marginTop: 4 }}>→ {etiquette(choisi)}</div>
      )}
      {!ferme && prefixe && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          zIndex: 20,
          minWidth: 260,
          maxHeight: 230,
          overflowY: "auto",
          background: "var(--panel, #1d1710)",
          border: "1px solid var(--gold)",
          borderRadius: 10,
          boxShadow: "0 12px 30px rgba(0,0,0,.45)",
          padding: 4,
        }}>
          {suggestions.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 12, padding: "6px 8px" }}>
              aucun muldo dont le nom ou la couleur commence par « {recherche.trim()} »
            </div>
          )}
          {suggestions.map((m) => (
            <div
              key={m.id}
              onClick={() => { onChoisir(m.id); setRecherche(""); setFerme(true); }}
              style={{ padding: "5px 8px", fontSize: 13, cursor: "pointer", borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <MuldoBadge couleur={m.couleur} taille={16} />{" "}{etiquette(m)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
function AuthPanel({ profilLocal, pretMdp, onFini }) {
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
        const { error } = await supabase.auth.signUp({ email: mail, password: motDePasse, options: { data: { pseudo: p } } });
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
function ProfilModal({ compte, profilLocal, setProfilLocal, onClose }) {
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 100%)", background: "linear-gradient(180deg, rgba(53,43,34,.99), rgba(43,36,29,.99))", border: "1px solid var(--gold)", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 22 }}>
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
            <AuthPanel profilLocal={profilLocal} pretMdp={pretMdp} onFini={rafraichirProfil} />
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
              {LIEN_DON && (
                <a className="btn btn-coral" href={LIEN_DON} target="_blank" rel="noreferrer" style={{ marginTop: 12, textDecoration: "none", display: "inline-flex" }}>💛 Soutenir le Registre</a>
              )}
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 8 }}>
                Indique ton pseudo dans le message du don : les ailes sont attribuées manuellement (Stripe automatisera ça plus tard).
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

function TavernePage({ compte, onOuvrirProfil }) {
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
      .select("id, pseudo, style_ailes, niveau_ailes, succes_generation_muldo, couleurs_decouvertes_muldo, description, cree_le")
      .order("succes_generation_muldo", { ascending: false })
      .order("couleurs_decouvertes_muldo", { ascending: false })
      .limit(20);
    setClassement(data || []);
    const carte = {};
    (data || []).forEach((p) => { carte[p.id] = p; });
    setProfilsParId((prev) => ({ ...prev, ...carte }));
  };
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(360px, 100%)", background: "linear-gradient(180deg, rgba(53,43,34,.99), rgba(43,36,29,.99))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 20 }}>
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)", background: "linear-gradient(180deg, rgba(53,43,34,.99), rgba(43,36,29,.99))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>🏆 Classement des éleveurs</h3>
          <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕ Fermer</button>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
          Classé par générations muldo validées (page Succès), puis par couleurs découvertes.
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
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", borderRadius: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ width: 26, textAlign: "center", fontWeight: 800, color: "var(--gold2)" }}>{MEDAILLES[i] || i + 1}</span>
                <PseudoAvecAiles pseudo={p.pseudo} soutien={p.niveau_ailes > 0} styleAiles={p.style_ailes} niveau={niveauEffectif} taille={20} />
              </div>
              <div style={{ display: "flex", gap: 14, color: "var(--muted)", fontSize: 12, flex: "0 0 auto" }}>
                <span>G<b style={{ color: "var(--text)" }}>{p.succes_generation_muldo || 0}</b></span>
                <span><b style={{ color: "var(--text)" }}>{p.couleurs_decouvertes_muldo || 0}</b> couleurs</span>
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", background: "linear-gradient(180deg, rgba(53,43,34,.99), rgba(43,36,29,.99))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, rgba(53,43,34,.99), rgba(43,36,29,.99))", border: "1px solid var(--gold)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: 18 }}>
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
function suggererClonages(cheptel, objectif, generationFiltre) {
  const candidats = (cheptel || [])
    .filter((m) => !muldoReproductible(m))
    .filter((m) => !generationFiltre || generationDeCouleur(m.couleur) === generationFiltre);
  if (candidats.length < 2) return [];
  const { distances } = distancesEtParentsVersObjectif(objectif);
  const fertilesParCouleur = new Map();
  (cheptel || []).filter(muldoReproductible).forEach((m) => {
    fertilesParCouleur.set(m.couleur, (fertilesParCouleur.get(m.couleur) || 0) + 1);
  });
  const scoreCouleur = (couleur) => {
    const d = distances[couleur];
    let score = d === undefined ? 0 : Math.max(0, 8 - d) * 10;
    if (!fertilesParCouleur.get(couleur)) score += 30;
    return score;
  };
  const raisonCouleur = (couleur) => {
    const morceaux = [];
    const d = distances[couleur];
    if (d === 0) morceaux.push("c'est l'objectif du GPS !");
    else if (d !== undefined) morceaux.push(`à ${d} étape(s) de l'objectif`);
    if (!fertilesParCouleur.get(couleur)) morceaux.push("plus aucun fertile de cette couleur");
    return morceaux.join(" · ") || "hors du chemin de l'objectif";
  };

  const parGeneration = new Map();
  candidats.forEach((m) => {
    const g = generationDeCouleur(m.couleur);
    if (!parGeneration.has(g)) parGeneration.set(g, []);
    parGeneration.get(g).push(m);
  });

  const paires = [];
  parGeneration.forEach((membres, generation) => {
    for (let i = 0; i < membres.length; i += 1) {
      for (let j = i + 1; j < membres.length; j += 1) {
        const a = membres[i];
        const b = membres[j];
        const memeCouleur = a.couleur === b.couleur;
        const score = memeCouleur
          ? scoreCouleur(a.couleur) + 5 // résultat garanti : petit bonus
          : (scoreCouleur(a.couleur) + scoreCouleur(b.couleur)) / 2;
        paires.push({ a, b, generation, score, memeCouleur });
      }
    }
  });

  paires.sort((x, y) => y.score - x.score);
  const utilises = new Set();
  const retenues = [];
  paires.forEach((p) => {
    if (retenues.length >= 6 || p.score <= 0) return;
    if (utilises.has(p.a.id) || utilises.has(p.b.id)) return;
    utilises.add(p.a.id);
    utilises.add(p.b.id);
    retenues.push({
      ...p,
      raisons: [...new Set([p.a.couleur, p.b.couleur])].map((c) => ({ couleur: c, texte: raisonCouleur(c) })),
    });
  });
  return retenues;
}

function ClonagePage({ fusion, cheptel, objectif, journal, onVoirMuldo }) {
  const { muldos, fusionA, fusionB, setFusionA, setFusionB, onFusion } = fusion;
  const [choix, setChoix] = useState({ couleur: null, sexe: null });
  const A = (muldos || []).find((m) => m.id === fusionA) || null;
  const B = (muldos || []).find((m) => m.id === fusionB) || null;
  const genA = A ? generationDeCouleur(A.couleur) : null;
  const genB = B ? generationDeCouleur(B.couleur) : null;
  const memeGeneration = A && B && genA === genB;
  const pret = A && B && A.id !== B.id && memeGeneration;

  // Seuls les stériles sont clonables : on ne les propose jamais mélangés aux fertiles.
  const candidatsSteriles = useMemo(
    () => (muldos || []).filter((m) => !muldoReproductible(m)),
    [muldos]
  );

  // Filtre de génération pour les suggestions (facultatif) : "toutes" ou un numéro précis.
  const generationsDisponibles = useMemo(
    () => [...new Set(candidatsSteriles.map((m) => generationDeCouleur(m.couleur)))].sort((a, b) => a - b),
    [candidatsSteriles]
  );
  const [genFiltre, setGenFiltre] = useState("toutes");
  const suggestionsClonage = suggererClonages(cheptel, objectif, genFiltre === "toutes" ? null : Number(genFiltre));

  // Une fois l'un des deux muldos choisi, l'autre sélecteur se limite à sa
  // génération et priorise : même couleur + même sexe > même couleur + sexe
  // différent > le reste (couleur différente, le sexe n'a alors pas d'importance).
  const candidatsPour = (autre) => {
    if (!autre) {
      return [...candidatsSteriles].sort((x, y) =>
        (x.couleur || "").localeCompare(y.couleur || "", "fr") || (x.nom || "").localeCompare(y.nom || "", "fr")
      );
    }
    const genRef = generationDeCouleur(autre.couleur);
    const sexeAutre = sexeMuldo(autre);
    const priorite = (m) => {
      if (m.couleur === autre.couleur && sexeMuldo(m) === sexeAutre) return 0;
      if (m.couleur === autre.couleur) return 1;
      return 2;
    };
    return candidatsSteriles
      .filter((m) => generationDeCouleur(m.couleur) === genRef)
      .sort((x, y) => priorite(x) - priorite(y)
        || (x.couleur || "").localeCompare(y.couleur || "", "fr")
        || (x.nom || "").localeCompare(y.nom || "", "fr"));
  };
  const candidatsA = useMemo(() => candidatsPour(B), [candidatsSteriles, B]);
  const candidatsB = useMemo(() => candidatsPour(A), [candidatsSteriles, A]);

  // Deux parents de même sexe donnent obligatoirement un bébé du même sexe.
  const sexeA = A ? sexeMuldo(A) : null;
  const sexeB = B ? sexeMuldo(B) : null;
  const sexeImpose = (sexeA && sexeA === sexeB) ? sexeA : null;
  const sexeChoisi = sexeImpose || choix.sexe;

  return (
    <div>
      <div className="panel-card">
        <h2 style={{ marginTop: 0 }}>Clonage des stériles</h2>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
          Deux montures stériles de <b>même génération</b> sont détruites pour créer une nouvelle
          monture <b>Fertile</b>, d'une des deux couleurs (tirage du jeu). La généalogie est
          conservée, mais les capacités sont perdues et les jauges remises à zéro.{" "}
          {candidatsSteriles.length} stérile(s) disponible(s) pour le clonage — les fertiles
          n'apparaissent pas ici, ils arriveront au fil des reproductions consommées. Une fois le
          premier muldo choisi, le second se limite à sa génération, en priorité même couleur/même
          sexe, puis même couleur, puis le reste.
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <RechercheMuldoDeroulante
            muldos={candidatsA}
            valeurId={fusionA}
            exclureId={fusionB}
            onChoisir={setFusionA}
            placeholder="Muldo A : nom ou couleur…"
          />
          <span style={{ color: "var(--gold2)", fontSize: 20, alignSelf: "center" }}>+</span>
          <RechercheMuldoDeroulante
            muldos={candidatsB}
            valeurId={fusionB}
            exclureId={fusionA}
            onChoisir={setFusionB}
            placeholder="Muldo B : nom ou couleur…"
          />
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <b>Résultat du clonage</b>
        {!A || !B ? (
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
            Choisis deux muldos stériles pour voir ce que le clonage peut donner.
          </div>
        ) : !memeGeneration ? (
          <div style={{ color: "#e8896a", fontSize: 13, marginTop: 8 }}>
            ⚠ Générations différentes (G{genA} + G{genB}) : le clonage est impossible en jeu.
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <div>
              Une monture <b>Fertile</b> de génération <b>G{genA}</b>, au choix du jeu (≈ 50/50) :
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              {[...new Set([A.couleur, B.couleur])].map((couleur) => (
                <button
                  key={couleur}
                  type="button"
                  className="pill"
                  onClick={() => setChoix((prev) => ({ ...prev, couleur }))}
                  style={{
                    padding: "6px 12px",
                    fontSize: 14,
                    cursor: "pointer",
                    border: choix.couleur === couleur ? "1px solid var(--gold)" : "1px solid transparent",
                    color: choix.couleur === couleur ? "var(--gold)" : "inherit",
                    background: "none",
                  }}
                >
                  {couleur}
                </button>
              ))}
              {A.couleur === B.couleur && (
                <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>
                  (mêmes couleurs : résultat garanti)
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Sexe obtenu :</span>
              {sexeImpose ? (
                <span className="pill" style={{ padding: "6px 12px", fontSize: 14, border: "1px solid var(--gold)", color: "var(--gold)" }}>
                  {sexeImpose === "M" ? "♂ Mâle" : "♀ Femelle"} — imposé (les deux parents sont {sexeImpose === "M" ? "mâles" : "femelles"})
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={choix.sexe === "M" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
                    onClick={() => setChoix((prev) => ({ ...prev, sexe: "M" }))}
                  >
                    ♂ Mâle
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={choix.sexe === "F" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
                    onClick={() => setChoix((prev) => ({ ...prev, sexe: "F" }))}
                  >
                    ♀ Femelle
                  </button>
                </>
              )}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
              {sexeImpose ? "Sexe imposé par les parents" : "Sexe aléatoire"} · capacités perdues · jauges à
              zéro · généalogie des deux parents conservée.
            </div>
            <button
              className="btn btn-coral"
              style={{ marginTop: 12, opacity: (A.couleur === B.couleur || choix.couleur) && sexeChoisi ? 1 : 0.5 }}
              disabled={!((A.couleur === B.couleur || choix.couleur) && sexeChoisi)}
              onClick={() => {
                onFusion(A.couleur === B.couleur ? A.couleur : choix.couleur, sexeChoisi);
                setChoix({ couleur: null, sexe: null });
              }}
            >
              Cloner — enregistrer ce résultat
            </button>
            {!((A.couleur === B.couleur || choix.couleur) && sexeChoisi) && (
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                Fais le clonage en jeu, puis sélectionne la couleur et le sexe réellement obtenus.
              </div>
            )}
          </div>
        )}
        {A && B && A.id === B.id && (
          <div style={{ color: "#e8896a", fontSize: 13, marginTop: 8 }}>⚠ Choisis deux muldos différents.</div>
        )}
        {!pret && A && B && memeGeneration && A.id !== B.id && null}
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Clonages suggérés</h2>
          {generationsDisponibles.length > 1 && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              Génération :
              <select className="field" value={genFiltre} onChange={(e) => setGenFiltre(e.target.value)} style={{ padding: "4px 8px", fontSize: 12 }}>
                <option value="toutes">Toutes</option>
                {generationsDisponibles.map((g) => <option key={g} value={g}>G{g}</option>)}
              </select>
            </label>
          )}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10, marginTop: 6 }}>
          Classés selon ton objectif GPS actuel (<b style={{ color: "var(--gold2)" }}>{objectif}</b>) :
          priorité aux couleurs proches de l'objectif et à celles dont tu n'as plus aucun fertile.
          Un clic remplit les deux sélecteurs — fais le clonage en jeu, puis enregistre le résultat réel.
          Limité à 6 suggestions à la fois (chaque muldo n'apparaît que dans une seule paire) — les
          autres remontent au fil des clonages effectués.
        </div>
        {suggestionsClonage.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Aucune suggestion {genFiltre !== "toutes" ? `pour la génération ${genFiltre}` : "pour le moment"}.
          </div>
        )}
        {suggestionsClonage.map((s) => (
            <div key={`${s.a.id}|${s.b.id}`} style={{
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
              borderTop: "1px solid rgba(255,255,255,.06)", padding: "9px 0",
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MuldoBadge couleur={s.a.couleur} taille={17} /> {s.a.nom || s.a.couleur}
                <BoutonFiche id={s.a.id} onVoir={onVoirMuldo} label={s.a.nom || s.a.couleur} />
                <span style={{ color: "var(--gold2)" }}>+</span>
                <MuldoBadge couleur={s.b.couleur} taille={17} /> {s.b.nom || s.b.couleur}
                <BoutonFiche id={s.b.id} onVoir={onVoirMuldo} label={s.b.nom || s.b.couleur} />
                <span className="pill" style={{ padding: "2px 8px", fontSize: 11 }}>G{s.generation}</span>
              </span>
              <span style={{ color: "var(--muted)", fontSize: 12, flex: 1, minWidth: 200 }}>
                {s.memeCouleur
                  ? <>résultat garanti : <b>{s.a.couleur}</b> — {s.raisons[0].texte}</>
                  : s.raisons.map((r, i) => (
                      <span key={r.couleur}>{i > 0 && " · "}<b>{r.couleur}</b> : {r.texte}</span>
                    ))}
              </span>
              <button
                className="btn btn-ghost"
                onClick={() => { setFusionA(s.a.id); setFusionB(s.b.id); }}
              >
                Choisir ce duo
              </button>
            </div>
          ))}
      </div>

      <BebesARenommerPanel journal={journal} BadgeComponent={MuldoBadge} />
    </div>
  );
}

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

// Vrai si des visuels d'ailes en paires sont installés (public/ailes/*.png).
let AILES_IMAGES_DISPO = null;
function ailesImagesDisponibles() {
  if (AILES_IMAGES_DISPO === null) {
    AILES_IMAGES_DISPO = false;
    const test = new Image();
    test.onload = () => { AILES_IMAGES_DISPO = true; };
    test.src = "ailes/muldo-1.png";
  }
  return AILES_IMAGES_DISPO;
}

// Une aile isolée pour encadrer un pseudo. Si un fichier dédié existe
// (muldo-5-gauche.png / -droite.png) il est utilisé tel quel ; sinon on
// recadre à la volée une moitié de la paire complète ; sinon repli SVG.
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




function BarreEmpilee({ segments, hauteur = 14 }) {
  const total = segments.reduce((n, s) => n + s.valeur, 0) || 1;
  return (
    <div style={{ display: "flex", height: hauteur, borderRadius: 7, overflow: "hidden", background: "rgba(255,255,255,.05)" }}>
      {segments.map((s) => s.valeur > 0 && (
        <div key={s.label} title={`${s.label} : ${s.valeur}`} style={{ width: `${s.valeur / total * 100}%`, background: s.couleur }} />
      ))}
    </div>
  );
}

function GraphiquesPanel({ cheptel, journal, instantanes }) {
  // Répartition par génération (barres horizontales)
  const parGeneration = new Map();
  (cheptel || []).forEach((m) => {
    const g = generationDeCouleur(m.couleur);
    parGeneration.set(g, (parGeneration.get(g) || 0) + 1);
  });
  const generations = Array.from({ length: 10 }, (_, i) => ({ label: `G${i + 1}`, valeur: parGeneration.get(i + 1) || 0 }));
  const maxGeneration = Math.max(1, ...generations.map((g) => g.valeur));

  const males = (cheptel || []).filter((m) => sexeMuldo(m) === "M").length;
  const femelles = (cheptel || []).filter((m) => sexeMuldo(m) === "F").length;
  const fertiles = (cheptel || []).filter(muldoReproductible).length;
  const nonFertiles = (cheptel || []).length - fertiles;

  // Naissances des 14 derniers jours
  const jours = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const naissancesParJour = jours.map((jour) => ({
    jour,
    valeur: (journal || []).filter((n) => String(n.date || "").slice(0, 10) === jour).length,
  }));
  const maxNaissances = Math.max(1, ...naissancesParJour.map((j) => j.valeur));

  // Courbe d'évolution (instantanés quotidiens)
  const points = (instantanes || []).slice(-60);
  const courbe = (serie, couleur) => {
    if (points.length < 2) return null;
    const valeurs = points.map(serie);
    const min = Math.min(...valeurs);
    const max = Math.max(...valeurs, min + 1);
    const coords = valeurs.map((v, i) => `${(i / (points.length - 1)) * 330 + 5},${95 - ((v - min) / (max - min)) * 85}`).join(" ");
    return <polyline points={coords} fill="none" stroke={couleur} strokeWidth="2" />;
  };

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Progression</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>

        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ color: "var(--gold)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Cheptel par génération</div>
          {generations.map((g) => (
            <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
              <span style={{ width: 30, fontSize: 11, color: "var(--muted)" }}>{g.label}</span>
              <div style={{ flex: 1, height: 12, borderRadius: 6, background: "rgba(255,255,255,.05)" }}>
                <div style={{ width: `${g.valeur / maxGeneration * 100}%`, height: "100%", borderRadius: 6, background: "var(--gold)", opacity: 0.35 + 0.65 * (g.valeur / maxGeneration), minWidth: g.valeur ? 4 : 0 }} />
              </div>
              <span style={{ width: 28, fontSize: 11, textAlign: "right" }}>{g.valeur || ""}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
          <div style={{ color: "var(--gold)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Équilibres</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>♂ {males} / ♀ {femelles}</div>
          <BarreEmpilee segments={[
            { label: "Mâles", valeur: males, couleur: "#6fa8dc" },
            { label: "Femelles", valeur: femelles, couleur: "#d98ec0" },
          ]} />
          <div style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 4px" }}>Fertiles {fertiles} / Stériles+séniles {nonFertiles}</div>
          <BarreEmpilee segments={[
            { label: "Fertiles", valeur: fertiles, couleur: "var(--gold)" },
            { label: "Stériles/séniles", valeur: nonFertiles, couleur: "#8a7a63" },
          ]} />

          <div style={{ color: "var(--gold)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, margin: "14px 0 6px" }}>Naissances (14 jours)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 46 }}>
            {naissancesParJour.map((j) => (
              <div key={j.jour} title={`${j.jour} : ${j.valeur} naissance(s)`} style={{ flex: 1, height: `${Math.max(j.valeur / maxNaissances * 100, j.valeur ? 12 : 3)}%`, background: j.valeur ? "var(--gold)" : "rgba(255,255,255,.08)", borderRadius: 3 }} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span>il y a 14 j</span><span>aujourd'hui</span>
          </div>
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 260 }}>
          <div style={{ color: "var(--gold)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Évolution (un point par jour d'ouverture)
          </div>
          {points.length < 2 ? (
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              La courbe se construit toute seule : un instantané du cheptel est pris à chaque première
              ouverture de la journée. Reviens demain pour voir les premiers tracés.
            </div>
          ) : (
            <>
              <svg viewBox="0 0 340 100" style={{ width: "100%", height: "auto" }}>
                <line x1="5" y1="95" x2="335" y2="95" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
                {courbe((p) => p.total, "var(--gold)")}
                {courbe((p) => p.couleurs, "#6fa8dc")}
                {courbe((p) => p.naissances, "#d98ec0")}
              </svg>
              <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span><span style={{ color: "var(--gold)" }}>—</span> muldos ({points[points.length - 1].total})</span>
                <span><span style={{ color: "#6fa8dc" }}>—</span> couleurs ({points[points.length - 1].couleurs})</span>
                <span><span style={{ color: "#d98ec0" }}>—</span> naissances cumulées ({points[points.length - 1].naissances})</span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

function MemoElevagePanel() {
  const [ouvert, setOuvert] = useState(false);
  const bloc = (titre, contenu) => (
    <div style={{ minWidth: 240, flex: "1 1 260px" }}>
      <div style={{ color: "var(--gold)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{titre}</div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4, lineHeight: 1.55 }}>{contenu}</div>
    </div>
  );
  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOuvert((o) => !o)}
      >
        <h2 style={{ margin: 0 }}>Mémo élevage {ouvert ? "▾" : "▸"}</h2>
        <span style={{ color: "var(--muted)", fontSize: 11 }}>
          d'après le guide Muldos de{" "}
          <a href="https://dafous.app/guides/muldos.html" target="_blank" rel="noreferrer" style={{ color: "var(--gold)" }} onClick={(e) => e.stopPropagation()}>
            dafous.app
          </a>
        </span>
      </div>
      {ouvert && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
          {bloc("Capture (génération 1)", (
            <>Les 5 couleurs de base (Doré, Ébène, Indigo, Pourpre, Orchidée) se capturent au Bassin des
            Muldos, Baie de Sufokia — accès par l'atelier des éleveurs de Sufokia [19,23] ou le Territoire
            des Bandits [15,19]. Monstres niveau 62-70 (~1000 PV). La monture capturée arrive niveau 1 ;
            la duplication d'un filet conserve la couleur mais pas forcément le sexe.</>
          ))}
          {bloc("Filets (palier métier éleveur)", (
            <>Universel dès le niveau 1 · multiplicateur (duplication) au 100 · renforcé (capture en zone,
            rayon 3) au 150 · multiplicateur renforcé (zone + duplication) au 200 — le meilleur pour le farm.</>
          ))}
          {bloc("Expérience", (
            <>Équipable par un personnage niveau 60+. Depuis la 3.5, l'XP passe par la mangeoire d'enclos.
            Repères : ≈ 172 668 XP cumulés au niveau 100, ≈ 867 582 au niveau 200 — le palier 100→200
            coûte plus de 5 fois le 1→100.</>
          ))}
          {bloc("Cycle & extraction", (
            <>Cycle de reproduction : Fertile → Féconde → Stérile. L'extraction (dès la génération 2)
            consomme la monture contre des ressources : rendement = numéro de génération. Cas particulier :
            une monture sénile ne rend qu'une seule ressource, quelle que soit sa génération.</>
          ))}
          {bloc("Clonage", (
            <>Deux montures de même génération sont détruites pour créer une nouvelle monture Fertile,
            d'une des deux couleurs (et sexes) possibles. La généalogie est conservée, mais les capacités
            sont perdues et les jauges remises à zéro. À utiliser pour sécuriser une lignée pivot avant
            une extraction massive.</>
          ))}
          {bloc("Pivots de l'arbre (120 muldos)", (
            <>G3 : Roux et Amande, carrefours de la plupart des routes. G5 : Ivoire (esquive PA) et
            Turquoise (esquive PM). G7 : Prune et Émeraude. G9 : Ambre, Corail, Azur, Aigue-marine.
            G10 : 50 variantes finales — le clonage défensif y devient quasi indispensable. Capacités
            utiles à surveiller : Amoureuse, Endurante, Précoce, Reproducteur, Sage, Caméléone.</>
          ))}
        </div>
      )}
    </div>
  );
}



function SuccesDofusPage({
  historiqueCouleurs,
  cheptel,
  objectifGeneration,
  plan,
  onToggleCouleur,
  onValidateGeneration,
  onValidateAll,
  onResetHistory,
}) {
  const present = new Set(cheptel.map((m) => m.couleur));
  const seen = (c) => Boolean(historiqueCouleurs?.[c]) || present.has(c);
  const allColors = Object.values(GENERATIONS_MULDO).flat();
  const totalSeen = allColors.filter(seen).length;
  const totalPct = allColors.length ? Math.round((totalSeen / allColors.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "var(--gold)", fontSize: 12, fontWeight: 950, letterSpacing: 1.6, textTransform: "uppercase" }}>Succès</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>Pokédex des 120 Muldos</h1>
          <div style={{ color: "var(--muted)", marginTop: 7 }}>Clique sur une couleur pour indiquer que tu l'avais déjà obtenue avant d'utiliser l'outil.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--gold2)", fontSize: 30, fontWeight: 950 }}>{totalSeen}/{allColors.length}</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{totalPct}% complété</div>
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <b>Validation rapide de l'historique</b>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 5 }}>Les couleurs présentes dans ton cheptel restent automatiquement validées.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1,2,3,4,5,6,7,8,9,10].map((g) => (
              <button key={g} className="btn btn-ghost" onClick={() => onValidateGeneration(g)}>Tout G{g}</button>
            ))}
            <button className="btn btn-coral" onClick={onValidateAll}>Tout découvrir</button>
            <button className="btn btn-ghost" onClick={onResetHistory}>Réinitialiser le manuel</button>
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <b>Objectif jusqu'à G{objectifGeneration}</b>
        <div style={{ marginTop: 10 }} className="progress-bar">
          <div className="progress-fill" style={{ width: `${plan.objectif.length ? (plan.decouvertes.length / plan.objectif.length) * 100 : 0}%` }} />
        </div>
        <div style={{ color: "var(--muted)", marginTop: 10 }}>{plan.decouvertes.length} / {plan.objectif.length} couleurs validées</div>
      </div>

      {[1,2,3,4,5,6,7,8,9,10].map((g) => {
        const colors = GENERATIONS_MULDO[g] || [];
        const ok = colors.filter(seen).length;
        const pct = colors.length ? Math.round(ok / colors.length * 100) : 0;
        return (
          <div className="panel-card" key={g} style={{ marginBottom: 14, borderColor: g === 10 ? "var(--gold)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div>
                <h2 style={{ margin: 0 }}>Génération {g}{g === 10 ? " — Finale" : ""}</h2>
                {g === 10 && <div style={{ color: "var(--gold2)", fontSize: 12, marginTop: 4 }}>50 croisements finaux à valider</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => onValidateGeneration(g)}>Valider toute la G{g}</button>
                <b style={{ color: "var(--gold2)" }}>{ok}/{colors.length} · {pct}%</b>
              </div>
            </div>
            <div className="progress-bar" style={{ marginBottom: 12 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            <div className="success-grid">
              {colors.map((c) => {
                const ownedNow = present.has(c);
                const checked = seen(c);
                return (
                  <button
                    type="button"
                    key={c}
                    className={`success-chip ${checked ? "success-ok" : "success-miss"}`}
                    onClick={() => !ownedNow && onToggleCouleur(c, !historiqueCouleurs?.[c])}
                    title={ownedNow ? "Présent dans le cheptel : validation automatique" : "Cliquer pour modifier l'historique"}
                    style={{ cursor: ownedNow ? "default" : "pointer", textAlign: "left", font: "inherit" }}
                  >
                    {checked ? "✅" : "⬜"} {c}{ownedNow ? " · cheptel" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LegendeCheptel() {
  const pastille = (couleur, halo) => (
    <span style={{
      width: 12, height: 12, borderRadius: 4, flexShrink: 0,
      border: `2px solid ${couleur}`,
      boxShadow: halo ? `0 0 0 2px ${halo}` : "none",
      background: "rgba(0,0,0,.25)",
    }} />
  );
  const item = (p, texte) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{p}{texte}</span>
  );
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "6px 18px",
      color: "var(--muted)", fontSize: 12, margin: "2px 2px 12px",
    }}>
      {item(pastille("rgba(104,193,111,.9)"), "prêt à accoupler (jauges au max)")}
      {item(pastille("var(--line)"), "fertile, jauges à monter en enclos")}
      {item(pastille("rgba(216,91,79,.8)"), "stérile / sénile (à cloner ou extraire)")}
      {item(pastille("var(--gold)", "rgba(214,166,74,.35)"), "fiche ouverte")}
    </div>
  );
}

function CheptelCards({ items, selectedId, onSelect }) {
  if (!items.length) {
    return <div style={{ color: "var(--muted)", textAlign: "center", padding: 18 }}>Aucun muldo trouvé.</div>;
  }
  return (
    <>
    <LegendeCheptel />
    <div className="muldo-grid">
      {items.map((m) => <MuldoMiniCard key={m.id} m={m} selected={selectedId === m.id} onClick={() => onSelect(m.id)} />)}
    </div>
    </>
  );
}

function MuldoMiniCard({ m, selected, onClick }) {
  const action = getNextAction(m);
  const sterile = !muldoReproductible(m);
  const ready = action.key === "pret";
  const sexe = sexeMuldo(m) === "F" ? "♀" : "♂";

  return (
    <div className={`muldo-card ${ready ? "muldo-ready" : ""} ${sterile ? "muldo-sterile" : ""} ${selected ? "muldo-selected" : ""}`} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <b>{sexe} {m.nom}</b>
        <span className="pill">G{m.generation}</span>
      </div>
      <div style={{ color: "var(--gold2)", fontWeight: 900, marginTop: 7 }}>{m.couleur}</div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>{m.statut} · {muldoReproductible(m) ? "1 reproduction" : "stérile"}</div>
      {capacitesMuldo(m).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {capacitesMuldo(m).map((c) => <span key={c} className="pill" style={{ padding: "4px 7px", fontSize: 10 }}>★ {c}</span>)}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
        <span>❤️ {Number(m.amour || 0)}</span>
        <span>⚡ {Number(m.endurance || 0)}</span>
        <span>✨ {Number(m.maturite || 0)}</span>
        <span>💧 {Number(m.serenite || 0)}</span>
      </div>
    </div>
  );
}

function CheptelOverviewPage({ cheptel, selectedId, setSelectedId, filter, setFilter, actionsDuJour, importProps }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ color: "var(--gold)", fontSize: 12, fontWeight: 950, letterSpacing: 1.6, textTransform: "uppercase" }}>Cheptel</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>Cartes de muldos</h1>
        </div>
        <div style={{ width: 280 }}>
          <input className="field" placeholder="Rechercher…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Actions du jour</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["Maturité", actionsDuJour.maturite.length],
            ["Amour", actionsDuJour.amour.length],
            ["Endurance", actionsDuJour.endurance.length],
            ["Prêts", actionsDuJour.pret.length],
            ["Repos", actionsDuJour.repos.length],
          ].map(([label, n]) => <div className="success-chip" key={label}><b>{n}</b><br /><span style={{ color: "var(--muted)" }}>{label}</span></div>)}
        </div>
      </div>

      <CheptelCards items={cheptel} selectedId={selectedId} onSelect={setSelectedId} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <ImportCapturePanel {...importProps} />
      </div>
    </div>
  );
}


function mapScanParCouleur(lignes) {
  return Object.fromEntries((lignes || []).map((ligne) => [ligne.couleur, Number(ligne.total || 0)]));
}

function creerMuldoSynchronise(couleur, sexe, index) {
  return normaliserMuldo({
    id: `sync-${sexe}-${couleur.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${index}-${uid()}`,
    nom: `${couleur} ${sexe === "F" ? "♀" : "♂"} #${index}`,
    sexe,
    couleur,
    generation: generationDeCouleur(couleur),
    statut: "Fertile",
    sterile: false,
    reproDone: 0,
    reproMax: 1,
    reproRestantes: 1,
    reproductionsRestantes: 1,
    capacites: [],
    capacite1: "Aucune",
    capacite2: "Aucune",
    reproductrice: false,
    amour: 100,
    endurance: 100,
    maturite: 100,
    serenite: 50,
    sourceSync: "dofus-filter",
    dateAjout: new Date().toISOString(),
    notes: "Créé depuis les compteurs des filtres Dofus.",
  });
}

function SynchronisationFiltresPage({ cheptel, updateCheptel, showToast, onVoirMuldo, onSupprimerMuldo }) {
  const TYPES_SCAN = [
    { key: "femelles", label: "Femelles", sexe: "F" },
    { key: "males", label: "Mâles", sexe: "M" },
    ...CAPACITES_MULDO.filter((c) => c !== "Aucune").map((c) => ({ key: `capacite:${c}`, label: c, capacite: c })),
  ];

  const [typeScan, setTypeScan] = useState("femelles");
  const [texte, setTexte] = useState("");
  const [preview, setPreview] = useState("");
  const [previews, setPreviews] = useState([]);
  const [ocrEnCours, setOcrEnCours] = useState(false);
  const [scans, setScans] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_SYNC_KEY) || "{}"); }
    catch { return {}; }
  });
  const [snapshotAvant, setSnapshotAvant] = useState(null);

  const lignes = useMemo(() => analyserTexteCaptureMuldo(texte), [texte]);
  const typeActuel = TYPES_SCAN.find((t) => t.key === typeScan) || TYPES_SCAN[0];

  const enregistrerScan = () => {
    if (!lignes.length) {
      showToast("Aucune couleur reconnue. Utilise le texte OCR de la colonne Couleurs.");
      return;
    }
    const inconnues = lignes.filter((l) => l.reconnu === false);
    if (inconnues.length) {
      showToast(`Couleur(s) non reconnue(s) : ${inconnues.map((l) => l.couleur).join(", ")}. Corrige le texte avant d'enregistrer.`);
      return;
    }
    const next = {
      ...scans,
      [typeScan]: {
        type: typeScan,
        label: typeActuel.label,
        date: new Date().toISOString(),
        lignes,
      },
    };
    setScans(next);
    localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(next));
    setTexte("");
    showToast(`Scan ${typeActuel.label} enregistré : ${lignes.reduce((n, l) => n + l.total, 0)} monture(s).`);
  };

  const supprimerScan = (key) => {
    const next = { ...scans };
    delete next[key];
    setScans(next);
    localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(next));
  };

  const femelles = mapScanParCouleur(scans.femelles?.lignes);
  const males = mapScanParCouleur(scans.males?.lignes);
  const capacites = Object.fromEntries(
    Object.entries(scans)
      .filter(([key]) => key.startsWith("capacite:"))
      .map(([key, scan]) => [key.slice("capacite:".length), mapScanParCouleur(scan.lignes)])
  );

  const couleurs = [...new Set([
    ...Object.keys(femelles),
    ...Object.keys(males),
    ...Object.values(capacites).flatMap((m) => Object.keys(m)),
  ])].sort((a, b) => a.localeCompare(b, "fr"));

  const totalFemelles = Object.values(femelles).reduce((a, b) => a + b, 0);
  const totalMales = Object.values(males).reduce((a, b) => a + b, 0);

  // ---------- Rapprochement différentiel (recommandé) ----------
  // Compare le scan au cheptel de l'appli et n'agit QUE sur les écarts :
  // les muldos reliés à une généalogie (parents connus ou descendants) ne sont
  // jamais retirés automatiquement ; les stériles partent en premier (ils ont
  // probablement été extraits en jeu).
  const idsParentsConnus = new Set(cheptel.flatMap((m) => m.parentIds || m.parents || []));
  const muldoProtege = (m) => (m.parentIds || m.parents || []).length > 0 || idsParentsConnus.has(m.id);

  const diffRapprochement = (() => {
    if (!scans.femelles || !scans.males) return [];
    const attendu = new Map();
    couleurs.forEach((couleur) => {
      const nf = Number(femelles[couleur] || 0);
      const nm = Number(males[couleur] || 0);
      if (nf) attendu.set(`${couleur}|F`, nf);
      if (nm) attendu.set(`${couleur}|M`, nm);
    });
    const groupes = new Map();
    cheptel.forEach((m) => {
      const s = sexeMuldo(m);
      if (!s) return;
      const cle = `${m.couleur}|${s}`;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(m);
    });
    const cles = new Set([...attendu.keys(), ...groupes.keys()]);
    const diff = [];
    cles.forEach((cle) => {
      const [couleur, sexe] = cle.split("|");
      const enJeu = attendu.get(cle) || 0;
      const membres = groupes.get(cle) || [];
      const ecart = enJeu - membres.length;
      if (!ecart) return;
      let aRetirer = [];
      let bloques = 0;
      let protegesListe = [];
      if (ecart < 0) {
        const candidats = membres
          .filter((m) => !muldoProtege(m))
          .sort((x, y) => Number(muldoReproductible(x)) - Number(muldoReproductible(y)));
        aRetirer = candidats.slice(0, -ecart);
        bloques = -ecart - aRetirer.length;
        if (bloques > 0) protegesListe = membres.filter(muldoProtege);
      }
      diff.push({ cle, couleur, sexe, enJeu, dansAppli: membres.length, ecart, aRetirer, bloques, protegesListe });
    });
    return diff.sort((a, b) => a.couleur.localeCompare(b.couleur, "fr") || a.sexe.localeCompare(b.sexe, "fr"));
  })();

  const totalAjouts = diffRapprochement.filter((d) => d.ecart > 0).reduce((n, d) => n + d.ecart, 0);
  const totalRetraits = diffRapprochement.reduce((n, d) => n + d.aRetirer.length, 0);
  const totalBloques = diffRapprochement.reduce((n, d) => n + d.bloques, 0);

  const appliquerRapprochement = () => {
    if (!scans.femelles || !scans.males) {
      showToast("Enregistre d'abord un scan Femelles et un scan Mâles.");
      return;
    }
    if (!diffRapprochement.length) {
      showToast("Aucun écart : l'appli est déjà alignée sur le jeu.");
      return;
    }
    setSnapshotAvant(cheptel);
    const idsARetirer = new Set(diffRapprochement.flatMap((d) => d.aRetirer.map((m) => m.id)));
    const ajouts = [];
    diffRapprochement.forEach((d) => {
      if (d.ecart > 0) {
        const existants = cheptel.filter((m) => m.couleur === d.couleur && sexeMuldo(m) === d.sexe).length;
        for (let i = 1; i <= d.ecart; i += 1) {
          ajouts.push(creerMuldoSynchronise(d.couleur, d.sexe, existants + i));
        }
      }
    });
    updateCheptel((prev) => [...prev.filter((m) => !idsARetirer.has(m.id)), ...ajouts]);
    showToast(`Rapprochement appliqué : +${ajouts.length} ajouté(s), −${idsARetirer.size} retiré(s), généalogies intactes.`);
  };

  const appliquerAuCheptel = () => {
    if (!scans.femelles || !scans.males) {
      showToast("Enregistre d'abord un scan Femelles et un scan Mâles.");
      return;
    }

    setSnapshotAvant(cheptel);
    const nouveau = [];
    couleurs.forEach((couleur) => {
      const nf = Number(femelles[couleur] || 0);
      const nm = Number(males[couleur] || 0);
      for (let i = 1; i <= nf; i += 1) nouveau.push(creerMuldoSynchronise(couleur, "F", i));
      for (let i = 1; i <= nm; i += 1) nouveau.push(creerMuldoSynchronise(couleur, "M", i));
    });

    updateCheptel(nouveau);
    showToast(`Cheptel reconstruit : ${nouveau.length} monture(s), dont ${totalFemelles} femelles et ${totalMales} mâles.`);
  };

  const restaurer = () => {
    if (!snapshotAvant) return;
    updateCheptel(snapshotAvant);
    setSnapshotAvant(null);
    showToast("Ancien cheptel restauré.");
  };

  const preparerImageOCR = async (file) => {
    const bitmap = await createImageBitmap(file);
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gris = Math.round(
        data[i] * 0.299 +
        data[i + 1] * 0.587 +
        data[i + 2] * 0.114
      );

      // Texte clair de Dofus sur fond sombre :
      // on renforce fortement le contraste pour aider Tesseract.
      const valeur = gris >= 105 ? 255 : 0;
      data[i] = valeur;
      data[i + 1] = valeur;
      data[i + 2] = valeur;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Prétraitement OCR impossible")),
        "image/png"
      );
    });
  };

  const lireOCR = async (files) => {
    try {
      setOcrEnCours(true);
      let texteFinal = "";

      // Tesseract.js (~2 Mo) n'est chargé qu'ici, à la demande, pour ne pas
      // alourdir le chargement initial du site pour les visiteurs qui ne
      // font pas de synchronisation par capture.
      const { default: Tesseract } = await import("tesseract.js");

      for (let i = 0; i < files.length; i++) {
        const imagePreparee = await preparerImageOCR(files[i]);

        const result = await Tesseract.recognize(imagePreparee, "fra", {
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
          logger: (message) => {
            if (message.status === "recognizing text") {
              const pourcentage = Math.round((message.progress || 0) * 100);
              console.log(`OCR ${i + 1}/${files.length} : ${pourcentage}%`);
            }
          },
        });

        texteFinal += `\n--- Capture ${i + 1} ---\n${result.data.text || ""}`;
        setTexte(texteFinal);
      }

      showToast(`OCR amélioré terminé : ${files.length} capture(s)`);
    } catch (e) {
      console.error(e);
      showToast("Erreur OCR");
    } finally {
      setOcrEnCours(false);
    }
  };

  const onFile = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setPreviews(files.map(f => URL.createObjectURL(f)));
    setPreview(URL.createObjectURL(files[0]));

    await lireOCR(files);
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "var(--gold)", fontSize: 12, fontWeight: 950, letterSpacing: 1.6, textTransform: "uppercase" }}>Synchronisation Dofus</div>
        <h1 style={{ margin: "6px 0", fontSize: 34 }}>Compteurs des filtres</h1>
        <div style={{ color: "var(--muted)", maxWidth: 900 }}>
          Fais une capture avec le filtre Femelle, une autre avec le filtre Mâle, puis les capacités utiles. Colle le texte OCR de chaque capture ici. Les compteurs servent à reconstruire le cheptel par couleur et par sexe.
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>1 — Ajouter un scan</h2>
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12, marginBottom: 12 }}>
          <select className="field" value={typeScan} onChange={(e) => setTypeScan(e.target.value)}>
            {TYPES_SCAN.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            Choisir la capture
            <input type="file" multiple accept="image/*" onChange={onFile} style={{ display: "none" }} />
          </label>
        </div>

        {ocrEnCours && <div style={{marginBottom:12}}>Lecture OCR en cours...</div>}
        {preview && <img src={preview} alt="Aperçu du scan" style={{ display: "block", maxWidth: 420, maxHeight: 300, objectFit: "contain", borderRadius: 12, border: "1px solid var(--line)", marginBottom: 12 }} />}

        <textarea
          className="field"
          rows={8}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={'Colle le texte OCR de la liste, par exemple :\nMuldo Doré 15\nMuldo Indigo 14\nMuldo Orchidée 17'}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10 }}>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            {lignes.length} couleur(s) · {lignes.reduce((n, l) => n + l.total, 0)} monture(s) reconnue(s)
          </span>
          <button className="btn btn-coral" onClick={enregistrerScan}>Enregistrer ce scan</button>
        </div>
        {lignes.some((l) => l.reconnu === false) && (
          <div style={{ color: "#e8896a", fontSize: 12, marginTop: 8 }}>
            ⚠ Couleur(s) non reconnue(s) : {lignes.filter((l) => l.reconnu === false).map((l) => `« ${l.couleur} »`).join(", ")} — corrige-les dans le texte ci-dessus (l'enregistrement est bloqué tant qu'il en reste).
          </div>
        )}
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>2 — Scans enregistrés</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {TYPES_SCAN.map((t) => {
            const scan = scans[t.key];
            const total = scan?.lignes?.reduce((n, l) => n + l.total, 0) || 0;
            return (
              <div key={t.key} className={`success-chip ${scan ? "success-ok" : "success-miss"}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b>{t.label}</b>
                  {scan && <button className="btn btn-ghost" style={{ padding: "4px 7px" }} onClick={() => supprimerScan(t.key)}>×</button>}
                </div>
                <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>{scan ? `${total} monture(s) · ${scan.lignes.length} couleur(s)` : "Pas encore scanné"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <div>
            <h2 style={{ margin: 0 }}>3 — Rapprochement avec l'appli <span style={{ color: "var(--green)", fontSize: 13 }}>(recommandé)</span></h2>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 5 }}>
              Compare le scan au cheptel existant et n'agit que sur les écarts. Les muldos à généalogie
              (nommés, parents ou enfants connus) ne sont jamais retirés automatiquement.
            </div>
          </div>
          <button
            className="btn btn-coral"
            disabled={!diffRapprochement.length}
            style={!diffRapprochement.length ? { opacity: 0.5 } : undefined}
            onClick={appliquerRapprochement}
          >
            Appliquer ({totalAjouts ? `+${totalAjouts}` : ""}{totalAjouts && totalRetraits ? " / " : ""}{totalRetraits ? `−${totalRetraits}` : ""}{!totalAjouts && !totalRetraits ? "aucun écart" : ""})
          </button>
        </div>

        {(!scans.femelles || !scans.males) && (
          <div style={{ color: "var(--muted)", fontSize: 13, padding: "10px 0" }}>
            Enregistre les scans Femelles et Mâles pour voir les écarts avec ton cheptel.
          </div>
        )}
        {scans.femelles && scans.males && !diffRapprochement.length && (
          <div style={{ color: "var(--green)", fontSize: 13, padding: "10px 0" }}>
            ✓ Aucun écart : l'appli est parfaitement alignée sur ton enclos.
          </div>
        )}
        {diffRapprochement.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr>
                  {["Couleur", "Sexe", "En jeu", "Dans l'appli", "Écart", "Action prévue"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--line)", color: "var(--gold2)", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diffRapprochement.map((d) => (
                  <tr key={d.cle}>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", fontWeight: 700 }}>
                      <MuldoBadge couleur={d.couleur} taille={16} /> {d.couleur}
                    </td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)" }}>{d.sexe === "F" ? "♀" : "♂"}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)" }}>{d.enJeu}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)" }}>{d.dansAppli}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", fontWeight: 800, color: d.ecart > 0 ? "var(--green)" : "var(--red)" }}>
                      {d.ecart > 0 ? `+${d.ecart}` : d.ecart}
                    </td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", fontSize: 12, color: "var(--muted)" }}>
                      {d.ecart > 0 && `créer ${d.ecart} fiche(s)`}
                      {d.ecart < 0 && d.aRetirer.length > 0 && (
                        <span>
                          retirer{" "}
                          {d.aRetirer.map((m, i) => (
                            <span key={m.id}>
                              {i > 0 && ", "}
                              <button
                                type="button"
                                onClick={() => onVoirMuldo && onVoirMuldo(m.id)}
                                title="Voir la fiche de ce muldo"
                                style={{ background: "none", border: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                              >
                                {m.nom || m.id.slice(0, 5)}
                              </button>
                            </span>
                          ))}
                        </span>
                      )}
                      {d.bloques > 0 && (
                        <div style={{ color: "var(--gold)", marginTop: d.aRetirer.length ? 6 : 0 }}>
                          ⚠ protégé(s) par leur généalogie :
                          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, marginLeft: 6 }}>
                            {d.protegesListe.map((m) => (
                              <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid rgba(214,166,74,.4)", borderRadius: 8, padding: "2px 6px" }}>
                                <button
                                  type="button"
                                  onClick={() => onVoirMuldo && onVoirMuldo(m.id)}
                                  title="Voir la fiche (généalogie, notes) avant de décider"
                                  style={{ background: "none", border: "none", padding: 0, color: "var(--gold2)", font: "inherit", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                                >
                                  {m.nom || m.couleur}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSupprimerMuldo && onSupprimerMuldo(m)}
                                  title="Supprimer manuellement ce muldo (confirmation demandée)"
                                  style={{ background: "none", border: "none", padding: 0, color: "var(--red)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalBloques > 0 && (
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 10 }}>
                Les muldos protégés ne sont jamais supprimés automatiquement : vérifie leur sort en jeu,
                puis retire-les depuis leur fiche si nécessaire.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>4 — Tableau du scan · reconstruction complète</h2>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 5 }}>{totalFemelles} femelles · {totalMales} mâles · {totalFemelles + totalMales} total</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {snapshotAvant && <button className="btn btn-ghost" onClick={restaurer}>Annuler la dernière application</button>}
            <button
              className="btn btn-ghost"
              style={{ borderColor: "rgba(216,91,79,.55)", color: "#e8896a" }}
              title="Efface tout le cheptel actuel — noms, généalogies et capacités compris — et le recrée depuis les compteurs du scan. À réserver à une remise à zéro volontaire."
              onClick={appliquerAuCheptel}
            >
              ⚠ Tout reconstruire (efface les généalogies)
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                {['Couleur', 'Femelles', 'Mâles', 'Total', ...Object.keys(capacites)].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 8px", borderBottom: "1px solid var(--line)", color: "var(--gold2)", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {couleurs.map((couleur) => (
                <tr key={couleur}>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid rgba(91,71,51,.45)", fontWeight: 850 }}>{couleur}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid rgba(91,71,51,.45)" }}>{femelles[couleur] || 0}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid rgba(91,71,51,.45)" }}>{males[couleur] || 0}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid rgba(91,71,51,.45)", fontWeight: 900 }}>{Number(femelles[couleur] || 0) + Number(males[couleur] || 0)}</td>
                  {Object.entries(capacites).map(([nom, map]) => (
                    <td key={nom} style={{ padding: "9px 8px", borderBottom: "1px solid rgba(91,71,51,.45)" }}>{map[couleur] || 0}</td>
                  ))}
                </tr>
              ))}
              {!couleurs.length && <tr><td colSpan={4 + Object.keys(capacites).length} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Enregistre les scans Femelles et Mâles pour remplir le tableau.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 12 }}>
          Les scans de capacités donnent des quantités par couleur. Ils ne permettent pas encore de savoir précisément quelle monture individuelle possède chaque capacité.
        </div>
      </div>
    </div>
  );
}
