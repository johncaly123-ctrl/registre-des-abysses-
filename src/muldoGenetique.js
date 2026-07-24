// Moteur génétique muldo : couleurs, générations, recettes, canonicalisation
// OCR, pathfinding vers une couleur/génération cible, affectation optimale
// pour le GPS de session. Fonctions pures, aucune dépendance React/Supabase —
// extrait de App.jsx pour garder ce fichier lisible et testable isolément.
//
// distanceLevenshtein/affectationMaximale viennent de geneticsUtils.js, déjà
// partagé avec Dragodinde.jsx/Volkorne.jsx (pas de copie locale ici).
import { affectationMaximale, distanceLevenshtein, calculerGenerationCible, bonusProbabiliteGenerationCible, couleursAncetres } from "./geneticsUtils.js";
export { affectationMaximale, distanceLevenshtein, calculerGenerationCible, bonusProbabiliteGenerationCible, couleursAncetres };

// ---------- constantes de design ----------
export const COLORS = {
  bg: "#0A1B22",
  panel: "#102B34",
  panelAlt: "#0D242C",
  line: "#1E4650",
  coral: "#E8734A",
  coralDim: "#B85A38",
  glow: "#4FD1C5",
  glowDim: "#2E7A72",
  text: "#E7EDE9",
  muted: "#6C8A94",
  danger: "#D9534F",
  gold: "#D4A94C",
};

export const COULEURS_MULDO = [
  "Doré",
  "Indigo",
  "Ébène",
  "Pourpre",
  "Orchidée",
  "Doré et Pourpre",
  "Indigo et Pourpre",
  "Ébène et Pourpre",
  "Orchidée et Pourpre",
  "Doré et Orchidée",
  "Indigo et Orchidée",
  "Ébène et Orchidée",
  "Doré et Ébène",
  "Doré et Indigo",
  "Ébène et Indigo",
  "Roux",
  "Amande",
  "Doré et Amande",
  "Ébène et Amande",
  "Indigo et Amande",
  "Orchidée et Amande",
  "Pourpre et Amande",
  "Roux et Amande",
  "Roux et Doré",
  "Roux et Ébène",
  "Roux et Indigo",
  "Roux et Orchidée",
  "Roux et Pourpre",
  "Ivoire",
  "Turquoise",
  "Pourpre et Ivoire",
  "Orchidée et Ivoire",
  "Indigo et Ivoire",
  "Ébène et Ivoire",
  "Doré et Ivoire",
  "Roux et Ivoire",
  "Amande et Ivoire",
  "Turquoise et Ivoire",
  "Turquoise et Pourpre",
  "Turquoise et Orchidée",
  "Turquoise et Indigo",
  "Turquoise et Ébène",
  "Turquoise et Roux",
  "Turquoise et Amande",
  "Turquoise et Doré",
  "Prune",
  "Émeraude",
  "Prune et Pourpre",
  "Prune et Orchidée",
  "Prune et Indigo",
  "Prune et Ébène",
  "Prune et Doré",
  "Prune et Roux",
  "Prune et Amande",
  "Prune et Ivoire",
  "Prune et Turquoise",
  "Prune et Émeraude",
  "Pourpre et Émeraude",
  "Orchidée et Émeraude",
  "Indigo et Émeraude",
  "Ébène et Émeraude",
  "Doré et Émeraude",
  "Roux et Émeraude",
  "Amande et Émeraude",
  "Ivoire et Émeraude",
  "Turquoise et Émeraude",
  "Ambre",
  "Corail",
  "Azur",
  "Aigue-marine",
  "Ambre et Doré",
  "Ambre et Ébène",
  "Ambre et Indigo",
  "Ambre et Pourpre",
  "Ambre et Orchidée",
  "Ambre et Amande",
  "Ambre et Roux",
  "Ambre et Ivoire",
  "Ambre et Turquoise",
  "Ambre et Émeraude",
  "Ambre et Prune",
  "Ambre et Corail",
  "Ambre et Azur",
  "Ambre et Aigue-marine",
  "Corail et Doré",
  "Corail et Ébène",
  "Corail et Indigo",
  "Corail et Pourpre",
  "Corail et Orchidée",
  "Corail et Amande",
  "Corail et Roux",
  "Corail et Ivoire",
  "Corail et Turquoise",
  "Corail et Émeraude",
  "Corail et Prune",
  "Corail et Azur",
  "Corail et Aigue-marine",
  "Azur et Doré",
  "Azur et Ébène",
  "Azur et Indigo",
  "Azur et Pourpre",
  "Azur et Orchidée",
  "Azur et Amande",
  "Azur et Roux",
  "Azur et Ivoire",
  "Azur et Turquoise",
  "Azur et Émeraude",
  "Azur et Prune",
  "Azur et Aigue-marine",
  "Aigue-marine et Doré",
  "Aigue-marine et Ébène",
  "Aigue-marine et Indigo",
  "Aigue-marine et Pourpre",
  "Aigue-marine et Orchidée",
  "Aigue-marine et Amande",
  "Aigue-marine et Roux",
  "Aigue-marine et Ivoire",
  "Aigue-marine et Turquoise",
  "Aigue-marine et Émeraude",
  "Aigue-marine et Prune",
];

export const GENERATION_10_MULDO = [
  "Ambre et Doré",
  "Ambre et Ébène",
  "Ambre et Indigo",
  "Ambre et Pourpre",
  "Ambre et Orchidée",
  "Ambre et Amande",
  "Ambre et Roux",
  "Ambre et Ivoire",
  "Ambre et Turquoise",
  "Ambre et Émeraude",
  "Ambre et Prune",
  "Ambre et Corail",
  "Ambre et Azur",
  "Ambre et Aigue-marine",
  "Corail et Doré",
  "Corail et Ébène",
  "Corail et Indigo",
  "Corail et Pourpre",
  "Corail et Orchidée",
  "Corail et Amande",
  "Corail et Roux",
  "Corail et Ivoire",
  "Corail et Turquoise",
  "Corail et Émeraude",
  "Corail et Prune",
  "Corail et Azur",
  "Corail et Aigue-marine",
  "Azur et Doré",
  "Azur et Ébène",
  "Azur et Indigo",
  "Azur et Pourpre",
  "Azur et Orchidée",
  "Azur et Amande",
  "Azur et Roux",
  "Azur et Ivoire",
  "Azur et Turquoise",
  "Azur et Émeraude",
  "Azur et Prune",
  "Azur et Aigue-marine",
  "Aigue-marine et Doré",
  "Aigue-marine et Ébène",
  "Aigue-marine et Indigo",
  "Aigue-marine et Pourpre",
  "Aigue-marine et Orchidée",
  "Aigue-marine et Amande",
  "Aigue-marine et Roux",
  "Aigue-marine et Ivoire",
  "Aigue-marine et Turquoise",
  "Aigue-marine et Émeraude",
  "Aigue-marine et Prune",
];

export const OBJECTIFS_COULEURS = ["Prune", "Émeraude", "Ambre", "Corail", "Azur", "Aigue-marine"];
export const CAPACITES_MULDO = [
  "Aucune",
  "Reproductrice",
  "Caméléone",
  "Porteuse",
  "Sage",
  "Infatigable",
  "Précoce",
  "Amoureuse",
  "Endurante",
];

export function capacitesMuldo(m) {
  const valeurs = Array.isArray(m?.capacites)
    ? m.capacites
    : [m?.capacite1, m?.capacite2].filter(Boolean);
  return [...new Set(valeurs.filter((c) => c && c !== "Aucune"))].slice(0, 2);
}

export function normaliserMuldo(m) {
  const sterile = m?.sterile === true || m?.statut === "Stérile" || Number(m?.reproRestantes ?? m?.reproductionsRestantes ?? 1) <= 0;
  const senile = m?.senile === true || m?.statut === "Sénile";
  return {
    ...m,
    senile,
    couleur: canonicaliserCouleur(m?.couleur),
    sexe: sexeMuldo(m) || "",
    statut: sterile ? "Stérile" : (m?.statut || "Fertile"),
    sterile,
    reproDone: sterile ? 1 : 0,
    reproMax: 1,
    reproRestantes: sterile ? 0 : 1,
    reproductionsRestantes: sterile ? 0 : 1,
    capacites: capacitesMuldo(m),
    capacite1: capacitesMuldo(m)[0] || "Aucune",
    capacite2: capacitesMuldo(m)[1] || "Aucune",
    reproductrice: capacitesMuldo(m).includes("Reproductrice"),
    niveau: m?.niveau != null && m.niveau !== "" ? Number(m.niveau) : null,
  };
}
export const FATIGUE_OBSOLETE = true; // Nouvelle version : plus de jauge de fatigue.

export const STOCK_INITIAL_COULEURS = {
  "Amande": 6,
  "Doré": 19,
  "Doré et Amande": 2,
  "Doré et Indigo": 3,
  "Doré et Ivoire": 1,
  "Doré et Orchidée": 3,
  "Doré et Ébène": 3,
  "Indigo": 19,
  "Indigo et Orchidée": 2,
  "Indigo et Pourpre": 1,
  "Ivoire": 1,
  "Orchidée": 23,
  "Orchidée et Amande": 3,
  "Orchidée et Pourpre": 8,
  "Pourpre": 18,
  "Roux": 11,
  "Roux et Doré": 1,
  "Roux et Indigo": 1,
  "Roux et Orchidée": 1,
  "Roux et Pourpre": 3,
  "Roux et Ébène": 1,
  "Turquoise": 2,
  "Turquoise et Doré": 1,
  "Ébène": 24,
  "Ébène et Amande": 1,
  "Ébène et Indigo": 1,
  "Ébène et Orchidée": 2,
  "Ébène et Pourpre": 3,
  "Prune": 0,
  "Émeraude": 0,
  "Ambre": 0,
  "Corail": 0,
  "Azur": 0,
  "Aigue-marine": 0,
};

export const RECETTES_SPECIALES_MULDO = {
  "Roux": [
    ["Doré et Pourpre", "Doré et Indigo"],
    ["Doré et Pourpre", "Doré et Ébène"],
    ["Doré et Pourpre", "Doré et Orchidée"],
    ["Doré et Orchidée", "Doré et Indigo"],
    ["Doré et Orchidée", "Doré et Ébène"],
    ["Doré et Ébène", "Doré et Indigo"],
  ],
  "Amande": [
    ["Indigo et Pourpre", "Ébène et Orchidée"],
    ["Ébène et Pourpre", "Indigo et Orchidée"],
    ["Orchidée et Pourpre", "Ébène et Indigo"],
  ],
  "Ivoire": [
    ["Roux et Doré", "Ébène et Amande"],
    ["Roux et Doré", "Indigo et Amande"],
    ["Roux et Doré", "Orchidée et Amande"],
    ["Roux et Doré", "Pourpre et Amande"],
    ["Roux et Amande", "Ébène et Amande"],
    ["Roux et Amande", "Pourpre et Amande"],
    ["Roux et Amande", "Indigo et Amande"],
    ["Roux et Amande", "Orchidée et Amande"],
  ],
  "Turquoise": [
    ["Doré et Amande", "Roux et Ébène"],
    ["Doré et Amande", "Roux et Orchidée"],
    ["Doré et Amande", "Roux et Pourpre"],
    ["Doré et Amande", "Roux et Indigo"],
    ["Roux et Amande", "Roux et Ébène"],
    ["Roux et Amande", "Roux et Indigo"],
    ["Roux et Amande", "Roux et Orchidée"],
    ["Roux et Amande", "Roux et Pourpre"],
  ],
  "Prune": [
    ["Ébène et Ivoire", "Turquoise et Pourpre"],
    ["Indigo et Ivoire", "Turquoise et Orchidée"],
    ["Orchidée et Ivoire", "Turquoise et Indigo"],
    ["Pourpre et Ivoire", "Turquoise et Ébène"],
  ],
  "Émeraude": [
    ["Turquoise et Ivoire", "Turquoise et Doré"],
    ["Turquoise et Ivoire", "Turquoise et Roux"],
    ["Turquoise et Ivoire", "Amande et Ivoire"],
    ["Turquoise et Ivoire", "Doré et Ivoire"],
    ["Turquoise et Ivoire", "Turquoise et Amande"],
    ["Turquoise et Amande", "Roux et Ivoire"],
    ["Turquoise et Amande", "Doré et Ivoire"],
    ["Doré et Ivoire", "Turquoise et Roux"],
  ],
  "Ambre": [
    ["Pourpre et Émeraude", "Roux et Émeraude"],
    ["Orchidée et Émeraude", "Amande et Émeraude"],
    ["Indigo et Émeraude", "Ivoire et Émeraude"],
    ["Ébène et Émeraude", "Turquoise et Émeraude"],
    ["Doré et Émeraude", "Prune et Émeraude"],
  ],
  "Corail": [
    ["Prune et Pourpre", "Prune et Roux"],
    ["Prune et Orchidée", "Prune et Amande"],
    ["Prune et Indigo", "Prune et Ivoire"],
    ["Prune et Ébène", "Prune et Turquoise"],
    ["Prune et Doré", "Prune et Émeraude"],
  ],
  "Azur": [
    ["Pourpre et Émeraude", "Prune et Roux"],
    ["Orchidée et Émeraude", "Prune et Amande"],
    ["Indigo et Émeraude", "Prune et Ivoire"],
    ["Ébène et Émeraude", "Prune et Turquoise"],
    ["Doré et Émeraude", "Prune et Ivoire"],
  ],
  "Aigue-marine": [
    ["Prune et Pourpre", "Roux et Émeraude"],
    ["Prune et Orchidée", "Amande et Émeraude"],
    ["Prune et Indigo", "Ivoire et Émeraude"],
    ["Prune et Ébène", "Turquoise et Émeraude"],
    ["Prune et Doré", "Turquoise et Émeraude"],
  ],
};

// Les pages existantes qui affichent les objectifs spéciaux utilisent encore ce nom.
export const RECETTES_COULEURS = RECETTES_SPECIALES_MULDO;

export function recettesPourCouleur(couleur) {
  const speciales = RECETTES_SPECIALES_MULDO[couleur];
  if (speciales) return speciales;
  if (!couleur.includes(" et ")) return [];
  const [a, b] = couleur.split(" et ").map((partie) => partie.trim());
  return a && b ? [[a, b]] : [];
}

// Alias conservé pour éviter de casser d'anciens appels éventuels.
export function recettesBicoloreAuto(couleur) {
  return recettesPourCouleur(couleur);
}

// ---------- GPS de progression par génération ----------
export const GENERATIONS_MULDO = {
  1: ["Doré", "Indigo", "Ébène", "Pourpre", "Orchidée"],
  2: ["Doré et Pourpre", "Indigo et Pourpre", "Ébène et Pourpre", "Orchidée et Pourpre", "Doré et Orchidée", "Indigo et Orchidée", "Ébène et Orchidée", "Doré et Ébène", "Doré et Indigo", "Ébène et Indigo"],
  3: ["Roux", "Amande"],
  4: ["Doré et Amande", "Ébène et Amande", "Indigo et Amande", "Orchidée et Amande", "Pourpre et Amande", "Roux et Amande", "Roux et Doré", "Roux et Ébène", "Roux et Indigo", "Roux et Orchidée", "Roux et Pourpre"],
  5: ["Ivoire", "Turquoise"],
  6: ["Pourpre et Ivoire", "Orchidée et Ivoire", "Indigo et Ivoire", "Ébène et Ivoire", "Doré et Ivoire", "Roux et Ivoire", "Amande et Ivoire", "Turquoise et Ivoire", "Turquoise et Pourpre", "Turquoise et Orchidée", "Turquoise et Indigo", "Turquoise et Ébène", "Turquoise et Roux", "Turquoise et Amande", "Turquoise et Doré"],
  7: ["Prune", "Émeraude"],
  8: ["Prune et Pourpre", "Prune et Orchidée", "Prune et Indigo", "Prune et Ébène", "Prune et Doré", "Prune et Roux", "Prune et Amande", "Prune et Ivoire", "Prune et Turquoise", "Prune et Émeraude", "Pourpre et Émeraude", "Orchidée et Émeraude", "Indigo et Émeraude", "Ébène et Émeraude", "Doré et Émeraude", "Roux et Émeraude", "Amande et Émeraude", "Ivoire et Émeraude", "Turquoise et Émeraude"],
  9: ["Ambre", "Corail", "Azur", "Aigue-marine"],
  10: GENERATION_10_MULDO,
};


export function couleursGenerationJusqua(generation) {
  const out = [];
  for (let g = 1; g <= Number(generation); g += 1) {
    out.push(...(GENERATIONS_MULDO[g] || []));
  }
  return out;
}

// ---------- Canonicalisation des couleurs (répare l'OCR) ----------
// L'OCR produit des variantes ("Dore et Amande", "Ebène", "0rchidée"…) qui ne
// matchent ensuite aucune recette : le muldo devient inutilisable et la couleur
// compte en double dans l'historique. On replie donc toute chaîne sur le nom
// officiel, sans tenir compte des accents, de la casse ni de l'ordre des
// parties d'un nom bicolore.
export function plierCouleur(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

let INDEX_COULEURS_CANONIQUES = null;
export function indexCouleursCanoniques() {
  if (!INDEX_COULEURS_CANONIQUES) {
    INDEX_COULEURS_CANONIQUES = new Map();
    couleursGenerationJusqua(10).forEach((c) => {
      INDEX_COULEURS_CANONIQUES.set(plierCouleur(c), c);
    });
  }
  return INDEX_COULEURS_CANONIQUES;
}

export function canonicaliserCouleur(brut) {
  const texte = String(brut || "").trim();
  if (!texte) return texte;
  const index = indexCouleursCanoniques();
  const plie = plierCouleur(texte);
  const direct = index.get(plie);
  if (direct) return direct;

  // Nom bicolore dans le mauvais ordre.
  const parties = plie.split(" et ").map((p) => p.trim()).filter(Boolean);
  if (parties.length === 2) {
    const [a, b] = parties;
    const endroit = index.get(`${a} et ${b}`) || index.get(`${b} et ${a}`);
    if (endroit) return endroit;
  }

  // Correction floue : le vocabulaire des couleurs est minuscule, donc une
  // distance d'édition ≤ 2 identifie sans ambiguïté le nom visé malgré les
  // erreurs de lecture OCR ("Orchidce", "lndigo", "Ëbéne"…).
  const flouEntier = correspondanceFloue(plie, [...index.keys()]);
  if (flouEntier) return index.get(flouEntier);

  // …et partie par partie pour les bicolores très abîmés.
  if (parties.length === 2) {
    const monos = clesMonocoloresPliees();
    const pa = correspondanceFloue(parties[0], monos);
    const pb = correspondanceFloue(parties[1], monos);
    if (pa && pb) {
      const combine = index.get(`${pa} et ${pb}`) || index.get(`${pb} et ${pa}`);
      if (combine) return combine;
    }
  }

  return texte; // couleur vraiment inconnue : conservée telle quelle, signalée par le diagnostic
}

export function toleranceOCR(mot) {
  if (mot.length >= 5) return 2;
  if (mot.length >= 3) return 1;
  return 0;
}

// Renvoie la clé candidate la plus proche si (et seulement si) elle est dans
// la tolérance ET sans ex æquo — en cas de doute, on ne corrige pas.
export function correspondanceFloue(plie, candidats) {
  let meilleur = null;
  let meilleureDistance = Infinity;
  let exAequo = false;
  candidats.forEach((candidat) => {
    const d = distanceLevenshtein(plie, candidat);
    if (d < meilleureDistance) {
      meilleureDistance = d;
      meilleur = candidat;
      exAequo = false;
    } else if (d === meilleureDistance) {
      exAequo = true;
    }
  });
  return meilleur !== null && !exAequo && meilleureDistance <= toleranceOCR(plie) ? meilleur : null;
}

let CLES_MONOCOLORES_PLIEES = null;
export function clesMonocoloresPliees() {
  if (!CLES_MONOCOLORES_PLIEES) {
    CLES_MONOCOLORES_PLIEES = [...indexCouleursCanoniques().keys()].filter((k) => !k.includes(" et "));
  }
  return CLES_MONOCOLORES_PLIEES;
}

export function couleurEstCanonique(couleur) {
  return indexCouleursCanoniques().has(plierCouleur(couleur));
}

export function stockCouleurDisponible(stock, couleur) {
  return Number(stock[couleur] || 0) > 0;
}

export function meilleureRecettePourCouleur(couleur, stock, visiting = new Set()) {
  if (stockCouleurDisponible(stock, couleur)) return { cout: 0, recette: null };
  if (visiting.has(couleur)) return { cout: 999, recette: null };
  const recettes = recettesPourCouleur(couleur);
  if (!recettes.length) return { cout: 50, recette: null };
  visiting.add(couleur);
  const options = recettes.map((recette) => {
    const cout = recette.reduce((sum, parent) => sum + meilleureRecettePourCouleur(parent, stock, visiting).cout, 1);
    return { cout, recette };
  }).sort((a, b) => a.cout - b.cout);
  visiting.delete(couleur);
  return options[0];
}


export function construireEtapesPourCouleur(couleur, stock, etapes = [], seen = new Set()) {
  if (stockCouleurDisponible(stock, couleur) || seen.has(couleur)) return etapes;
  const best = meilleureRecettePourCouleur(couleur, stock);
  if (!best.recette) {
    etapes.push({ couleur, recette: [], bloquee: true });
    seen.add(couleur);
    return etapes;
  }
  best.recette.forEach((parent) => construireEtapesPourCouleur(parent, stock, etapes, seen));
  etapes.push({ couleur, recette: best.recette, bloquee: false });
  seen.add(couleur);
  return etapes;
}


export function generationDeCouleur(couleur) {
  for (const [generation, couleurs] of Object.entries(GENERATIONS_MULDO)) {
    if (couleurs.includes(couleur)) return Number(generation);
  }
  return couleur.includes(" et ") ? 4 : 1;
}

// Doit rester après generationDeCouleur/GENERATIONS_MULDO : le calcul de la
// génération a besoin des deux au moment de l'évaluation de ce module.
export const CHEPTEL_INITIAL_AUTO = (() => {
  const counts = STOCK_INITIAL_COULEURS;
  let index = 1;
  const items = [];

  Object.entries(counts).forEach(([couleur, count]) => {
    for (let i = 1; i <= count; i += 1) {
      items.push({
        id: `auto-${index}`,
        nom: `${couleur} #${i}`,
        sexe: i % 2 === 0 ? "Mâle" : "Femelle",
        couleur,
        generation: generationDeCouleur(couleur),
        statut: "Fertile",
        sterile: false,
        capacites: [],
        capacite1: "Aucune",
        capacite2: "Aucune",
        reproductrice: false,
        reproRestantes: 1,
        reproductionsRestantes: 1,
        amour: 100,
        endurance: 100,
        maturite: 100,
        serenite: 50,
        note: "Créé automatiquement depuis le screen du cheptel. Sexe à corriger si besoin.",
      });
      index += 1;
    }
  });

  return items;
})();

export function sexeMuldo(m) {
  const sexe = String(m?.sexe || "").toLowerCase();
  if (sexe.includes("mâle") || sexe.includes("male") || sexe === "m") return "M";
  if (sexe.includes("femelle") || sexe === "f") return "F";
  return "";
}

export function reproRestantesMuldo(m) {
  const rest = m?.reproRestantes ?? m?.reproductionsRestantes;
  if (rest !== undefined && rest !== null) return Number(rest) || 0;
  return Math.max(0, Number(m?.reproMax ?? 4) - Number(m?.reproDone ?? 0));
}

export function muldoReproductible(m) {
  if (!m) return false;
  // Tolérant à la casse et aux variantes : un muldo affiché "stérile" ne doit
  // JAMAIS passer dans le plan du GPS, quelle que soit la forme de la donnée.
  const sterileBrut = String(m.sterile ?? "").toLowerCase();
  if (m.sterile === true || sterileBrut === "oui" || sterileBrut === "true" || sterileBrut.includes("st")) return false;
  const statut = String(m.statut ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (statut.startsWith("steril") || statut.startsWith("senile")) return false;
  return reproRestantesMuldo(m) > 0;
}

export function couleurPresenteCheptel(cheptel, couleur) {
  return cheptel.some((m) => m.couleur === couleur);
}


export function chercherCouplePourRecette(recette, cheptel, byId) {
  const [a, b] = recette;
  const candidatsA = cheptel.filter((m) => m.couleur === a && muldoReproductible(m));
  const candidatsB = cheptel.filter((m) => m.couleur === b && muldoReproductible(m));
  const couples = [];

  candidatsA.forEach((ma) => {
    candidatsB.forEach((mb) => {
      if (ma.id === mb.id) return;
      if (sexeMuldo(ma) === sexeMuldo(mb)) return;
      const coll = collisionScore(ma, mb, byId);
      if (coll >= 99) return;

      const male = sexeMuldo(ma) === "M" ? ma : mb;
      const femelle = sexeMuldo(ma) === "F" ? ma : mb;
      const pretBonus = (isBreedReady(ma) ? 20 : 0) + (isBreedReady(mb) ? 20 : 0);
      const reproBonus = reproRestantesMuldo(ma) + reproRestantesMuldo(mb);
      couples.push({
        male,
        femelle,
        parents: [ma, mb],
        collision: coll,
        score: pretBonus + reproBonus * 5 - coll * 30,
      });
    });
  });

  return couples.sort((x, y) => y.score - x.score)[0] || null;
}

export function construirePlanPourCouleur(couleur, cheptel, byId, historiqueCouleurs = {}, depth = 0, seen = new Set()) {
  const dejaPresente = couleurPresenteCheptel(cheptel, couleur);
  const dejaDecouverte = Boolean(historiqueCouleurs[couleur]) || dejaPresente;

  if (depth > 8 || seen.has(couleur)) {
    return { couleur, dejaPresente, dejaDecouverte, bloquee: true, etapes: [] };
  }

  const recettes = recettesPourCouleur(couleur);
  const options = recettes.map((recette) => {
    const couple = chercherCouplePourRecette(recette, cheptel, byId);
    const nouvelleCouleur = !dejaDecouverte;

    if (couple) {
      return {
        couleur,
        recette,
        couple,
        type: dejaPresente ? "renfort" : "creation",
        nouvelleCouleur,
        score: 10000 + (nouvelleCouleur ? 3000 : 0) + generationDeCouleur(couleur) * 100 + couple.score,
        etapes: [{ couleur, recette, couple, nouvelleCouleur, faisableMaintenant: true }],
        bloquee: false,
      };
    }

    const nextSeen = new Set(seen);
    nextSeen.add(couleur);

    const sousPlans = recette.map((parent) =>
      construirePlanPourCouleur(parent, cheptel, byId, historiqueCouleurs, depth + 1, nextSeen)
    );

    const etapes = sousPlans.flatMap((p) => p.etapes || []);
    const bloquee = etapes.length === 0;
    const nouvelles = etapes.filter((e) => e.nouvelleCouleur).length;

    return {
      couleur,
      recette,
      couple: null,
      type: "preparation",
      nouvelleCouleur,
      sousPlans,
      etapes,
      bloquee,
      score: (bloquee ? -10000 : 5000) + nouvelles * 2000 - etapes.length * 100 + generationDeCouleur(couleur) * 50,
    };
  });

  return options.sort((a, b) => b.score - a.score)[0] || {
    couleur,
    recette: [],
    couple: null,
    type: "bloque",
    nouvelleCouleur: !dejaDecouverte,
    etapes: [],
    bloquee: true,
    score: -9999,
  };
}

export function analyserGenerationCible(generation, cheptel, byId, historiqueCouleurs = {}) {
  const objectif = couleursGenerationJusqua(generation);
  const possedees = objectif.filter((c) => couleurPresenteCheptel(cheptel, c));
  const decouvertes = objectif.filter((c) => historiqueCouleurs[c] || couleurPresenteCheptel(cheptel, c));
  const manquantes = objectif.filter((c) => !couleurPresenteCheptel(cheptel, c));
  const jamaisDecouvertes = objectif.filter((c) => !(historiqueCouleurs[c] || couleurPresenteCheptel(cheptel, c)));

  const plans = [];

  for (let g = Number(generation); g >= 2; g -= 1) {
    const couleurs = (GENERATIONS_MULDO[g] || []).filter((couleur) => {
      const pasDecouverte = !(historiqueCouleurs[couleur] || couleurPresenteCheptel(cheptel, couleur));
      const pasPresente = !couleurPresenteCheptel(cheptel, couleur);
      return pasDecouverte || pasPresente;
    });

    couleurs.forEach((couleur) => {
      const plan = construirePlanPourCouleur(couleur, cheptel, byId, historiqueCouleurs);
      if (!plan.bloquee && plan.etapes.length > 0) {
        const action = plan.etapes[0];
        plans.push({
          ...plan,
          generationVisee: g,
          actionImmediate: {
            ...action,
            generation: generationDeCouleur(action.couleur),
            bloquee: false,
          },
        });
      }
    });

    if (plans.length > 0) break;
  }

  const planChoisi = plans.sort((a, b) => b.score - a.score)[0] || null;
  const actionImmediate = planChoisi?.actionImmediate || null;
  const etapes = planChoisi?.etapes || [];

  return {
    generation,
    objectif,
    possedees,
    decouvertes,
    manquantes,
    jamaisDecouvertes,
    plans,
    planChoisi,
    actionImmediate,
    etapes,
  };
}



// ---------- GPS global de session ----------
export function cleCoupleCouleurs(a, b) {
  return [a, b].sort((x, y) => x.localeCompare(y, "fr")).join("||| ");
}

export function toutesLesRecettesProgression() {
  const map = {};
  COULEURS_MULDO.forEach((enfant) => {
    recettesPourCouleur(enfant).forEach(([a, b]) => {
      const key = cleCoupleCouleurs(a, b);
      if (!map[key]) map[key] = [];
      if (!map[key].includes(enfant)) map[key].push(enfant);
    });
  });
  return map;
}

export const RESULTATS_PAR_COUPLE = toutesLesRecettesProgression();

// Couleurs qu'une naissance peut réellement donner : les résultats de recette
// du couple, plus les couleurs des deux parents (le croisement peut "retomber"
// sur l'une d'elles au lieu du résultat espéré).
export function couleursNaissancePossibles(couleurMale, couleurFemelle) {
  const key = cleCoupleCouleurs(couleurMale, couleurFemelle);
  const possibles = new Set(RESULTATS_PAR_COUPLE[key] || []);
  possibles.add(couleurMale);
  possibles.add(couleurFemelle);
  return [...possibles];
}

// La généalogie compte : la 3.5 peut faire naître une couleur portée par un
// ANCÊTRE des parents (ex. un bébé "Doré et Indigo" d'un couple Doré et
// Orchidée × Doré et Ébène dont un grand-parent était Doré et Indigo). On ne
// connaît la généalogie que des muldos nés dans l'appli (parentIds) — pour les
// autres, le sélecteur "Autre couleur…" du panneau couvre tous les cas.
// Nom court unique pour identifier un bébé en jeu ("DE-4F7" pour un bébé de
// parents Doré et Ébène) : initiales de la couleur du bébé + code aléatoire.
// Copié automatiquement à la naissance → un simple Ctrl+V dans le renommage
// en jeu suffit à relier le muldo physique à sa fiche (et sa généalogie).
export function genererNomCourt(couleur) {
  // Charte des noms de monture en jeu : lettres latines NON accentuées
  // (chiffres, espaces et tiret autorisés). On désaccentue donc les
  // initiales (É→E). Le code mélange lettres et chiffres en excluant les
  // confusables (I/L/O vs 1/0).
  const initiales = String(couleur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s-]+/)
    .filter((mot) => mot && !/^et$/i.test(mot))
    .map((mot) => mot[0].toUpperCase())
    .join("");
  const lettres = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 3; i += 1) {
    code += lettres[Math.floor(Math.random() * lettres.length)];
  }
  return `${initiales}-${code}`;
}

export function distancesVersObjectif(objectif) {
  const distances = { [objectif]: 0 };
  const queue = [objectif];

  while (queue.length) {
    const enfant = queue.shift();
    const d = distances[enfant];
    const recettes = recettesPourCouleur(enfant);
    (recettes || []).forEach(([a, b]) => {
      [a, b].forEach((parent) => {
        if (distances[parent] === undefined || distances[parent] > d + 1) {
          distances[parent] = d + 1;
          queue.push(parent);
        }
      });
    });
  }
  return distances;
}


export function construireCheminVersObjectif(couleurDepart, objectif, distances) {
  if (!couleurDepart || !objectif) return [];

  const chemin = [couleurDepart];
  let courant = couleurDepart;

  const gardeFou = new Set();
  gardeFou.add(courant);

  while (courant !== objectif) {
    let meilleurParent = null;
    let meilleureDistance = Infinity;

    const recettes = recettesPourCouleur(courant);

    recettes.forEach(([a, b]) => {
      [a, b].forEach((parent) => {
        const d = distances[parent];

        if (
          d !== undefined &&
          d < meilleureDistance &&
          !gardeFou.has(parent)
        ) {
          meilleureDistance = d;
          meilleurParent = parent;
        }
      });
    });

    if (!meilleurParent) break;

    chemin.push(meilleurParent);
    gardeFou.add(meilleurParent);
    courant = meilleurParent;
  }

  return chemin;
}

// Version enrichie : conserve, pour chaque couleur découverte pendant le parcours
// depuis l'objectif, le couple exact (les deux parents) qui la produit. Ça permet
// de reconstruire un vrai arbre généalogique (couples + naissances), pas juste
// une chaîne d'une seule couleur par étape.
export function distancesEtParentsVersObjectif(objectif) {
  const distances = { [objectif]: 0 };
  const parentDe = {};
  const queue = [objectif];

  while (queue.length) {
    const enfant = queue.shift();
    const d = distances[enfant];
    const recettes = recettesPourCouleur(enfant);
    (recettes || []).forEach(([a, b]) => {
      [a, b].forEach((parent) => {
        if (distances[parent] === undefined) {
          distances[parent] = d + 1;
          parentDe[parent] = { via: enfant, pair: [a, b] };
          queue.push(parent);
        }
      });
    });
  }

  return { distances, parentDe };
}

// Reconstruit, en partant du résultat déjà obtenu, la suite d'accouplements
// (couple complet -> naissance) jusqu'à l'objectif. Chaque étape contient les
// deux parents et la couleur produite.
export function construireArbreCouples(resultat, objectif, parentDe) {
  if (!resultat || !objectif || resultat === objectif) return [];
  const etapes = [];
  let courant = resultat;
  const vus = new Set([courant]);

  while (courant !== objectif) {
    const info = parentDe[courant];
    if (!info) break;
    etapes.push({ parents: info.pair, produit: info.via });
    courant = info.via;
    if (vus.has(courant)) break;
    vus.add(courant);
  }

  return etapes;
}

export function scoreCoupleObjectif(male, femelle, objectif, distances, purification = false, byId = {}, optimakina = false, niveauMinimum = 0) {
  if (!male || !femelle) return { score: -1000000, raison: "Couple invalide", resultat: null, distance: Infinity };
  if (male.couleur === femelle.couleur && !purification) return { score: -1000000, raison: "Même couleur interdite", resultat: null, distance: Infinity };

  const key = cleCoupleCouleurs(male.couleur, femelle.couleur);
  // Mode purification : un couple de même couleur reproduit sa propre couleur.
  // Sans ce cas particulier, RESULTATS_PAR_COUPLE n'a aucune entrée (X, X) et
  // le couple était rejeté comme "sans recette" même avec purification cochée.
  const resultats = male.couleur === femelle.couleur && purification
    ? [male.couleur]
    : (RESULTATS_PAR_COUPLE[key] || []);
  let score = 25; // score positif : on utilise le cheptel tant qu'un couple différent est possible
  let raison = "Accouplement de soutien";
  let meilleurResultat = null;
  let meilleureDistance = Infinity;

  resultats.forEach((resultat) => {
    const d = distances[resultat];
    if (d === undefined) return;
    const valeur = d === 0 ? 100000 : Math.max(1000, 25000 - d * 4000);
    if (valeur > score) {
      score = valeur;
      meilleurResultat = resultat;
      meilleureDistance = d;
      raison = d === 0
        ? `Peut produire directement ${objectif}`
        : `Produit ${resultat}, à ${d} étape(s) de ${objectif}`;
    }
  });

  const dMale = distances[male.couleur];
  const dFemelle = distances[femelle.couleur];

  // Rejet uniquement si ce couple n'a strictement aucune recette connue
  // (impossible à reproduire dans le jeu, quel que soit l'objectif).
  if (!resultats.length) {
    return {
      score: -1000000,
      raison: "Couple sans recette officielle",
      resultat: null,
      distance: Infinity,
    };
  }

  // Le couple est valide mais aucun de ses résultats possibles n'est sur le
  // chemin connu vers l'objectif : on le garde quand même comme accouplement
  // de soutien plutôt que de laisser les muldos sans partenaire. Il pourra
  // redevenir utile plus tard, une fois l'objectif changé ou approfondi.
  if (meilleurResultat === null) {
    meilleurResultat = resultats[0];
    raison = resultats.length > 1
      ? `Accouplement de soutien · produit ${resultats.join(" ou ")}`
      : `Accouplement de soutien · produit ${resultats[0]}`;
  }

  // Favorise légèrement les croisements qui combinent deux branches utiles distinctes.
  if (dMale !== undefined && dFemelle !== undefined) score += 300;
  score += Math.max(0, 20 - collisionScore(male, femelle, byId));

  const chemin = construireCheminVersObjectif(
    meilleurResultat,
    objectif,
    distances
  );

  // Génération cible (mécanique du jeu) : petit bonus de tri pour préférer
  // les couples visant une génération plus haute, sans écraser le scoring
  // recette ci-dessus.
  const { generationCible, viaAncetre } = calculerGenerationCible(male, femelle, byId, generationDeCouleur);
  const generationBase = Math.max(generationDeCouleur(male.couleur), generationDeCouleur(femelle.couleur));
  score += (generationCible - generationBase) * 15;
  const chanceGenerationCible = bonusProbabiliteGenerationCible({
    niveauA: Math.max(male.niveau || 0, niveauMinimum),
    niveauB: Math.max(femelle.niveau || 0, niveauMinimum),
    optimakina,
  });

  return {
    score,
    raison,
    resultat: meilleurResultat,
    distance: meilleureDistance,
    chemin,
    generationCible,
    viaAncetre,
    chanceGenerationCible,
    couleursGenerationCible: GENERATIONS_MULDO[generationCible] || [],
  };
}

export function optimiserSessionAccouplements(cheptel, objectif, purification = false, optimakina = false, niveauMinimum = 0) {
  const fertiles = cheptel.filter(muldoReproductible);
  const byId = Object.fromEntries(cheptel.map((m) => [m.id, m]));
  const { distances, parentDe } = distancesEtParentsVersObjectif(objectif);

  // Passes successives : l'affectation hongroise travaille sur une matrice
  // carrée, elle peut donc être FORCÉE de marier des couples invalides
  // (même couleur, sans recette) qui étaient ensuite filtrés, laissant leurs
  // deux membres sans partenaire alors qu'un autre appariement valide existait.
  // On réaffecte donc les muldos libérés tant que de nouveaux couples valides
  // apparaissent.
  let malesRestants = fertiles.filter((m) => sexeMuldo(m) === "M");
  let femellesRestantes = fertiles.filter((m) => sexeMuldo(m) === "F");
  const couples = [];

  while (malesRestants.length && femellesRestantes.length) {
    const details = malesRestants.map((male) => femellesRestantes.map((femelle) =>
      scoreCoupleObjectif(male, femelle, objectif, distances, purification, byId, optimakina, niveauMinimum)
    ));
    const matrice = details.map((row) => row.map((x) => x.score));
    const affectations = affectationMaximale(matrice);

    const valides = affectations
      .map(([i, j]) => ({ male: malesRestants[i], femelle: femellesRestantes[j], ...details[i][j] }))
      .filter((c) => c.score > 0);

    if (!valides.length) break; // plus aucun couple valide possible

    couples.push(...valides);
    const pris = new Set(valides.flatMap((c) => [c.male.id, c.femelle.id]));
    malesRestants = malesRestants.filter((m) => !pris.has(m.id));
    femellesRestantes = femellesRestantes.filter((f) => !pris.has(f.id));
  }

  couples.sort((a, b) => b.score - a.score);

  const utilises = new Set(couples.flatMap((c) => [c.male.id, c.femelle.id]));
  const restants = fertiles.filter((m) => !utilises.has(m.id));

  // Diagnostic : pourquoi reste-t-il des muldos sans partenaire ?
  let raisonRestants = "";
  if (restants.length) {
    const sansSexe = restants.filter((m) => !sexeMuldo(m)).length;
    const couleursInconnues = restants.filter((m) => !couleurEstCanonique(m.couleur)).length;
    const morceaux = [];
    if (couleursInconnues) {
      morceaux.push(`${couleursInconnues} avec une couleur non reconnue (erreur OCR probable) — corrige-la sur leur fiche`);
    }
    if (sansSexe) {
      morceaux.push(`${sansSexe} au sexe inconnu — renseigne ♂/♀ sur leur fiche pour les rendre appariables`);
    }
    if (malesRestants.length && femellesRestantes.length) {
      morceaux.push(`${malesRestants.length} ♂ et ${femellesRestantes.length} ♀ sans croisement valide entre eux (couleurs identiques ou sans recette officielle)`);
      if (!purification) {
        const couleursPurifiables = new Set(
          malesRestants
            .map((m) => m.couleur)
            .filter((c) => femellesRestantes.some((f) => f.couleur === c))
        );
        if (couleursPurifiables.size) {
          morceaux.push(`astuce : coche « Mode purification » pour apparier les couples de même couleur (${couleursPurifiables.size} couleur(s) concernée(s))`);
        }
      }
    } else if (malesRestants.length) {
      morceaux.push(`surplus de ${malesRestants.length} ♂ (plus de ♀ fertiles disponibles)`);
    } else if (femellesRestantes.length) {
      morceaux.push(`surplus de ${femellesRestantes.length} ♀ (plus de ♂ fertiles disponibles)`);
    }
    // Astuce : les générations 1 esseulées peuvent trouver un partenaire par
    // capture directe (les 5 bases sont sauvages au Bassin des Muldos).
    if (restants.some((m) => generationDeCouleur(m.couleur) === 1)) {
      morceaux.push("astuce : les partenaires de génération 1 se capturent au Bassin des Muldos (Baie de Sufokia)");
    }
    raisonRestants = morceaux.join(" · ");
  }
  const groupes = [];
  couples.forEach((c) => {
    const key = `${c.male.couleur}|||${c.femelle.couleur}|||${c.resultat || ""}|||${c.raison}`;
    const existant = groupes.find((g) => g.key === key);
    if (existant) {
      existant.quantite += 1;
      existant.couples.push(c);
    } else groupes.push({
      ...c,
      key,
      quantite: 1,
      couples: [c],
      arbreCouples: construireArbreCouples(c.resultat, objectif, parentDe),
    });
  });

  return {
    objectif,
    couples,
    groupes,
    restants,
    raisonRestants,
    totalFertiles: fertiles.length,
    utilises: utilises.size,
    scoreTotal: couples.reduce((sum, c) => sum + c.score, 0),
    distances,
  };
}


export function progressionParGeneration(cheptel, historiqueCouleurs = {}) {
  const presentes = new Set(cheptel.map((m) => m.couleur));
  const estDecouverte = (couleur) => Boolean(historiqueCouleurs[couleur]) || presentes.has(couleur);

  return Object.entries(GENERATIONS_MULDO).map(([generation, couleurs]) => {
    const decouvertes = couleurs.filter(estDecouverte);
    return {
      generation: Number(generation),
      total: couleurs.length,
      decouvertes: decouvertes.length,
      manquantes: couleurs.filter((c) => !estDecouverte(c)),
      pct: couleurs.length ? Math.round(decouvertes.length / couleurs.length * 100) : 0,
    };
  });
}

// Plus haute génération entièrement validée dans les Succès — sert de base
// au déblocage des ailes "muldo" (barème palier × 2, voir tierAilesMuldo).
export function plusHauteGenerationValidee(cheptel, historiqueCouleurs) {
  const completes = progressionParGeneration(cheptel, historiqueCouleurs)
    .filter((p) => p.pct === 100)
    .map((p) => p.generation);
  return completes.length ? Math.max(...completes) : 0;
}

export function tierAilesMuldo(niveauAilesDonation, generationValidee) {
  const tierParSucces = Math.floor((Number(generationValidee) || 0) / 2);
  return Math.max(0, Math.min(5, Math.min(Number(niveauAilesDonation) || 0, tierParSucces)));
}

export function choisirObjectifGpsAutomatique({
  mode,
  objectifCouleur,
  generationCible,
  generationMin,
  generationMax,
  cheptel,
  historiqueCouleurs,
}) {
  if (mode === "couleur") {
    return {
      objectif: objectifCouleur,
      raison: "Couleur choisie manuellement.",
      candidats: [objectifCouleur],
    };
  }

  const presentes = new Set(cheptel.map((m) => m.couleur));
  const estDecouverte = (couleur) => Boolean(historiqueCouleurs[couleur]) || presentes.has(couleur);
  const stock = cheptel.reduce((acc, m) => {
    if (muldoReproductible(m)) acc[m.couleur] = (acc[m.couleur] || 0) + 1;
    return acc;
  }, {});

  // Mode "succès" : on complète les générations dans l'ordre. On saute celles
  // déjà entièrement découvertes et on vise la première génération incomplète.
  let generationSucces = null;
  if (mode === "succes") {
    for (let g = 1; g <= 10; g += 1) {
      const couleurs = GENERATIONS_MULDO[g] || [];
      if (couleurs.length && couleurs.some((c) => !estDecouverte(c))) { generationSucces = g; break; }
    }
    if (generationSucces === null) {
      return { objectif: objectifCouleur, raison: "Bravo — toutes les générations 1 à 10 sont complétées ! 🏆", candidats: [], complete: true };
    }
  }

  let candidats = [];
  if (mode === "generation") {
    candidats = [...(GENERATIONS_MULDO[Number(generationCible)] || [])];
  } else if (mode === "succes") {
    candidats = [...(GENERATIONS_MULDO[generationSucces] || [])];
  } else {
    const min = Math.min(Number(generationMin), Number(generationMax));
    const max = Math.max(Number(generationMin), Number(generationMax));
    for (let g = min; g <= max; g += 1) candidats.push(...(GENERATIONS_MULDO[g] || []));
  }

  const manquantes = candidats.filter((c) => !estDecouverte(c));
  if (!manquantes.length) {
    return {
      objectif: candidats[0] || objectifCouleur,
      raison: mode === "generation"
        ? `Génération ${generationCible} déjà complétée.`
        : `Toutes les générations ${generationMin} à ${generationMax} sont complétées.`,
      candidats,
      complete: true,
    };
  }

  const classees = manquantes
    .map((couleur) => {
      const estimation = meilleureRecettePourCouleur(couleur, stock);
      return {
        couleur,
        cout: Number.isFinite(estimation?.cout) ? estimation.cout : 999,
        generation: generationDeCouleur(couleur),
      };
    })
    .sort((a, b) => {
      if (mode === "collection" && a.generation !== b.generation) return a.generation - b.generation;
      if (a.cout !== b.cout) return a.cout - b.cout;
      return b.generation - a.generation;
    });

  const choix = classees[0];
  return {
    objectif: choix.couleur,
    raison: mode === "succes"
      ? `Succès : génération ${generationSucces} à compléter — couleur manquante la plus accessible.`
      : mode === "generation"
        ? `Couleur manquante de génération ${generationCible} estimée la plus accessible.`
        : `Première couleur manquante accessible dans la progression des générations ${generationMin} à ${generationMax}.`,
    candidats: manquantes,
    complete: false,
    cout: choix.cout,
    generationSucces,
  };
}

// ---------- utilitaires génétiques ----------
export function ancestorSet(muldo, byId, depth = 8, seen = new Set()) {
  if (!muldo || depth <= 0) return seen;
  (muldo.parentIds || []).forEach((pid) => {
    if (pid && byId[pid] && !seen.has(pid)) {
      seen.add(pid);
      ancestorSet(byId[pid], byId, depth - 1, seen);
    }
  });
  return seen;
}

export function collisionScore(a, b, byId) {
  const ancA = ancestorSet(a, byId);
  const ancB = ancestorSet(b, byId);
  if (a.parentIds?.includes(b.id) || b.parentIds?.includes(a.id)) return 99; // parent/enfant direct
  let shared = 0;
  ancA.forEach((id) => { if (ancB.has(id)) shared++; });
  return shared;
}

export function collisionLabel(score) {
  if (score >= 99) return { label: "Lien direct — à proscrire", color: COLORS.danger };
  if (score === 0) return { label: "Aucune collision détectée", color: COLORS.glow };
  if (score <= 2) return { label: `${score} collision(s) — risque modéré`, color: COLORS.gold };
  return { label: `${score} collisions — risque élevé`, color: COLORS.danger };
}

export function readinessScore(m) {
  const { amour = 0, endurance = 0, maturite = 0, serenite = 0 } = m;
  return (amour + endurance + maturite + serenite) / 4;
}

export function getNextAction(m) {
  const fatigue = Number(m.fatigue ?? 0);
  const amour = Number(m.amour ?? 0);
  const endurance = Number(m.endurance ?? 0);
  const maturite = Number(m.maturite ?? 0);
  const serenite = Number(m.serenite ?? 0);
  const reproDone = Number(m.reproDone ?? 0);
  const reproMax = Number(m.reproMax ?? 4);

  if (m.statut === "Stérile" || m.statut === "Sénile" || reproDone >= reproMax) {
    return { key: "termine", label: "Terminé / à vendre", objet: "Aucun objet", detail: "Ce muldo n'a plus de reproduction utile.", color: COLORS.muted };
  }

  if (fatigue >= 240) {
    return { key: "repos", label: "Repos", objet: "Étable / inventaire", detail: "Fatigue au maximum : laisse-le redescendre avant de continuer.", color: COLORS.gold };
  }

  if (maturite < 100) {
    return { key: "maturite", label: "Monter maturité", objet: "Abreuvoirs", detail: "Priorité : maturité. Garde une sérénité proche de 0 si possible.", color: COLORS.glow };
  }

  if (amour < 100) {
    return {
      key: "amour",
      label: "Monter amour",
      objet: "Dragofesses",
      detail: serenite < 0 ? "Passe d'abord la sérénité en positif, puis monte l'amour." : "Sérénité positive : c'est le bon moment pour monter l'amour.",
      color: serenite < 0 ? COLORS.gold : COLORS.coral,
    };
  }

  if (endurance < 100) {
    return {
      key: "endurance",
      label: "Monter endurance",
      objet: "Foudroyeurs",
      detail: serenite > 0 ? "Passe d'abord la sérénité en négatif, puis monte l'endurance." : "Sérénité négative : c'est le bon moment pour monter l'endurance.",
      color: serenite > 0 ? COLORS.gold : COLORS.coral,
    };
  }

  return { key: "pret", label: "Prêt à accoupler", objet: "Enclos / accouplement", detail: "Toutes les statistiques utiles sont prêtes.", color: COLORS.glow };
}

export function isBreedReady(m) {
  return getNextAction(m).key === "pret";
}

export function generationGoalScore(f, m, byId) {
  const coll = collisionScore(f, m, byId);
  if (coll >= 99) return -9999;

  const genGap = Math.abs(Number(f.generation ?? 1) - Number(m.generation ?? 1));
  const nextGen = Math.max(Number(f.generation ?? 1), Number(m.generation ?? 1)) + 1;
  const remaining = (Number(f.reproMax ?? 4) - Number(f.reproDone ?? 0)) + (Number(m.reproMax ?? 4) - Number(m.reproDone ?? 0));
  const readyBonus = (isBreedReady(f) ? 35 : 0) + (isBreedReady(m) ? 35 : 0);
  const sameGenBonus = genGap === 0 ? 60 : genGap === 1 ? 20 : -30;
  const colorBonus = f.couleur !== m.couleur ? 10 : 0;

  return sameGenBonus + readyBonus + remaining * 5 + nextGen * 4 + colorBonus - coll * 25;
}



export function geneticPartners(target, cheptel, byId) {
  if (!target) return [];

  return cheptel
    .filter(
      (m) =>
        m.id !== target.id &&
        m.sexe !== target.sexe &&
        m.statut !== "Stérile" &&
        m.statut !== "Sénile"
    )
    .map((partner) => {
      const coll = collisionScore(target, partner, byId);

      let score = 100;

      if (coll > 0) score -= coll * 20;
      if (target.couleur !== partner.couleur) score += 15;
      if (target.generation === partner.generation) score += 25;
      if (Math.abs(target.generation - partner.generation) === 1) score += 10;

      return { partner, score, coll };
    })
    .filter((x) => x.coll < 99)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
