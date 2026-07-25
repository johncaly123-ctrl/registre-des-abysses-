// ============================================================
// Registre des Abysses — élevage de MULDOS
// Extrait de App.jsx (refactor architectural) pour suivre le même schéma que
// Dragodinde.jsx/Volkorne.jsx : un hook useMuldoElevage() autonome (état +
// localStorage + handlers) et des pages exportées qui consomment ses props.
// Contrairement à Dragodinde/Volkorne, useMuldoElevage() reçoit showToast/
// setToast en paramètres : le toast lui-même reste dans App.jsx (partagé
// avec la Taverne, la Sauvegarde, et les pages Dragodinde/Volkorne).
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Heart, Zap, Sparkles, Droplets, AlertTriangle, X, Skull, Baby } from "lucide-react";
import { creerEcritureDebattue } from "./stockage.js";
import {
  BebesARenommerPanel, BoutonFiche,
  exporterFicheImage, copierPressePapiers, LabeledSelect, StatCard,
} from "./panneauxElevage.jsx";
import {
  COLORS, COULEURS_MULDO, CAPACITES_MULDO,
  capacitesMuldo, normaliserMuldo,
  GENERATIONS_MULDO, couleursGenerationJusqua, plierCouleur,
  canonicaliserCouleur,
  generationDeCouleur,
  CHEPTEL_INITIAL_AUTO, sexeMuldo, muldoReproductible,
  analyserGenerationCible,
  couleursNaissancePossibles, genererNomCourt, couleursAncetres,
  distancesEtParentsVersObjectif,
  optimiserSessionAccouplements, progressionParGeneration,
  choisirObjectifGpsAutomatique, collisionScore,
  collisionLabel, readinessScore, getNextAction, generationGoalScore,
  geneticPartners,
} from "./muldoGenetique.js";
import { analyserTexteCaptureMuldo } from "./muldoOCR.js";

const uid = () => Math.random().toString(36).slice(2, 10);
const STATUTS = ["Fertile", "Féconde", "Stérile", "Sénile"];
const JAUGES = [
  { key: "amour", label: "Amour", icon: Heart },
  { key: "endurance", label: "Endurance", icon: Zap },
  { key: "maturite", label: "Maturité", icon: Sparkles },
  { key: "serenite", label: "Sérénité", icon: Droplets },
];

export const STORAGE_KEY = "cheptel-muldos-v1";
export const STORAGE_HISTORY_KEY = "muldo-historique-couleurs-v1";
export const STORAGE_SYNC_KEY = "muldo-synchronisation-filtres-v1";
export const STORAGE_GPS_SESSION = "gps-session-v1";
export const STORAGE_NAISSANCES = "muldo-naissances-attente-v1";
export const STORAGE_JOURNAL = "muldo-journal-naissances-v1";
export const STORAGE_INSTANTANES = "muldo-instantanes-v1";
export const STORAGE_CORBEILLE = "muldo-corbeille-v1";
export const CORBEILLE_DUREE_JOURS = 30;

export function useMuldoElevage(showToast, setToast) {
  const [cheptel, setCheptel] = useState(CHEPTEL_INITIAL_AUTO);
  const [selectedId, setSelectedId] = useState(null);
  const [ficheRapideId, setFicheRapideId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [showNew, setShowNew] = useState(false);

  const [fusionA, setFusionA] = useState("");
  const [fusionB, setFusionB] = useState("");
  const [captureText, setCaptureText] = useState("");
  const [capturePreview, setCapturePreview] = useState("");
  const [objectifGeneration] = useState(6);
  const [objectifGps, setObjectifGps] = useState("Prune");
  const [modeGps, setModeGps] = useState("couleur");
  const [generationGps, setGenerationGps] = useState(7);
  const [generationCollectionMin, setGenerationCollectionMin] = useState(2);
  const [generationCollectionMax, setGenerationCollectionMax] = useState(10);
  const [modePurification, setModePurification] = useState(false);
  const [optimakina, setOptimakina] = useState(false);
  const [niveauMinimumSession, setNiveauMinimumSession] = useState(0);
  const [historiqueCouleurs, setHistoriqueCouleurs] = useState({});

  const [naissances, setNaissances] = useState([]);

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

    setToast({ type: "success", msg: `${nouveaux.length} muldo(s) importé(s) depuis la capture.` });
  };



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

  // Mémoïsé : sinon un nouvel objet est créé à chaque rendu dès que la
  // session suivie ne correspond pas aux réglages courants, ce qui casse la
  // mémoïsation en aval (cheptelGpsDisponible -> sessionGps) et relance
  // l'affectation hongroise O(n^3) sur tout le cheptel à chaque rendu.
  const gpsSuiviActif = useMemo(() => (
    gpsSuivi.mode === modeGps
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
        }
  ), [gpsSuivi, modeGps, objectifGpsActif, modePurification]);

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
    if (objectifGpsActif && couleur === objectifGpsActif) {
      showToast(`🎯 Objectif GPS atteint ! ${couleur} ${sexe === "F" ? "♀" : "♂"} obtenu(e) — renomme-le « ${nomCourt} » en jeu (déjà copié).`, { type: "objectif", duration: 5000 });
    } else {
      showToast(`${encoreUnBebe ? "Bébé 1/2 enregistré" : "Naissance enregistrée"} : ${couleur} ${sexe === "F" ? "♀" : "♂"} — renomme-le « ${nomCourt} » en jeu (déjà copié)${encoreUnBebe ? ". Confirme maintenant le 2e bébé." : ""}`);
    }
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
  const discoveredTotal = Object.values(historiqueCouleurs || {}).filter(Boolean).length;

  return {
    cheptel,
    setCheptel,
    selectedId,
    setSelectedId,
    ficheRapideId,
    setFicheRapideId,
    loading,
    setLoading,
    saving,
    setSaving,
    filter,
    setFilter,
    showNew,
    setShowNew,
    fusionA,
    setFusionA,
    fusionB,
    setFusionB,
    captureText,
    setCaptureText,
    capturePreview,
    setCapturePreview,
    objectifGeneration,
    objectifGps,
    setObjectifGps,
    modeGps,
    setModeGps,
    generationGps,
    setGenerationGps,
    generationCollectionMin,
    setGenerationCollectionMin,
    generationCollectionMax,
    setGenerationCollectionMax,
    modePurification,
    setModePurification,
    optimakina,
    setOptimakina,
    niveauMinimumSession,
    setNiveauMinimumSession,
    historiqueCouleurs,
    setHistoriqueCouleurs,
    naissances,
    setNaissances,
    instantanes,
    setInstantanes,
    journal,
    setJournal,
    corbeille,
    setCorbeille,
    gpsSuivi,
    setGpsSuivi,
    byId,
    fusionnerSteriles,
    selected,
    voirMuldo,
    ficheRapide,
    importCapture,
    importerCaptureDansCheptel,
    planGeneration,
    progressionGps,
    choixObjectifGps,
    objectifGpsActif,
    gpsSuiviActif,
    cheptelGpsDisponible,
    sessionGps,
    synchroniserContexteGps,
    realiserCouplesGps,
    annulerDernierCoupleGps,
    reinitialiserSessionGps,
    enregistrerHistoriqueCouleurs,
    basculerCouleurHistorique,
    validerGenerationHistorique,
    validerToutHistorique,
    reinitialiserHistoriqueManuel,
    updateCheptel,
    confirmerNaissance,
    supprimerNaissance,
    addMuldo,
    patchMuldo,
    deleteMuldo,
    restaurerMuldo,
    purgerCorbeilleEntree,
    viderCorbeille,
    demarrerNouvelleSessionAccouplement,
    nettoyerSterilesPuisDemarrerSession,
    registerBirth,
    suggestions,
    actionsDuJour,
    filtered,
    readyCount,
    fertileCount,
    discoveredTotal,
  };
}

export function ImportCapturePanel({ captureText, setCaptureText, capturePreview, setCapturePreview, importCapture, onImport }) {
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
            <div key={l.couleur} style={{ fontSize: 11, color: l.confiance === "corrigee" ? "#e0a94e" : COLORS.text, fontFamily: "Inter, sans-serif", marginBottom: 3 }} title={l.confiance === "corrigee" ? "Couleur corrigée automatiquement (lecture OCR incertaine) — vérifie qu'elle est correcte." : undefined}>
              {l.couleur}{l.confiance === "corrigee" && " ⚠️"} — ♂ {l.male} / ♀ {l.femelle} / ? {l.inconnu} / total {l.total}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



export function ActionCard({ muldo }) {
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

export function FicheRapideModal({ muldo, byId, onPatch, onDelete, onClose }) {
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

export function MuldoDetail({ muldo, byId, onPatch, onDelete }) {
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


export function NewMuldoModal({ cheptel, onClose, onCreate }) {
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


// Barre d'onglets affichée en entrant dans une section créature (Muldo,
// Dragodinde, Volkorne) — permet de passer de Cheptel à Synchro/GPS/Clonage
// sans repasser par le menu latéral.

export function DashboardDofusPanel({ cheptel, plan, historiqueCouleurs, actionsDuJour, suggestions, registerBirth, onVoirMuldo }) {
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


export function BigGpsCard({ plan }) {
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


export function teintesDeCouleur(couleur) {
  const parties = plierCouleur(couleur).split(" et ").map((p) => p.trim());
  return parties.map((p) => PALETTE_MULDO[p] || "#6b6156");
}


export function slugCouleur(couleur) {
  return plierCouleur(couleur).replace(/\s+/g, "-");
}


export function MuldoBadge({ couleur, taille = 22 }) {
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


export function suggererClonages(cheptel, objectif, generationFiltre) {
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


export function ClonagePage({ fusion, cheptel, objectif, journal, onVoirMuldo }) {
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

export function BarreEmpilee({ segments, hauteur = 14 }) {
  const total = segments.reduce((n, s) => n + s.valeur, 0) || 1;
  return (
    <div style={{ display: "flex", height: hauteur, borderRadius: 7, overflow: "hidden", background: "rgba(255,255,255,.05)" }}>
      {segments.map((s) => s.valeur > 0 && (
        <div key={s.label} title={`${s.label} : ${s.valeur}`} style={{ width: `${s.valeur / total * 100}%`, background: s.couleur }} />
      ))}
    </div>
  );
}


export function GraphiquesPanel({ cheptel, journal, instantanes }) {
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


export function MemoElevagePanel() {
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




export function SuccesDofusPage({
  historiqueCouleurs,
  cheptel,
  objectifGeneration,
  plan,
  onToggleCouleur,
  onValidateGeneration,
  onValidateAll,
  onResetHistory,
  journal,
}) {
  const present = new Set(cheptel.map((m) => m.couleur));
  const seen = (c) => Boolean(historiqueCouleurs?.[c]) || present.has(c);
  const allColors = Object.values(GENERATIONS_MULDO).flat();
  const totalSeen = allColors.filter(seen).length;
  const totalPct = allColors.length ? Math.round((totalSeen / allColors.length) * 100) : 0;
  const couleursRares = [...(GENERATIONS_MULDO[9] || []), ...(GENERATIONS_MULDO[10] || [])];
  const jalons = [
    { label: "Première naissance", atteint: (journal || []).some((j) => j.type !== "clonage") },
    { label: "Premier clonage", atteint: (journal || []).some((j) => j.type === "clonage") },
    { label: "Couleur rare (G9-G10)", atteint: couleursRares.some(seen) },
    { label: "25% du pokédex", atteint: totalPct >= 25 },
    { label: "50% du pokédex", atteint: totalPct >= 50 },
    { label: "75% du pokédex", atteint: totalPct >= 75 },
    { label: "Pokédex complet", atteint: totalPct >= 100 },
  ];

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
        <b>Jalons</b>
        <div className="success-grid" style={{ marginTop: 10 }}>
          {jalons.map((j) => (
            <div key={j.label} className={`success-chip ${j.atteint ? "success-ok" : "success-miss"}`}>
              {j.atteint ? "🏅" : "⬜"} {j.label}
            </div>
          ))}
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


export function LegendeCheptel() {
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


export function CheptelCards({ items, selectedId, onSelect }) {
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


export function MuldoMiniCard({ m, selected, onClick }) {
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


export function CheptelOverviewPage({ cheptel, selectedId, setSelectedId, filter, setFilter, actionsDuJour, importProps }) {
  const [filtreGeneration, setFiltreGeneration] = useState("");
  const [filtreSexe, setFiltreSexe] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreCouleur, setFiltreCouleur] = useState("");

  // Combine les 4 critères (ET logique) au-dessus de la recherche texte déjà
  // appliquée en amont (eleveMuldo.filtered) — vide = pas de restriction.
  const cheptelFiltre = useMemo(() => cheptel.filter((m) =>
    (!filtreGeneration || generationDeCouleur(m.couleur) === Number(filtreGeneration)) &&
    (!filtreSexe || sexeMuldo(m) === filtreSexe) &&
    (!filtreStatut || m.statut === filtreStatut) &&
    (!filtreCouleur || m.couleur === filtreCouleur)
  ), [cheptel, filtreGeneration, filtreSexe, filtreStatut, filtreCouleur]);

  const filtresActifs = filtreGeneration || filtreSexe || filtreStatut || filtreCouleur;
  const reinitialiserFiltres = () => {
    setFiltreGeneration(""); setFiltreSexe(""); setFiltreStatut(""); setFiltreCouleur("");
  };

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Filtres</h2>
          {filtresActifs && (
            <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={reinitialiserFiltres}>✕ Réinitialiser</button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <LabeledSelect
            label="Génération"
            value={filtreGeneration}
            onChange={setFiltreGeneration}
            options={[["", "Toutes"], ...Object.keys(GENERATIONS_MULDO).map((g) => [g, `Génération ${g}`])]}
          />
          <LabeledSelect
            label="Couleur"
            value={filtreCouleur}
            onChange={setFiltreCouleur}
            options={[["", "Toutes"], ...COULEURS_MULDO.map((c) => [c, c])]}
          />
          <LabeledSelect
            label="Sexe"
            value={filtreSexe}
            onChange={setFiltreSexe}
            options={[["", "Tous"], ["M", "Mâle"], ["F", "Femelle"]]}
          />
          <LabeledSelect
            label="Statut"
            value={filtreStatut}
            onChange={setFiltreStatut}
            options={[["", "Tous"], ...STATUTS.map((s) => [s, s])]}
          />
        </div>
        {filtresActifs && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>{cheptelFiltre.length} / {cheptel.length} muldo(s) affiché(s)</div>
        )}
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

      <CheptelCards items={cheptelFiltre} selectedId={selectedId} onSelect={setSelectedId} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <ImportCapturePanel {...importProps} />
      </div>
    </div>
  );
}



export function mapScanParCouleur(lignes) {
  return Object.fromEntries((lignes || []).map((ligne) => [ligne.couleur, Number(ligne.total || 0)]));
}


export function creerMuldoSynchronise(couleur, sexe, index) {
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


export function SynchronisationFiltresPage({ cheptel, updateCheptel, showToast, onVoirMuldo, onSupprimerMuldo }) {
  const TYPES_SCAN = [
    { key: "femelles", label: "Femelles", sexe: "F" },
    { key: "males", label: "Mâles", sexe: "M" },
    ...CAPACITES_MULDO.filter((c) => c !== "Aucune").map((c) => ({ key: `capacite:${c}`, label: c, capacite: c })),
  ];

  const [typeScan, setTypeScan] = useState("femelles");
  const [texte, setTexte] = useState("");
  const [preview, setPreview] = useState("");
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
        {lignes.some((l) => l.confiance === "corrigee") && (
          <div style={{ color: "#e0a94e", fontSize: 12, marginTop: 8 }}>
            ⚠️ Couleur(s) corrigée(s) automatiquement (lecture OCR incertaine, vérifie avant d'enregistrer) : {lignes.filter((l) => l.confiance === "corrigee").map((l) => `« ${l.couleur} »`).join(", ")}.
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

export function RechercheMuldoDeroulante({ muldos, valeurId, onChoisir, placeholder, exclureId }) {
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

