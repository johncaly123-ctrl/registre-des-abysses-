// ============================================================
// Registre des Abysses — élevage de VOLKORNES
// Miroir volontairement dupliqué (pas de moteur partagé) du module muldo
// de App.jsx, adapté à la génétique et au vocabulaire volkorne. Voir
// C:\Users\Caly\.claude\plans\dazzling-painting-shamir.md pour le contexte.
// ============================================================
import { useState, useMemo, useCallback, useEffect } from "react";
import { Trash2, Baby, Heart, Zap, Sparkles, Droplets, X, AlertTriangle } from "lucide-react";
import { affectationMaximale, distanceLevenshtein, bonusProbabiliteGenerationCible, couleursAncetres, couleursCandidatesAccouplement, repartitionProbabilitesAccouplement, choisirObjectifGpsAutomatique, nomEnDoublon } from "./geneticsUtils.js";
import { CouleurCopiable, NomCopiable, exporterFicheImage, GpsDofusPage, LabeledSelect, copierPressePapiers, RechercheCouleurDeroulante, BebesARenommerPanel } from "./panneauxElevage.jsx";
import { CAPACITES_MULDO, capacitesMuldo } from "./muldoGenetique.js";
import { chargerJSON, sauvegarderJSON } from "./stockage.js";

const JAUGES_VOLKORNE = [
  { key: "amour", label: "Amour", icon: Heart },
  { key: "endurance", label: "Endurance", icon: Zap },
  { key: "maturite", label: "Maturité", icon: Sparkles },
  { key: "serenite", label: "Sérénité", icon: Droplets },
];

// ---------- Génétique : 15 couleurs monocolores, 105 bicolores (C(15,2)) ----------
// Générations des monocolores confirmées sur l'outil de croisement dofusdb.fr.
const MONOCOLORES_VOLKORNE_PAR_GENERATION = {
  1: ["Pourpre", "Orchidée", "Indigo", "Ébène"],
  3: ["Roux", "Amande", "Ivoire", "Turquoise"],
  5: ["Prune", "Émeraude"],
  7: ["Doré"],
  9: ["Jade", "Rubis", "Saphir", "Améthyste"],
};

// Exception de poids pour repartitionProbabilitesAccouplement (formule
// vérifiée 7/7 sur des captures muldo le 2026-08-01). Aucune exception
// connue côté volkorne au 2026-08-01 (confirmé par l'utilisateur) — poids
// 9 uniforme pour tous les monocolores tant qu'aucun écart n'est repéré.
export const COULEURS_POIDS_FAIBLE_VOLKORNE = [];

// Même règle que dragodinde (vérifiée sur les données confirmées) : la
// génération d'un bicolore est celle de son parent le plus tardif, plus un palier.
function construireGenerationsVolkorne() {
  const generations = {};
  for (let g = 1; g <= 10; g += 1) generations[g] = [];
  const monocolores = [];
  Object.entries(MONOCOLORES_VOLKORNE_PAR_GENERATION).forEach(([gen, noms]) => {
    noms.forEach((nom) => {
      generations[Number(gen)].push(nom);
      monocolores.push({ nom, gen: Number(gen) });
    });
  });
  for (let i = 0; i < monocolores.length; i += 1) {
    for (let j = i + 1; j < monocolores.length; j += 1) {
      const a = monocolores[i];
      const b = monocolores[j];
      const gen = Math.max(a.gen, b.gen) + 1;
      generations[gen].push(`${a.nom} et ${b.nom}`);
    }
  }
  return generations;
}
export const GENERATIONS_VOLKORNE = construireGenerationsVolkorne();
export const COULEURS_VOLKORNE = Object.values(GENERATIONS_VOLKORNE).flat();

// Recettes bicolore+bicolore → monocolore spécial, vérifiées sur les captures
// de l'arbre de croisement dofuselevage.fr fournies par l'utilisateur
// (2026-07-24) — comptes de recettes cohérents avec ceux annoncés par le site
// (Roux/Amande/Ivoire/Turquoise : 3 · Prune/Émeraude : 12 · Doré : 8 ·
// Jade/Rubis/Saphir/Améthyste : 2).
export const RECETTES_SPECIALES_VOLKORNE = {
  "Roux": [
    ["Pourpre et Orchidée", "Pourpre et Indigo"],
    ["Pourpre et Orchidée", "Pourpre et Ébène"],
    ["Pourpre et Ébène", "Pourpre et Indigo"],
  ],
  "Amande": [
    ["Pourpre et Ébène", "Orchidée et Ébène"],
    ["Pourpre et Ébène", "Indigo et Ébène"],
    ["Indigo et Ébène", "Orchidée et Ébène"],
  ],
  "Ivoire": [
    ["Pourpre et Indigo", "Indigo et Ébène"],
    ["Pourpre et Indigo", "Orchidée et Indigo"],
    ["Orchidée et Indigo", "Indigo et Ébène"],
  ],
  "Turquoise": [
    ["Pourpre et Orchidée", "Orchidée et Ébène"],
    ["Pourpre et Orchidée", "Orchidée et Indigo"],
    ["Orchidée et Indigo", "Orchidée et Ébène"],
  ],
  "Prune": [
    ["Roux et Amande", "Pourpre et Amande"],
    ["Roux et Amande", "Orchidée et Amande"],
    ["Roux et Amande", "Indigo et Amande"],
    ["Roux et Amande", "Ébène et Amande"],
    ["Roux et Amande", "Amande et Turquoise"],
    ["Roux et Amande", "Amande et Ivoire"],
    ["Roux et Amande", "Pourpre et Roux"],
    ["Roux et Amande", "Orchidée et Roux"],
    ["Roux et Amande", "Indigo et Roux"],
    ["Roux et Amande", "Ébène et Roux"],
    ["Roux et Amande", "Roux et Ivoire"],
    ["Roux et Amande", "Roux et Turquoise"],
  ],
  "Émeraude": [
    ["Ivoire et Turquoise", "Orchidée et Ivoire"],
    ["Ivoire et Turquoise", "Indigo et Ivoire"],
    ["Ivoire et Turquoise", "Ébène et Ivoire"],
    ["Ivoire et Turquoise", "Pourpre et Ivoire"],
    ["Ivoire et Turquoise", "Amande et Ivoire"],
    ["Ivoire et Turquoise", "Roux et Ivoire"],
    ["Ivoire et Turquoise", "Roux et Turquoise"],
    ["Ivoire et Turquoise", "Orchidée et Turquoise"],
    ["Ivoire et Turquoise", "Pourpre et Turquoise"],
    ["Ivoire et Turquoise", "Indigo et Turquoise"],
    ["Ivoire et Turquoise", "Ébène et Turquoise"],
    ["Ivoire et Turquoise", "Amande et Turquoise"],
  ],
  "Doré": [
    ["Pourpre et Prune", "Roux et Émeraude"],
    ["Orchidée et Prune", "Turquoise et Émeraude"],
    ["Indigo et Prune", "Ivoire et Émeraude"],
    ["Ébène et Prune", "Amande et Émeraude"],
    ["Amande et Prune", "Ébène et Émeraude"],
    ["Turquoise et Prune", "Orchidée et Émeraude"],
    ["Roux et Prune", "Pourpre et Émeraude"],
    ["Ivoire et Prune", "Indigo et Émeraude"],
  ],
  "Jade": [
    ["Pourpre et Doré", "Prune et Émeraude"],
    ["Prune et Doré", "Roux et Doré"],
  ],
  "Rubis": [
    ["Orchidée et Doré", "Prune et Émeraude"],
    ["Prune et Doré", "Amande et Doré"],
  ],
  "Saphir": [
    ["Indigo et Doré", "Prune et Émeraude"],
    ["Émeraude et Doré", "Turquoise et Doré"],
  ],
  "Améthyste": [
    ["Ébène et Doré", "Prune et Émeraude"],
    ["Émeraude et Doré", "Ivoire et Doré"],
  ],
};

function recettesPourCouleurVolkorne(couleur) {
  const speciales = RECETTES_SPECIALES_VOLKORNE[couleur];
  if (speciales) return speciales;
  if (!couleur.includes(" et ")) return [];
  const [a, b] = couleur.split(" et ").map((p) => p.trim());
  return a && b ? [[a, b]] : [];
}

function couleursGenerationJusquaVolkorne(generation) {
  const out = [];
  for (let g = 1; g <= Number(generation); g += 1) out.push(...(GENERATIONS_VOLKORNE[g] || []));
  return out;
}

export function generationDeCouleurVolkorne(couleur) {
  for (const [gen, couleurs] of Object.entries(GENERATIONS_VOLKORNE)) {
    if (couleurs.includes(couleur)) return Number(gen);
  }
  return couleur.includes(" et ") ? 4 : 1;
}

// ---------- OCR / correction floue ----------
export function plierCouleurVolkorne(value) {
  return String(value || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/0/g, "o").replace(/[^a-z]+/g, " ").trim();
}
let INDEX_COULEURS_VOLKORNE = null;
function indexCouleursVolkorne() {
  if (!INDEX_COULEURS_VOLKORNE) {
    INDEX_COULEURS_VOLKORNE = new Map();
    couleursGenerationJusquaVolkorne(10).forEach((c) => INDEX_COULEURS_VOLKORNE.set(plierCouleurVolkorne(c), c));
  }
  return INDEX_COULEURS_VOLKORNE;
}
function toleranceOCR(mot) {
  if (mot.length >= 5) return 2;
  if (mot.length >= 3) return 1;
  return 0;
}
function correspondanceFloueVolkorne(plie, candidats) {
  let meilleur = null, meilleureDistance = Infinity, exAequo = false;
  candidats.forEach((candidat) => {
    const d = distanceLevenshtein(plie, candidat);
    if (d < meilleureDistance) { meilleureDistance = d; meilleur = candidat; exAequo = false; }
    else if (d === meilleureDistance) exAequo = true;
  });
  return meilleur !== null && !exAequo && meilleureDistance <= toleranceOCR(plie) ? meilleur : null;
}
export function couleurEstCanoniqueVolkorne(couleur) {
  return indexCouleursVolkorne().has(plierCouleurVolkorne(couleur));
}
export function canonicaliserCouleurDetailVolkorne(brut) {
  const texte = String(brut || "").trim();
  if (!texte) return { couleur: texte, confiance: "inconnue" };
  const index = indexCouleursVolkorne();
  const plie = plierCouleurVolkorne(texte);
  const direct = index.get(plie);
  if (direct) return { couleur: direct, confiance: "exacte" };
  const parties = plie.split(" et ").map((p) => p.trim()).filter(Boolean);
  if (parties.length === 2) {
    const [a, b] = parties;
    const endroit = index.get(`${a} et ${b}`) || index.get(`${b} et ${a}`);
    if (endroit) return { couleur: endroit, confiance: "exacte" };
  }
  const flouEntier = correspondanceFloueVolkorne(plie, [...index.keys()]);
  if (flouEntier) return { couleur: index.get(flouEntier), confiance: "corrigee" };
  return { couleur: texte, confiance: "inconnue" };
}
export function canonicaliserCouleurVolkorne(brut) {
  return canonicaliserCouleurDetailVolkorne(brut).couleur;
}
export function analyserTexteCaptureVolkorne(texte) {
  const lignes = String(texte || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const entrees = [];
  const quantitesEnBloc = [];
  for (let i = 0; i < lignes.length; i += 1) {
    let ligne = lignes[i];
    const premierMot = (ligne.split(/\s+/)[0] || "");
    if (premierMot && !/^volkorne$/i.test(premierMot) && distanceLevenshtein(plierCouleurVolkorne(premierMot), "volkorne") <= 2) {
      ligne = `Volkorne${ligne.slice(premierMot.length)}`;
    }
    if (/^Volkorne\s+/i.test(ligne) && /et$/i.test(ligne) && i + 1 < lignes.length) {
      ligne += " " + lignes[i + 1];
      i += 1;
    }
    const matchInline = ligne.match(/^Volkorne\s+(.+?)\s+(\d+)$/i);
    if (matchInline) {
      const { couleur, confiance } = canonicaliserCouleurDetailVolkorne(matchInline[1].trim());
      entrees.push({ couleur, confiance, quantite: Number(matchInline[2]) });
      continue;
    }
    if (/^Volkorne/i.test(ligne)) {
      const { couleur, confiance } = canonicaliserCouleurDetailVolkorne(ligne.replace(/^Volkorne\s+/i, "").trim());
      entrees.push({ couleur, confiance, quantite: null });
      continue;
    }
    if (/^[0-9OolI]+$/.test(ligne)) {
      quantitesEnBloc.push(Number(ligne.replace(/[oO]/g, "0").replace(/[lI]/g, "1")) || 0);
    }
  }
  let k = 0;
  entrees.forEach((e) => { if (e.quantite === null) { e.quantite = k < quantitesEnBloc.length ? quantitesEnBloc[k] : 0; k += 1; } });
  return entrees.map(({ couleur, confiance, quantite }) => ({
    couleur, reconnu: confiance !== "inconnue", confiance, male: 0, femelle: 0, inconnu: quantite, total: quantite,
  })).sort((a, b) => a.couleur.localeCompare(b.couleur, "fr"));
}

// ---------- Aides de domaine ----------
export function sexeVolkorne(m) {
  const sexe = String(m?.sexe || "").toLowerCase();
  if (sexe.includes("mâle") || sexe.includes("male") || sexe === "m") return "M";
  if (sexe.includes("femelle") || sexe === "f") return "F";
  return "";
}
function reproRestantesVolkorne(m) {
  const rest = m?.reproRestantes ?? m?.reproductionsRestantes;
  if (rest !== undefined && rest !== null) return Number(rest) || 0;
  return Math.max(0, Number(m?.reproMax ?? 1) - Number(m?.reproDone ?? 0));
}
export function volkorneReproductible(m) {
  if (!m) return false;
  const sterileBrut = String(m.sterile ?? "").toLowerCase();
  if (m.sterile === true || sterileBrut === "oui" || sterileBrut === "true" || sterileBrut.includes("st")) return false;
  const statut = String(m.statut ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (statut.startsWith("steril") || statut.startsWith("senile")) return false;
  return reproRestantesVolkorne(m) > 0;
}
// Un bébé tout juste né a une jauge de maturité à 0 : pas réellement
// utilisable tout de suite, même s'il compte déjà comme "Fertile".
function volkornePretPourGps(m) {
  return volkorneReproductible(m) && m?.statut === "Féconde";
}
function ancestorSetVolkorne(m, byId, depth = 8, seen = new Set()) {
  if (!m || depth <= 0) return seen;
  (m.parentIds || []).forEach((id) => {
    if (!seen.has(id)) { seen.add(id); ancestorSetVolkorne(byId[id], byId, depth - 1, seen); }
  });
  return seen;
}
function collisionScoreVolkorne(a, b, byId) {
  if (!a || !b) return 0;
  if ((a.parentIds || []).includes(b.id) || (b.parentIds || []).includes(a.id)) return 99;
  const ancA = ancestorSetVolkorne(a, byId);
  const ancB = ancestorSetVolkorne(b, byId);
  let commun = 0;
  ancA.forEach((id) => { if (ancB.has(id)) commun += 1; });
  return commun;
}
function collisionLabelVolkorne(score) {
  if (score >= 99) return { label: "Lien direct parent/enfant", color: "var(--red)" };
  if (score >= 2) return { label: `${score} ancêtres communs`, color: "#e8896a" };
  if (score === 1) return { label: "1 ancêtre commun", color: "var(--muted)" };
  return { label: "Aucune collision détectée", color: "var(--green)" };
}
function readinessScoreVolkorne(m) {
  return ((Number(m.amour) || 0) + (Number(m.endurance) || 0) + (Number(m.maturite) || 0) + (Number(m.serenite) || 0)) / 4;
}
function getNextActionVolkorne(m) {
  if (!volkorneReproductible(m)) return { key: "termine", label: "Terminé / à vendre", objet: "Aucun objet", detail: "Ce volkorne n'a plus de reproduction utile.", color: "var(--muted)" };
  if ((Number(m.maturite) || 0) < 100) return { key: "maturite", label: "Faire mûrir", objet: "Mangeoire", detail: "Augmente la maturité.", color: "var(--gold2)" };
  if ((Number(m.amour) || 0) < 100) return { key: "amour", label: "Caresser", objet: "Caresseur", detail: "Augmente l'amour.", color: "#e8896a" };
  if ((Number(m.endurance) || 0) < 100) return { key: "endurance", label: "Abreuver", objet: "Abreuvoir", detail: "Augmente l'endurance.", color: "var(--cyan)" };
  return { key: "pret", label: "Prêt à accoupler", objet: "Zone / enclos", detail: "Toutes les statistiques utiles sont prêtes.", color: "var(--green)" };
}
function genererNomCourtVolkorne(couleur) {
  const initiales = String(couleur || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[\s-]+/).filter((mot) => mot && !/^et$/i.test(mot)).map((mot) => mot[0].toUpperCase()).join("");
  const lettres = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 3; i += 1) code += lettres[Math.floor(Math.random() * lettres.length)];
  return `${initiales}-${code}`;
}
function geneticPartnersVolkorne(cible, cheptel, byId) {
  const sexeCible = sexeVolkorne(cible);
  const candidats = (cheptel || []).filter((m) => m.id !== cible.id && volkorneReproductible(m) && sexeVolkorne(m) && sexeVolkorne(m) !== sexeCible);
  return candidats
    .map((m) => ({ partner: m, collision: collisionScoreVolkorne(cible, m, byId) }))
    .sort((a, b) => a.collision - b.collision || readinessScoreVolkorne(b.partner) - readinessScoreVolkorne(a.partner))
    .slice(0, 10);
}

// ---------- Planificateur (recettes → plan de croisement) ----------
function stockCouleurDisponible(stock, couleur) { return Number(stock[couleur] || 0) > 0; }
function meilleureRecettePourCouleurVolkorne(couleur, stock, visiting = new Set()) {
  if (stockCouleurDisponible(stock, couleur)) return { cout: 0, recette: null };
  if (visiting.has(couleur)) return { cout: 999, recette: null };
  const recettes = recettesPourCouleurVolkorne(couleur);
  if (!recettes.length) return { cout: 50, recette: null };
  visiting.add(couleur);
  const options = recettes.map((recette) => ({
    cout: recette.reduce((sum, parent) => sum + meilleureRecettePourCouleurVolkorne(parent, stock, visiting).cout, 1),
    recette,
  })).sort((a, b) => a.cout - b.cout);
  visiting.delete(couleur);
  return options[0];
}
export function cleCoupleCouleursVolkorne(a, b) { return [a, b].sort((x, y) => x.localeCompare(y, "fr")).join("||| "); }

// Recombinaison directe de 2 monocolores vers leur bicolore ("A et B") — même
// principe que combinerCouleursMuldo (muldoGenetique.js), construit depuis
// GENERATIONS_VOLKORNE lui-même. Sert à couleursCandidatesAccouplement pour
// dériver les couleurs cibles réellement atteignables par un couple à partir
// des ancêtres connus (pas RECETTES_SPECIALES_VOLKORNE, qui décrit une
// mécanique différente : bicolore+bicolore -> monocolore spécial).
const RECOMBINAISON_VOLKORNE = (() => {
  const map = new Map();
  Object.entries(GENERATIONS_VOLKORNE).forEach(([gen, couleurs]) => {
    if (Number(gen) % 2 !== 0) return;
    couleurs.forEach((nom) => {
      const parties = nom.split(" et ");
      if (parties.length === 2) map.set(cleCoupleCouleursVolkorne(parties[0], parties[1]), nom);
    });
  });
  return map;
})();
function combinerCouleursVolkorne(ca, cb) {
  if (!ca || !cb || ca === cb) return null;
  return RECOMBINAISON_VOLKORNE.get(cleCoupleCouleursVolkorne(ca, cb)) || null;
}

function toutesLesRecettesProgressionVolkorne() {
  const map = {};
  COULEURS_VOLKORNE.forEach((enfant) => {
    recettesPourCouleurVolkorne(enfant).forEach(([a, b]) => {
      const key = cleCoupleCouleursVolkorne(a, b);
      if (!map[key]) map[key] = [];
      if (!map[key].includes(enfant)) map[key].push(enfant);
    });
  });
  return map;
}
export const RESULTATS_PAR_COUPLE_VOLKORNE = toutesLesRecettesProgressionVolkorne();

// Couleurs qu'une naissance peut réellement donner : les résultats de recette
// du couple, plus les couleurs des deux parents (le croisement peut "retomber"
// sur l'une d'elles au lieu du résultat espéré).
function couleursNaissancePossiblesVolkorne(couleurMale, couleurFemelle) {
  const key = cleCoupleCouleursVolkorne(couleurMale, couleurFemelle);
  const possibles = new Set(RESULTATS_PAR_COUPLE_VOLKORNE[key] || []);
  possibles.add(couleurMale);
  possibles.add(couleurFemelle);
  return [...possibles];
}

function distancesEtParentsVersObjectifVolkorne(objectif) {
  const distances = { [objectif]: 0 };
  const parentDe = {};
  const queue = [objectif];
  while (queue.length) {
    const enfant = queue.shift();
    const d = distances[enfant];
    (recettesPourCouleurVolkorne(enfant) || []).forEach(([a, b]) => {
      [a, b].forEach((parent) => {
        if (distances[parent] === undefined) { distances[parent] = d + 1; parentDe[parent] = { via: enfant, pair: [a, b] }; queue.push(parent); }
      });
    });
  }
  return { distances, parentDe };
}
function construireCheminVersObjectifVolkorne(depart, objectif, distances) {
  if (!depart || !objectif) return [];
  const chemin = [depart];
  let courant = depart;
  const gardeFou = new Set([courant]);
  while (courant !== objectif) {
    let meilleurParent = null, meilleureDistance = Infinity;
    recettesPourCouleurVolkorne(courant).forEach(([a, b]) => [a, b].forEach((parent) => {
      const d = distances[parent];
      if (d !== undefined && d < meilleureDistance && !gardeFou.has(parent)) { meilleureDistance = d; meilleurParent = parent; }
    }));
    if (!meilleurParent) break;
    chemin.push(meilleurParent); gardeFou.add(meilleurParent); courant = meilleurParent;
  }
  return chemin;
}
function construireArbreCouplesVolkorne(resultat, objectif, parentDe) {
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
function scoreCoupleObjectifVolkorne(male, femelle, objectif, distances, purification = false, byId = {}, optimakina = false, niveauMinimum = 0) {
  if (!male || !femelle) return { score: -1000000, raison: "Couple invalide", resultat: null, distance: Infinity };
  if (male.couleur === femelle.couleur && !purification) return { score: -1000000, raison: "Même couleur interdite", resultat: null, distance: Infinity };
  const key = cleCoupleCouleursVolkorne(male.couleur, femelle.couleur);
  const resultats = male.couleur === femelle.couleur && purification ? [male.couleur] : (RESULTATS_PAR_COUPLE_VOLKORNE[key] || []);
  let score = 25, raison = "Accouplement de soutien", meilleurResultat = null, meilleureDistance = Infinity;
  resultats.forEach((resultat) => {
    const d = distances[resultat];
    if (d === undefined) return;
    const valeur = d === 0 ? 100000 : Math.max(1000, 25000 - d * 4000);
    if (valeur > score) { score = valeur; meilleurResultat = resultat; meilleureDistance = d; raison = d === 0 ? `Peut produire directement ${objectif}` : `Produit ${resultat}, à ${d} étape(s) de ${objectif}`; }
  });
  if (!resultats.length) return { score: -1000000, raison: "Couple sans recette officielle", resultat: null, distance: Infinity };
  if (meilleurResultat === null) {
    meilleurResultat = resultats[0];
    raison = resultats.length > 1 ? `Accouplement de soutien · produit ${resultats.join(" ou ")}` : `Accouplement de soutien · produit ${resultats[0]}`;
  }
  score += Math.max(0, 20 - collisionScoreVolkorne(male, femelle, byId));
  const chemin = construireCheminVersObjectifVolkorne(meilleurResultat, objectif, distances);
  const { generationCible, couleursCible, couleursAutres } = couleursCandidatesAccouplement(
    male, femelle, byId, generationDeCouleurVolkorne, combinerCouleursVolkorne
  );
  const generationBase = Math.max(generationDeCouleurVolkorne(male.couleur), generationDeCouleurVolkorne(femelle.couleur));
  score += (generationCible - generationBase) * 15;
  const chanceGenerationCible = bonusProbabiliteGenerationCible({ niveauA: Math.max(male.niveau || 0, niveauMinimum), niveauB: Math.max(femelle.niveau || 0, niveauMinimum), optimakina });
  const repartitionCouleurs = repartitionProbabilitesAccouplement(
    male, femelle, byId, generationDeCouleurVolkorne, combinerCouleursVolkorne,
    generationCible, chanceGenerationCible, COULEURS_POIDS_FAIBLE_VOLKORNE
  );
  return {
    score, raison, resultat: meilleurResultat, distance: meilleureDistance, chemin,
    generationCible, viaAncetre: generationCible > generationBase, chanceGenerationCible,
    couleursGenerationCible: couleursCible,
    couleursAutresGenerationCible: couleursAutres,
    repartitionCouleurs,
  };
}
function optimiserSessionAccouplementsVolkorne(cheptel, objectif, purification = false, optimakina = false, niveauMinimum = 0) {
  const fertiles = cheptel.filter(volkornePretPourGps);
  const byId = Object.fromEntries(cheptel.map((m) => [m.id, m]));
  const { distances, parentDe } = distancesEtParentsVersObjectifVolkorne(objectif);
  let malesRestants = fertiles.filter((m) => sexeVolkorne(m) === "M");
  let femellesRestantes = fertiles.filter((m) => sexeVolkorne(m) === "F");
  const couples = [];
  while (malesRestants.length && femellesRestantes.length) {
    const details = malesRestants.map((male) => femellesRestantes.map((femelle) => scoreCoupleObjectifVolkorne(male, femelle, objectif, distances, purification, byId, optimakina, niveauMinimum)));
    const affectations = affectationMaximale(details.map((row) => row.map((x) => x.score)));
    const valides = affectations.map(([i, j]) => ({ male: malesRestants[i], femelle: femellesRestantes[j], ...details[i][j] })).filter((c) => c.score > 0);
    if (!valides.length) break;
    couples.push(...valides);
    const pris = new Set(valides.flatMap((c) => [c.male.id, c.femelle.id]));
    malesRestants = malesRestants.filter((m) => !pris.has(m.id));
    femellesRestantes = femellesRestantes.filter((f) => !pris.has(f.id));
  }
  couples.sort((a, b) => b.score - a.score);
  const utilises = new Set(couples.flatMap((c) => [c.male.id, c.femelle.id]));
  const restants = fertiles.filter((m) => !utilises.has(m.id));
  let raisonRestants = "";
  if (restants.length) {
    const sansSexe = restants.filter((m) => !sexeVolkorne(m)).length;
    const couleursInconnues = restants.filter((m) => !couleurEstCanoniqueVolkorne(m.couleur)).length;
    const morceaux = [];
    if (couleursInconnues) morceaux.push(`${couleursInconnues} avec une couleur non reconnue (erreur OCR probable) — corrige-la sur leur fiche`);
    if (sansSexe) morceaux.push(`${sansSexe} au sexe inconnu — renseigne ♂/♀ sur leur fiche`);
    if (malesRestants.length && femellesRestantes.length) {
      morceaux.push(`${malesRestants.length} ♂ et ${femellesRestantes.length} ♀ sans croisement valide entre eux`);
      if (!purification) morceaux.push("astuce : coche « Mode purification » pour apparier les couples de même couleur");
    } else if (malesRestants.length) morceaux.push(`surplus de ${malesRestants.length} ♂`);
    else if (femellesRestantes.length) morceaux.push(`surplus de ${femellesRestantes.length} ♀`);
    if (restants.some((m) => generationDeCouleurVolkorne(m.couleur) === 1)) {
      morceaux.push("astuce : les volkornes de génération 1 se capturent sauvages au Haras de Brâkmar");
    }
    raisonRestants = morceaux.join(" · ");
  }
  const groupes = [];
  couples.forEach((c) => {
    const key = `${c.male.couleur}|||${c.femelle.couleur}|||${c.resultat || ""}|||${c.raison}`;
    const existant = groupes.find((g) => g.key === key);
    if (existant) { existant.quantite += 1; existant.couples.push(c); }
    else groupes.push({ ...c, key, quantite: 1, couples: [c], arbreCouples: construireArbreCouplesVolkorne(c.resultat, objectif, parentDe) });
  });
  return { objectif, couples, groupes, restants, raisonRestants, totalFertiles: fertiles.length, utilises: utilises.size, scoreTotal: couples.reduce((s, c) => s + c.score, 0), distances };
}
function progressionParGenerationVolkorne(cheptel, historiqueCouleurs = {}) {
  const presentes = new Set(cheptel.map((m) => m.couleur));
  const estDecouverte = (c) => Boolean(historiqueCouleurs[c]) || presentes.has(c);
  return Object.entries(GENERATIONS_VOLKORNE).map(([generation, couleurs]) => {
    const decouvertes = couleurs.filter(estDecouverte);
    return { generation: Number(generation), total: couleurs.length, decouvertes: decouvertes.length, manquantes: couleurs.filter((c) => !estDecouverte(c)), pct: couleurs.length ? Math.round(decouvertes.length / couleurs.length * 100) : 0 };
  });
}

// ---------- Badge couleur ----------
const PALETTE_VOLKORNE = {
  pourpre: "#8E3A6E", orchidee: "#C97FD1", indigo: "#3D4E9E", ebene: "#2E2620", roux: "#B85A38", amande: "#C9A876",
  ivoire: "#EDE6D6", turquoise: "#3FB8B1", prune: "#6E3A6E", emeraude: "#2E9B5A", dore: "#E3B341",
  jade: "#5EBE8F", rubis: "#C43A4E", saphir: "#3A5EC4", amethyste: "#8E5EC4",
};
function foldKey(mot) { return String(mot).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
export function teintesDeCouleurVolkorne(couleur) {
  return String(couleur).split(" et ").map((p) => PALETTE_VOLKORNE[foldKey(p.trim())] || "#8a7a63");
}
export function slugCouleurVolkorne(couleur) { return foldKey(couleur).replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, ""); }
export function VolkorneBadge({ couleur, taille = 22 }) {
  const [ko, setKo] = useState(false);
  if (!ko) {
    return (
      <img src={`volkornes/${slugCouleurVolkorne(couleur)}.png`} alt="" onError={() => setKo(true)}
        style={{ width: taille, height: taille, borderRadius: "50%", objectFit: "cover", verticalAlign: "middle" }} />
    );
  }
  const [c1, c2] = teintesDeCouleurVolkorne(couleur);
  return (
    <span title={couleur} style={{
      display: "inline-block", width: taille, height: taille, borderRadius: "50%", verticalAlign: "middle",
      background: c2 && c2 !== c1 ? `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` : c1,
      border: "1px solid rgba(255,255,255,.25)",
    }} />
  );
}

// ---------- Petits composants réutilisés ----------
function RechercheVolkorneDeroulante({ muldos, valeurId, onChoisir, placeholder, exclureId, onEffacer }) {
  const [recherche, setRecherche] = useState("");
  const [ferme, setFerme] = useState(true);
  const choisi = (muldos || []).find((m) => m.id === valeurId) || null;
  const prefixe = plierCouleurVolkorne(recherche.trim());
  const etiquetteSuffixe = (m) => ` — ${m.couleur} ${sexeVolkorne(m) === "F" ? "♀" : sexeVolkorne(m) === "M" ? "♂" : "?"} · G${generationDeCouleurVolkorne(m.couleur)} · ${volkorneReproductible(m) ? "fertile" : "stérile"}`;
  const etiquette = (m) => `${m.nom || m.id?.slice(0, 6)}${etiquetteSuffixe(m)}`;
  const suggestions = (!ferme && prefixe)
    ? (muldos || []).filter((m) => m.id !== exclureId && (plierCouleurVolkorne(m.nom || "").startsWith(prefixe) || plierCouleurVolkorne(m.couleur || "").startsWith(prefixe))).slice(0, 60)
    : [];
  return (
    <div style={{ position: "relative", minWidth: 260 }}>
      <input className="field" placeholder={placeholder} value={recherche} onChange={(e) => { setRecherche(e.target.value); setFerme(false); }} style={{ width: "100%", padding: "6px 10px", fontSize: 13 }} />
      {choisi && (
        <div style={{ color: "var(--gold)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          → <NomCopiable nom={choisi.nom || choisi.id?.slice(0, 6)} gras={false} />{etiquetteSuffixe(choisi)}
          {onEffacer && <button type="button" className="btn btn-ghost" style={{ padding: "0 6px", fontSize: 11 }} onClick={onEffacer}>×</button>}
        </div>
      )}
      {!ferme && prefixe && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, minWidth: 260, maxHeight: 230, overflowY: "auto", background: "var(--panel, #1d1710)", border: "1px solid var(--gold)", borderRadius: 10, boxShadow: "0 12px 30px rgba(0,0,0,.45)", padding: 4 }}>
          {suggestions.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12, padding: "6px 8px" }}>aucun volkorne trouvé</div>}
          {suggestions.map((m) => (
            <div key={m.id} onClick={() => { onChoisir(m.id); setRecherche(""); setFerme(true); }} style={{ padding: "5px 8px", fontSize: 13, cursor: "pointer", borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <VolkorneBadge couleur={m.couleur} taille={16} />{" "}{etiquette(m)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VolkorneMiniCard({ m, selected, onClick, modeSelection, coche }) {
  const action = getNextActionVolkorne(m);
  const sterile = !volkorneReproductible(m);
  const ready = action.key === "pret";
  const sexe = sexeVolkorne(m) === "F" ? "♀" : "♂";
  return (
    <div className={`muldo-card ${ready ? "muldo-ready" : ""} ${sterile ? "muldo-sterile" : ""} ${(modeSelection ? coche : selected) ? "muldo-selected" : ""}`} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {modeSelection && <input type="checkbox" checked={!!coche} readOnly style={{ pointerEvents: "none", flexShrink: 0 }} />}
          <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sexe} {m.nom}</b>
        </span>
        <span className="pill">G{generationDeCouleurVolkorne(m.couleur)}</span>
      </div>
      <div style={{ color: "var(--gold2)", fontWeight: 900, marginTop: 7 }}>{m.couleur}</div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>{m.statut} · {sterile ? "stérile" : "1 reproduction"}</div>
      {capacitesMuldo(m).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {capacitesMuldo(m).map((c) => <span key={c} className="pill" style={{ padding: "4px 7px", fontSize: 10 }}>★ {c}</span>)}
        </div>
      )}
    </div>
  );
}

// Filtre texte (nom/couleur) partagé entre la colonne technique (recherche
// seule) et VolkorneCheptelOverviewPage (recherche + filtres en cartouche).
export function filtrerCheptelParTexteVolkorne(cheptel, filter) {
  const p = plierCouleurVolkorne(filter);
  if (!p) return cheptel;
  return cheptel.filter((m) => plierCouleurVolkorne(m.nom || "").includes(p) || plierCouleurVolkorne(m.couleur || "").includes(p));
}

export function VolkorneCheptelCards({ items, selectedId, onSelect, modeSelection, idsSelectionnes, onToggleSelection }) {
  if (!items.length) {
    return (
      <div style={{ textAlign: "center", padding: "40px 18px", color: "var(--muted)" }}>
        <Baby size={32} style={{ opacity: 0.5, marginBottom: 10 }} />
        <div style={{ fontWeight: 700, color: "var(--text)" }}>Aucun volkorne trouvé</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Essaie d'élargir tes filtres, ou clique « + Nouveau volkorne » en haut pour commencer.</div>
      </div>
    );
  }
  return (
    <div className="muldo-grid">
      {items.map((m) => (
        <VolkorneMiniCard
          key={m.id}
          m={m}
          selected={selectedId === m.id}
          onClick={() => (modeSelection ? onToggleSelection(m.id) : onSelect(m.id))}
          modeSelection={modeSelection}
          coche={idsSelectionnes?.has(m.id)}
        />
      ))}
    </div>
  );
}

export function VolkorneDetail({ m, byId, onPatch, onDelete }) {
  const action = getNextActionVolkorne(m);
  const partners = useMemo(() => geneticPartnersVolkorne(m, Object.values(byId), byId), [m, byId]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <input className="field" style={{ fontSize: 18, fontWeight: 700, padding: "4px 8px", background: "transparent", border: "1px solid transparent" }}
            value={m.nom || ""} onChange={(e) => onPatch({ nom: e.target.value })} />
          {nomEnDoublon(Object.values(byId), m.nom, m.id) && (
            <div style={{ fontSize: 11.5, color: "#e0a03c", marginTop: 4, paddingLeft: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <AlertTriangle size={12} /> Un autre volkorne porte déjà ce nom.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => exporterFicheImage(m, { teintesFn: teintesDeCouleurVolkorne, slugFn: slugCouleurVolkorne, nomCreature: "volkornes" })} title="Télécharger une image de cette fiche">🖼️ Exporter</button>
          <button className="btn btn-ghost" onClick={onDelete}><Trash2 size={13} /> Retirer</button>
        </div>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Génération {generationDeCouleurVolkorne(m.couleur)} · <CouleurCopiable couleur={m.couleur} gras={false} BadgeComponent={VolkorneBadge} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Sexe
          <select className="field" value={m.sexe || ""} onChange={(e) => onPatch({ sexe: e.target.value })}>
            <option value="">?</option><option value="Mâle">Mâle</option><option value="Femelle">Femelle</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Statut
          <select className="field" value={m.statut || (m.sterile ? "Stérile" : "Fertile")} onChange={(e) => onPatch({ sterile: e.target.value === "Stérile", statut: e.target.value, ...(e.target.value === "Féconde" ? { amour: 100, endurance: 100, maturite: 100 } : {}) })}>
            <option value="Fertile">Fertile</option><option value="Féconde">Féconde</option><option value="Stérile">Stérile</option>
          </select>
        </label>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Reproduction 3.5</div>
          <button
            className={`btn ${volkorneReproductible(m) ? "btn-coral" : "btn-ghost"}`}
            style={{ width: "100%" }}
            onClick={() => {
              const devientSterile = volkorneReproductible(m);
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
            {volkorneReproductible(m) ? "1 reproduction disponible" : "Stérile — remettre fertile"}
          </button>
        </div>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Niveau (optionnel, pour la génération cible)
          <input
            className="field"
            type="number"
            min={0}
            max={200}
            placeholder="?"
            value={m.niveau ?? ""}
            onChange={(e) => onPatch({ niveau: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="panel-card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", marginBottom: 10, fontWeight: 900 }}>Capacités</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[0, 1].map((index) => {
            const valeurs = capacitesMuldo(m);
            return (
              <label key={index} style={{ fontSize: 11, color: "var(--muted)" }}>{`Capacité ${index + 1}`}
                <select
                  className="field"
                  value={valeurs[index] || "Aucune"}
                  onChange={(e) => {
                    const value = e.target.value;
                    const next = [...valeurs];
                    if (value === "Aucune") next.splice(index, 1);
                    else next[index] = value;
                    const propres = [...new Set(next.filter((c) => c && c !== "Aucune"))].slice(0, 2);
                    onPatch({
                      capacites: propres,
                      capacite1: propres[0] || "Aucune",
                      capacite2: propres[1] || "Aucune",
                    });
                  }}
                >
                  {CAPACITES_MULDO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            );
          })}
        </div>
      </div>
      <div className="panel-card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", marginBottom: 10, fontWeight: 900 }}>Généalogie</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[0, 1].map((index) => {
            const label = index === 0 ? "Père" : "Mère";
            const parentReel = m.parentIds?.[index] ? byId[m.parentIds[index]] : null;
            return (
              <div key={index}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                {parentReel ? (
                  <div style={{ fontSize: 13 }}>{parentReel.nom} <span style={{ color: "var(--muted)", fontSize: 12 }}>({parentReel.couleur})</span></div>
                ) : (
                  <RechercheCouleurDeroulante
                    couleurs={couleursGenerationJusquaVolkorne(10)}
                    valeur={m.parentsCouleurs?.[index] || null}
                    placeholder="Couleur…"
                    plierCouleurFn={plierCouleurVolkorne}
                    generationFn={generationDeCouleurVolkorne}
                    BadgeComponent={VolkorneBadge}
                    onChoisir={(c) => {
                      const suivant = [...(m.parentsCouleurs || [])];
                      suivant[index] = c;
                      onPatch({ parentsCouleurs: suivant });
                    }}
                    onEffacer={() => {
                      const suivant = [...(m.parentsCouleurs || [])];
                      suivant[index] = null;
                      onPatch({ parentsCouleurs: suivant });
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          Renseigner les parents améliore la précision de la génération cible et des probabilités affichées dans le GPS.
        </div>
      </div>
      <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: `1px solid ${action.color}`, background: "rgba(0,0,0,.12)" }}>
        <b style={{ color: action.color }}>{action.label}</b>
        <div style={{ fontSize: 12, marginTop: 4 }}>Objet : {action.objet}</div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{action.detail}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        {JAUGES_VOLKORNE.map(({ key, label, icon: Icon }) => (
          <label key={key} style={{ fontSize: 11, color: "var(--muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon size={12} /> {label}</span>
            <input type="range" min={0} max={100} value={Number(m[key]) || 0} onChange={(e) => onPatch({ [key]: Number(e.target.value) })} style={{ width: "100%" }} />
          </label>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 12 }}>Partenaires suggérés</b>
        {partners.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Aucun partenaire fertile compatible dans le cheptel.</div>}
        {partners.slice(0, 5).map(({ partner, collision }) => (
          <div key={partner.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <span><VolkorneBadge couleur={partner.couleur} taille={14} /> {partner.nom || partner.couleur}</span>
            <span style={{ color: collisionLabelVolkorne(collision).color }}>{collisionLabelVolkorne(collision).label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pensé pour la création en série (screen d'un enclos entier) : la sélection
// génération/couleur/sexe reste en place après chaque création — la modale
// ne se ferme plus toute seule — et le nom généré est copié automatiquement,
// prêt à coller dans le renommage en jeu, pour enchaîner sans ressaisir.
export function NewVolkorneModal({ cheptel, onClose, onCreate }) {
  const [filtreGeneration, setFiltreGeneration] = useState("1");
  const couleursProposees = GENERATIONS_VOLKORNE[Number(filtreGeneration)] || [];
  const [couleur, setCouleur] = useState(couleursProposees[0] || COULEURS_VOLKORNE[0]);
  const [sexe, setSexe] = useState("Femelle");
  const [dernierNom, setDernierNom] = useState("");
  const [nom, setNom] = useState("");
  const [nomPersonnalise, setNomPersonnalise] = useState(false);
  const [optionsOuvertes, setOptionsOuvertes] = useState(false);
  const [capacite1, setCapacite1] = useState("Aucune");
  const [capacite2, setCapacite2] = useState("Aucune");
  const [pere, setPere] = useState("");
  const [mere, setMere] = useState("");
  const males = (cheptel || []).filter((m) => m.sexe === "Mâle");
  const femelles = (cheptel || []).filter((m) => m.sexe === "Femelle");

  const changerGeneration = (v) => {
    setFiltreGeneration(v);
    const liste = GENERATIONS_VOLKORNE[Number(v)] || [];
    if (liste.length && !liste.includes(couleur)) setCouleur(liste[0]);
  };
  const changerCouleur = (c) => {
    setCouleur(c);
    if (!nomPersonnalise) setNom("");
  };

  const creer = () => {
    const nomFinal = (nomPersonnalise && nom.trim()) || genererNomCourtVolkorne(couleur);
    if (nomEnDoublon(cheptel, nomFinal) && !confirm(`Un volkorne nommé « ${nomFinal} » existe déjà dans le cheptel. Créer quand même ?`)) return;
    onCreate({
      nom: nomFinal, couleur, sexe, statut: "Féconde",
      capacites: [capacite1, capacite2].filter((c) => c && c !== "Aucune"),
      parentIds: [pere || null, mere || null],
    });
    copierPressePapiers(nomFinal);
    setDernierNom(nomFinal);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,8,6,.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="panel-card" style={{ width: "min(420px,92vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Nouveau volkorne</h3>
          <X size={16} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={onClose} />
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0 12px" }}>
          Génération + couleur + sexe, puis Créer : le nom est copié automatiquement. La sélection reste en place pour enchaîner sur le suivant.
        </div>
        <LabeledSelect label="Génération" value={filtreGeneration} onChange={changerGeneration}
          options={Array.from({ length: 10 }, (_, i) => [String(i + 1), `Génération ${i + 1}`])} />
        <div style={{ marginTop: 8 }}>
          <LabeledSelect label={`Couleur (${couleursProposees.length} choix)`} value={couleur} onChange={changerCouleur}
            options={couleursProposees.map((c) => [c, c])} />
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Sexe</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", ...(sexe === "Mâle" ? { borderColor: "#6fa8dc", color: "#6fa8dc" } : {}) }} onClick={() => setSexe("Mâle")}>♂ Mâle</button>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", ...(sexe === "Femelle" ? { borderColor: "#d98ec0", color: "#d98ec0" } : {}) }} onClick={() => setSexe("Femelle")}>♀ Femelle</button>
          </div>
        </div>
        <button className="btn btn-coral" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={creer}>+ Créer (copie le nom)</button>
        {dernierNom && <div style={{ marginTop: 8, fontSize: 12, color: "var(--green)" }}>✓ « {dernierNom} » créé et copié — colle-le en jeu, puis clique à nouveau.</div>}

        <button type="button" className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 14, fontSize: 12 }} onClick={() => setOptionsOuvertes((o) => !o)}>
          {optionsOuvertes ? "▾" : "▸"} Options avancées (nom, capacités, généalogie)
        </button>
        {optionsOuvertes && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="field"
                placeholder="Nom du volkorne"
                value={nom}
                onChange={(e) => { setNom(e.target.value); setNomPersonnalise(e.target.value.trim() !== ""); }}
                title="Nom proposé automatiquement (valide pour le renommage en jeu) — modifie-le librement"
              />
              <button type="button" className="btn btn-ghost" title="Proposer un autre nom" style={{ padding: "0 12px", flexShrink: 0 }}
                onClick={() => { setNom(genererNomCourtVolkorne(couleur)); setNomPersonnalise(false); }}>↻</button>
            </div>
            <LabeledSelect label="Capacité 1" value={capacite1} options={CAPACITES_MULDO.map((c) => [c, c])} onChange={setCapacite1} />
            <LabeledSelect label="Capacité 2" value={capacite2} options={CAPACITES_MULDO.map((c) => [c, c])} onChange={setCapacite2} />
            <LabeledSelect label="Père (optionnel)" value={pere} options={[["", "Inconnu / sauvage"], ...males.map((m) => [m.id, m.nom])]} onChange={setPere} />
            <LabeledSelect label="Mère (optionnel)" value={mere} options={[["", "Inconnue / sauvage"], ...femelles.map((m) => [m.id, m.nom])]} onChange={setMere} />
          </div>
        )}
        <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

// ---------- Pages exportées ----------
const STATUTS_VOLKORNE = ["Fertile", "Féconde", "Stérile"];

// Page pleine largeur (cartes en grille, filtres en cartouche, sélection
// multiple) — copiée fidèlement de CheptelOverviewPage (Muldo.jsx) pour une
// apparence/emplacement de boutons identique entre les 3 créatures.
export function VolkorneCheptelOverviewPage({ cheptel, filter, setFilter, selectedId, setSelectedId, onSupprimerPlusieurs, onMarquerStatutPlusieurs }) {
  const [filtreGeneration, setFiltreGeneration] = useState("");
  const [filtreSexe, setFiltreSexe] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreCouleur, setFiltreCouleur] = useState("");
  const [filtreDate, setFiltreDate] = useState("");
  const [triNom, setTriNom] = useState("");
  const [modeSelection, setModeSelection] = useState(false);
  const [idsSelectionnes, setIdsSelectionnes] = useState(() => new Set());

  const toggleSelection = (id) => {
    setIdsSelectionnes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const quitterModeSelection = () => { setModeSelection(false); setIdsSelectionnes(new Set()); };
  const supprimerSelection = () => {
    if (!idsSelectionnes.size) return;
    if (window.confirm(`Supprimer ${idsSelectionnes.size} volkorne(s) sélectionné(s) ? (ils partent à la corbeille, récupérables)`)) {
      onSupprimerPlusieurs(Array.from(idsSelectionnes));
      quitterModeSelection();
    }
  };

  const parTexte = useMemo(() => filtrerCheptelParTexteVolkorne(cheptel, filter), [cheptel, filter]);

  const optionsDate = useMemo(() => {
    const compteur = new Map();
    parTexte.forEach((m) => {
      const cle = m.dateAjout ? new Date(m.dateAjout).toLocaleDateString("fr-FR") : "Date inconnue";
      compteur.set(cle, (compteur.get(cle) || 0) + 1);
    });
    return [...compteur.entries()].sort(([a], [b]) => {
      if (a === "Date inconnue") return 1;
      if (b === "Date inconnue") return -1;
      const [ja, ma, aa] = a.split("/").map(Number);
      const [jb, mb, ab] = b.split("/").map(Number);
      return new Date(ab, mb - 1, jb) - new Date(aa, ma - 1, ja);
    });
  }, [parTexte]);

  const cheptelFiltre = useMemo(() => {
    const filtres = parTexte.filter((m) =>
      (!filtreGeneration || generationDeCouleurVolkorne(m.couleur) === Number(filtreGeneration)) &&
      (!filtreSexe || sexeVolkorne(m) === filtreSexe) &&
      (!filtreStatut || m.statut === filtreStatut) &&
      (!filtreCouleur || m.couleur === filtreCouleur) &&
      (!filtreDate || (m.dateAjout ? new Date(m.dateAjout).toLocaleDateString("fr-FR") : "Date inconnue") === filtreDate)
    );
    if (!triNom) return filtres;
    const tries = [...filtres].sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" }));
    if (triNom === "desc") tries.reverse();
    return tries;
  }, [parTexte, filtreGeneration, filtreSexe, filtreStatut, filtreCouleur, filtreDate, triNom]);

  const filtresActifs = filtreGeneration || filtreSexe || filtreStatut || filtreCouleur || filtreDate;
  const reinitialiserFiltres = () => {
    setFiltreGeneration(""); setFiltreSexe(""); setFiltreStatut(""); setFiltreCouleur(""); setFiltreDate(""); setTriNom("");
  };
  const selectionnerTousLesFiltres = () => {
    setIdsSelectionnes(new Set(cheptelFiltre.map((m) => m.id)));
  };
  const marquerSelection = (statut) => {
    if (!idsSelectionnes.size) return;
    onMarquerStatutPlusieurs(Array.from(idsSelectionnes), statut);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ color: "var(--gold)", fontSize: 12, fontWeight: 950, letterSpacing: 1.6, textTransform: "uppercase" }}>Cheptel</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>Cartes de volkornes</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 280 }}>
            <input className="field" placeholder="Rechercher…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => (modeSelection ? quitterModeSelection() : setModeSelection(true))}
          >
            {modeSelection ? "✕ Annuler la sélection" : "☑️ Sélection multiple"}
          </button>
        </div>
      </div>

      {modeSelection && (
        <div className="panel-card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{idsSelectionnes.size} volkorne(s) sélectionné(s) — clique sur une carte pour la cocher/décocher.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" disabled={!cheptelFiltre.length} onClick={selectionnerTousLesFiltres}>
              ☑️ Tout sélectionner ({cheptelFiltre.length}{filtresActifs ? " filtré(s)" : ""})
            </button>
            <button className="btn btn-ghost" disabled={!idsSelectionnes.size} onClick={() => marquerSelection("Fertile")}>
              Marquer Fertile
            </button>
            <button className="btn btn-ghost" disabled={!idsSelectionnes.size} onClick={() => marquerSelection("Féconde")}>
              Marquer Féconde
            </button>
            <button className="btn btn-coral" disabled={!idsSelectionnes.size} onClick={supprimerSelection}>
              🗑️ Supprimer la sélection ({idsSelectionnes.size})
            </button>
          </div>
        </div>
      )}

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
            options={[["", "Toutes"], ...Object.keys(GENERATIONS_VOLKORNE).map((g) => [g, `Génération ${g}`])]}
          />
          <LabeledSelect
            label="Couleur"
            value={filtreCouleur}
            onChange={setFiltreCouleur}
            options={[["", "Toutes"], ...COULEURS_VOLKORNE.map((c) => [c, c])]}
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
            options={[["", "Tous"], ...STATUTS_VOLKORNE.map((s) => [s, s])]}
          />
          <LabeledSelect
            label="Date de naissance"
            value={filtreDate}
            onChange={setFiltreDate}
            options={[["", "Toutes"], ...optionsDate.map(([date, n]) => [date, `${date} (${n})`])]}
          />
          <LabeledSelect
            label="Trier par nom"
            value={triNom}
            onChange={setTriNom}
            options={[["", "Par défaut"], ["asc", "Nom (A → Z)"], ["desc", "Nom (Z → A)"]]}
          />
        </div>
        {filtresActifs && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>{cheptelFiltre.length} / {cheptel.length} volkorne(s) affiché(s)</div>
        )}
      </div>

      <VolkorneCheptelCards
        items={cheptelFiltre}
        selectedId={selectedId}
        onSelect={setSelectedId}
        modeSelection={modeSelection}
        idsSelectionnes={idsSelectionnes}
        onToggleSelection={toggleSelection}
      />
    </div>
  );
}

function mapScanParCouleurVolkorne(lignes) {
  return Object.fromEntries((lignes || []).map((ligne) => [ligne.couleur, Number(ligne.total || 0)]));
}

function creerVolkorneSynchronise(couleur, sexe, index) {
  return {
    id: crypto.randomUUID(),
    nom: `${couleur} ${sexe === "F" ? "♀" : "♂"} #${index}`,
    sexe: sexe === "F" ? "Femelle" : "Mâle",
    couleur,
    generation: generationDeCouleurVolkorne(couleur),
    statut: "Féconde",
    sterile: false,
    reproRestantes: 1,
    reproductionsRestantes: 1,
    capacites: [],
    amour: 100,
    endurance: 100,
    maturite: 100,
    serenite: 50,
    note: "Créé automatiquement depuis la synchronisation par capture.",
    dateAjout: new Date().toISOString(),
  };
}

// Miroir de SynchronisationFiltresPage (Muldo.jsx) : scans séparés par sexe
// (+ capacités) accumulés, puis rapprochement différentiel avec le cheptel
// existant plutôt qu'un import qui ajoute bêtement tout ce qui est collé —
// protège les volkornes reliés à une généalogie connue.
export function VolkorneSynchronisationPage({ cheptel, updateCheptel, showToast, onVoirMuldo, onSupprimerMuldo }) {
  const TYPES_SCAN = [
    { key: "femelles", label: "Femelles", sexe: "F" },
    { key: "males", label: "Mâles", sexe: "M" },
    ...CAPACITES_MULDO.filter((c) => c !== "Aucune").map((c) => ({ key: `capacite:${c}`, label: c, capacite: c })),
  ];

  const [typeScan, setTypeScan] = useState("femelles");
  const [texte, setTexte] = useState("");
  const [preview, setPreview] = useState("");
  const [ocrEnCours, setOcrEnCours] = useState(false);
  const [scans, setScans] = useState(() => chargerJSON(STORAGE_SYNC_KEY_VOLKORNE, {}));
  const [snapshotAvant, setSnapshotAvant] = useState(null);

  const lignes = useMemo(() => analyserTexteCaptureVolkorne(texte), [texte]);
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
    const next = { ...scans, [typeScan]: { type: typeScan, label: typeActuel.label, date: new Date().toISOString(), lignes } };
    setScans(next);
    sauvegarderJSON(STORAGE_SYNC_KEY_VOLKORNE, next);
    setTexte("");
    showToast(`Scan ${typeActuel.label} enregistré : ${lignes.reduce((n, l) => n + l.total, 0)} monture(s).`);
  };

  const supprimerScan = (key) => {
    const next = { ...scans };
    delete next[key];
    setScans(next);
    sauvegarderJSON(STORAGE_SYNC_KEY_VOLKORNE, next);
  };

  const femelles = mapScanParCouleurVolkorne(scans.femelles?.lignes);
  const males = mapScanParCouleurVolkorne(scans.males?.lignes);
  const capacites = Object.fromEntries(
    Object.entries(scans)
      .filter(([key]) => key.startsWith("capacite:"))
      .map(([key, scan]) => [key.slice("capacite:".length), mapScanParCouleurVolkorne(scan.lignes)])
  );

  const couleurs = [...new Set([
    ...Object.keys(femelles),
    ...Object.keys(males),
    ...Object.values(capacites).flatMap((m) => Object.keys(m)),
  ])].sort((a, b) => a.localeCompare(b, "fr"));

  const totalFemelles = Object.values(femelles).reduce((a, b) => a + b, 0);
  const totalMales = Object.values(males).reduce((a, b) => a + b, 0);

  // ---------- Rapprochement différentiel (recommandé) ----------
  const idsParentsConnus = new Set(cheptel.flatMap((m) => m.parentIds || m.parents || []));
  const volkorneProtege = (m) => (m.parentIds || m.parents || []).length > 0 || idsParentsConnus.has(m.id);

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
      const s = sexeVolkorne(m);
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
          .filter((m) => !volkorneProtege(m))
          .sort((x, y) => Number(volkorneReproductible(x)) - Number(volkorneReproductible(y)));
        aRetirer = candidats.slice(0, -ecart);
        bloques = -ecart - aRetirer.length;
        if (bloques > 0) protegesListe = membres.filter(volkorneProtege);
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
        const existants = cheptel.filter((m) => m.couleur === d.couleur && sexeVolkorne(m) === d.sexe).length;
        for (let i = 1; i <= d.ecart; i += 1) {
          ajouts.push(creerVolkorneSynchronise(d.couleur, d.sexe, existants + i));
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
      for (let i = 1; i <= nf; i += 1) nouveau.push(creerVolkorneSynchronise(couleur, "F", i));
      for (let i = 1; i <= nm; i += 1) nouveau.push(creerVolkorneSynchronise(couleur, "M", i));
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
      const gris = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const valeur = gris >= 105 ? 255 : 0;
      data[i] = valeur; data[i + 1] = valeur; data[i + 2] = valeur; data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Prétraitement OCR impossible")), "image/png");
    });
  };

  const lireOCR = async (files) => {
    try {
      setOcrEnCours(true);
      let texteFinal = "";
      const { default: Tesseract } = await import("tesseract.js");
      for (let i = 0; i < files.length; i++) {
        const imagePreparee = await preparerImageOCR(files[i]);
        const result = await Tesseract.recognize(imagePreparee, "fra", {
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
          logger: (message) => {
            if (message.status === "recognizing text") {
              console.log(`OCR ${i + 1}/${files.length} : ${Math.round((message.progress || 0) * 100)}%`);
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

        {ocrEnCours && <div style={{ marginBottom: 12 }}>Lecture OCR en cours...</div>}
        {preview && <img src={preview} alt="Aperçu du scan" style={{ display: "block", maxWidth: 420, maxHeight: 300, objectFit: "contain", borderRadius: 12, border: "1px solid var(--line)", marginBottom: 12 }} />}

        <textarea
          className="field"
          rows={8}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={'Colle le texte OCR de la liste, par exemple :\nVolkorne Pourpre 15\nVolkorne Orchidée 9'}
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
              Compare le scan au cheptel existant et n'agit que sur les écarts. Les volkornes à généalogie
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
                      <VolkorneBadge couleur={d.couleur} taille={16} /> {d.couleur}
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
                                title="Voir la fiche de ce volkorne"
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
                                  title="Supprimer manuellement ce volkorne (confirmation demandée)"
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
                Les volkornes protégés ne sont jamais supprimés automatiquement : vérifie leur sort en jeu,
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
export function VolkorneGpsPage({
  session, mode, setMode, objectif, objectifCouleur, setObjectifCouleur,
  generationCible, setGenerationCible, generationMin, setGenerationMin, generationMax, setGenerationMax,
  choixObjectif, progressionGenerations, purification, setPurification, optimakina, setOptimakina,
  niveauMinimumSession, setNiveauMinimumSession, suivi, realiserCouplesGps, onAnnuler, onReinitialiser,
  onDemarrerNouvelleSession, onNettoyerSterilesPuisDemarrer, onVoirMuldo,
  naissances, onConfirmer, onSupprimer, journal, onPartagerTaverne, onObjectifAtteint,
}) {
  return (
    <GpsDofusPage
      session={session}
      mode={mode}
      setMode={setMode}
      objectif={objectif}
      objectifCouleur={objectifCouleur}
      setObjectifCouleur={setObjectifCouleur}
      generationCible={generationCible}
      setGenerationCible={setGenerationCible}
      generationMin={generationMin}
      setGenerationMin={setGenerationMin}
      generationMax={generationMax}
      setGenerationMax={setGenerationMax}
      choixObjectif={choixObjectif}
      progressionGenerations={progressionGenerations}
      purification={purification}
      setPurification={setPurification}
      optimakina={optimakina}
      setOptimakina={setOptimakina}
      niveauMinimumSession={niveauMinimumSession}
      setNiveauMinimumSession={setNiveauMinimumSession}
      suivi={suivi}
      naissances={naissances}
      journal={journal}
      onConfirmerNaissance={onConfirmer}
      onSupprimerNaissance={onSupprimer}
      onRealiserUn={(g) => realiserCouplesGps((g.couples || []).slice(0, 1))}
      onTerminerGroupe={(g) => realiserCouplesGps(g.couples || [])}
      onAnnuler={onAnnuler}
      onReinitialiser={onReinitialiser}
      onDemarrerNouvelleSession={onDemarrerNouvelleSession}
      onNettoyerSterilesPuisDemarrer={onNettoyerSterilesPuisDemarrer}
      onVoirMuldo={onVoirMuldo}
      BadgeComponent={VolkorneBadge}
      generationDeCouleurFn={generationDeCouleurVolkorne}
      plierCouleurFn={plierCouleurVolkorne}
      couleursToutes={COULEURS_VOLKORNE}
      generationsTable={GENERATIONS_VOLKORNE}
      sexeFn={sexeVolkorne}
      couleurEstCanoniqueFn={couleurEstCanoniqueVolkorne}
      resultatsParCouple={RESULTATS_PAR_COUPLE_VOLKORNE}
      cleCoupleCouleursFn={cleCoupleCouleursVolkorne}
      lieuCapture="au Haras de Brâkmar"
      nomObjectifLabel="Volkorne objectif"
      nomEntitePluriel="Volkornes"
      supporteReproducteur={false}
      onPartagerTaverne={onPartagerTaverne}
      onObjectifAtteint={onObjectifAtteint}
    />
  );
}


// Miroir de suggererClonages (Muldo.jsx) : classe les duos de stériles selon
// leur utilité vis-à-vis de l'objectif GPS courant (proximité + bonus si plus
// aucun fertile de cette couleur), pas juste par ordre d'apparition.
function suggererClonagesVolkorne(cheptel, objectif, generationFiltre) {
  const candidats = (cheptel || [])
    .filter((m) => !volkorneReproductible(m))
    .filter((m) => !generationFiltre || generationDeCouleurVolkorne(m.couleur) === generationFiltre);
  if (candidats.length < 2) return [];
  const { distances } = distancesEtParentsVersObjectifVolkorne(objectif);
  const fertilesParCouleur = new Map();
  (cheptel || []).filter(volkorneReproductible).forEach((m) => {
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
    const g = generationDeCouleurVolkorne(m.couleur);
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
          ? scoreCouleur(a.couleur) + 5
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

export function VolkorneClonagePage({ cheptel, fusionA, fusionB, setFusionA, setFusionB, onFusion, objectif, journal }) {
  const [choix, setChoix] = useState({ couleur: null, sexe: null, genealogie: null });
  const A = cheptel.find((m) => m.id === fusionA) || null;
  const B = cheptel.find((m) => m.id === fusionB) || null;
  const genealogieDe = (m) => {
    const parents = [0, 1]
      .map((i) => (m?.parentIds?.[i] ? cheptel.find((x) => x.id === m.parentIds[i])?.couleur : null) || m?.parentsCouleurs?.[i] || null)
      .filter(Boolean);
    return parents.length ? parents.join(" + ") : "aucune généalogie connue";
  };
  const genA = A ? generationDeCouleurVolkorne(A.couleur) : null;
  const genB = B ? generationDeCouleurVolkorne(B.couleur) : null;
  const memeGeneration = A && B && genA === genB;

  const candidatsSteriles = useMemo(() => cheptel.filter((m) => !volkorneReproductible(m)), [cheptel]);
  const generationsDisponibles = useMemo(
    () => [...new Set(candidatsSteriles.map((m) => generationDeCouleurVolkorne(m.couleur)))].sort((a, b) => a - b),
    [candidatsSteriles]
  );
  const [genFiltre, setGenFiltre] = useState("toutes");
  const suggestionsClonage = suggererClonagesVolkorne(cheptel, objectif, genFiltre === "toutes" ? null : Number(genFiltre));

  const candidatsPour = useCallback((autre) => {
    if (!autre) {
      return [...candidatsSteriles].sort((x, y) =>
        (x.couleur || "").localeCompare(y.couleur || "", "fr") || (x.nom || "").localeCompare(y.nom || "", "fr")
      );
    }
    const genRef = generationDeCouleurVolkorne(autre.couleur);
    const sexeAutre = sexeVolkorne(autre);
    const priorite = (m) => {
      if (m.couleur === autre.couleur && sexeVolkorne(m) === sexeAutre) return 0;
      if (m.couleur === autre.couleur) return 1;
      return 2;
    };
    return candidatsSteriles
      .filter((m) => generationDeCouleurVolkorne(m.couleur) === genRef)
      .sort((x, y) => priorite(x) - priorite(y)
        || (x.couleur || "").localeCompare(y.couleur || "", "fr")
        || (x.nom || "").localeCompare(y.nom || "", "fr"));
  }, [candidatsSteriles]);
  const candidatsA = useMemo(() => candidatsPour(B), [candidatsPour, B]);
  const candidatsB = useMemo(() => candidatsPour(A), [candidatsPour, A]);

  const sexeA = A ? sexeVolkorne(A) : null;
  const sexeB = B ? sexeVolkorne(B) : null;
  const sexeImpose = sexeA && sexeA === sexeB ? sexeA : null;
  const sexeChoisi = sexeImpose || choix.sexe;

  return (
    <div>
      <div className="panel-card">
        <h2 style={{ marginTop: 0 }}>Clonage des stériles</h2>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
          Deux volkornes stériles de <b>même génération</b> sont détruits pour créer un nouveau volkorne
          <b> Fertile</b>, d'une des deux couleurs (tirage du jeu). Le bébé reprend la génétique d'un seul des
          deux parents (à choisir) : ses parents généalogiques deviennent les propres parents de celui-là, pas
          le couple cloné. Les capacités sont perdues et les jauges remises à zéro.{" "}
          {candidatsSteriles.length} stérile(s) disponible(s) pour le clonage. Une fois le premier volkorne
          choisi, le second se limite à sa génération, en priorité même couleur/même sexe, puis même couleur,
          puis le reste.
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <RechercheVolkorneDeroulante muldos={candidatsA} valeurId={fusionA} exclureId={fusionB} onChoisir={setFusionA} placeholder="Volkorne A : nom ou couleur…" />
          <span style={{ color: "var(--gold2)", fontSize: 20, alignSelf: "center" }}>+</span>
          <RechercheVolkorneDeroulante muldos={candidatsB} valeurId={fusionB} exclureId={fusionA} onChoisir={setFusionB} placeholder="Volkorne B : nom ou couleur…" />
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <b>Résultat du clonage</b>
        {!A || !B ? (
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
            Choisis deux volkornes stériles pour voir ce que le clonage peut donner.
          </div>
        ) : !memeGeneration ? (
          <div style={{ color: "#e8896a", fontSize: 13, marginTop: 8 }}>
            ⚠ Générations différentes (G{genA} + G{genB}) : le clonage est impossible en jeu.
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <div>
              Un volkorne <b>Fertile</b> de génération <b className="chiffre-hero" style={{ color: "var(--gold2)" }}>G{genA}</b>, au choix du jeu (≈ 50/50) :
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              {A.couleur === B.couleur ? (
                <span className="pill" style={{ padding: "6px 12px", fontSize: 14, border: "1px solid var(--gold)", color: "var(--gold)" }}>
                  {A.couleur} — imposé (mêmes couleurs des deux parents)
                </span>
              ) : (
                [A.couleur, B.couleur].map((couleur) => (
                  <button
                    key={couleur}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setChoix((prev) => ({ ...prev, couleur }))}
                    style={choix.couleur === couleur ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
                  >
                    {couleur}
                  </button>
                ))
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
                  <button type="button" className="btn btn-ghost" style={choix.sexe === "M" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined} onClick={() => setChoix((prev) => ({ ...prev, sexe: "M" }))}>♂ Mâle</button>
                  <button type="button" className="btn btn-ghost" style={choix.sexe === "F" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined} onClick={() => setChoix((prev) => ({ ...prev, sexe: "F" }))}>♀ Femelle</button>
                </>
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Génétique reçue (l'autre lignée est perdue) :</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" style={choix.genealogie === "A" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined} onClick={() => setChoix((prev) => ({ ...prev, genealogie: "A" }))}>{A.nom || "Volkorne A"} — parents : {genealogieDe(A)}</button>
                <button type="button" className="btn btn-ghost" style={choix.genealogie === "B" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined} onClick={() => setChoix((prev) => ({ ...prev, genealogie: "B" }))}>{B.nom || "Volkorne B"} — parents : {genealogieDe(B)}</button>
              </div>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
              {sexeImpose ? "Sexe imposé par les parents" : "Sexe aléatoire"} · capacités perdues · jauges à zéro.
            </div>
            <button
              className="btn btn-coral"
              style={{ marginTop: 12, opacity: (A.couleur === B.couleur || choix.couleur) && sexeChoisi && choix.genealogie ? 1 : 0.5 }}
              disabled={!((A.couleur === B.couleur || choix.couleur) && sexeChoisi && choix.genealogie)}
              onClick={() => {
                onFusion(A.couleur === B.couleur ? A.couleur : choix.couleur, sexeChoisi, choix.genealogie);
                setChoix({ couleur: null, sexe: null, genealogie: null });
              }}
            >
              Cloner — enregistrer ce résultat
            </button>
            {!((A.couleur === B.couleur || choix.couleur) && sexeChoisi && choix.genealogie) && (
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                Fais le clonage en jeu, puis sélectionne la couleur, le sexe et la génétique réellement obtenus.
              </div>
            )}
          </div>
        )}
        {A && B && A.id === B.id && (
          <div style={{ color: "#e8896a", fontSize: 13, marginTop: 8 }}>⚠ Choisis deux volkornes différents.</div>
        )}
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
          Limité à 6 suggestions à la fois.
        </div>
        {suggestionsClonage.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Aucune suggestion {genFiltre !== "toutes" ? `pour la génération ${genFiltre}` : "pour le moment"}.
          </div>
        )}
        {suggestionsClonage.map((s, i) => (
          <div key={`${s.a.id}|${s.b.id}`} className="message-row" style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
            borderTop: "1px solid rgba(255,255,255,.06)", padding: "9px 0",
            animationDelay: `${i * 35}ms`,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <VolkorneBadge couleur={s.a.couleur} taille={17} /> {s.a.nom ? <NomCopiable nom={s.a.nom} onCopie={() => setFusionA(s.a.id)} /> : s.a.couleur}
              <span style={{ color: "var(--gold2)" }}>+</span>
              <VolkorneBadge couleur={s.b.couleur} taille={17} /> {s.b.nom ? <NomCopiable nom={s.b.nom} onCopie={() => setFusionB(s.b.id)} /> : s.b.couleur}
              <span className="pill" style={{ padding: "2px 8px", fontSize: 11 }}>G{s.generation}</span>
            </span>
            <span style={{ color: "var(--muted)", fontSize: 12, flex: 1, minWidth: 200 }}>
              {s.memeCouleur
                ? <>résultat garanti : <b>{s.a.couleur}</b> — {s.raisons[0].texte}</>
                : s.raisons.map((r, i2) => (
                    <span key={r.couleur}>{i2 > 0 && " · "}<b>{r.couleur}</b> : {r.texte}</span>
                  ))}
            </span>
            <button className="btn btn-ghost" onClick={() => { setFusionA(s.a.id); setFusionB(s.b.id); }}>Choisir ce duo</button>
          </div>
        ))}
      </div>

      <BebesARenommerPanel journal={journal} BadgeComponent={VolkorneBadge} />
    </div>
  );
}

export function VolkorneSuccesPage({ historiqueCouleurs, cheptel, onToggleCouleur, onValidateGeneration, journal }) {
  const presentes = new Set(cheptel.map((m) => m.couleur));
  const seen = (c) => Boolean(historiqueCouleurs[c]) || presentes.has(c);
  const nbNaissances = (journal || []).filter((j) => j.type !== "clonage").length;
  const nbClonages = (journal || []).filter((j) => j.type === "clonage").length;
  const jalons = [
    { label: "Première naissance", atteint: nbNaissances >= 1 },
    { label: "Premier clonage", atteint: nbClonages >= 1 },
    { label: "100 naissances", atteint: nbNaissances >= 100 },
    { label: "10 clonages réussis", atteint: nbClonages >= 10 },
  ];
  return (
    <div>
      <h1 style={{ fontSize: 28 }}>Succès Volkorne</h1>
      <div className="panel-card" style={{ marginBottom: 12 }}>
        <b>Jalons</b>
        <div className="success-grid" style={{ marginTop: 10 }}>
          {jalons.map((j) => (
            <div key={j.label} className={`success-chip ${j.atteint ? "success-ok" : "success-miss"}`}>
              {j.atteint ? "🏅" : "⬜"} {j.label}
            </div>
          ))}
        </div>
      </div>
      {Object.entries(GENERATIONS_VOLKORNE).map(([gen, couleurs]) => {
        const decouvertes = couleurs.filter(seen).length;
        const pct = couleurs.length ? Math.round(decouvertes / couleurs.length * 100) : 0;
        return (
          <div key={gen} className="panel-card" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>Génération {gen}</b>
              <span>{decouvertes}/{couleurs.length} ({pct}%)</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {couleurs.map((c) => (
                <button key={c} className="pill" style={{ cursor: "pointer", border: seen(c) ? "1px solid var(--green)" : "1px solid var(--line)", background: "none" }} onClick={() => onToggleCouleur(c, !seen(c))}>
                  <VolkorneBadge couleur={c} taille={14} /> {c}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => onValidateGeneration(Number(gen))}>Valider toute la G{gen}</button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Stockage & hook d'état ----------
export const STORAGE_KEY_VOLKORNE = "cheptel-volkornes-v1";
export const STORAGE_HISTORY_KEY_VOLKORNE = "volkorne-historique-couleurs-v1";
export const STORAGE_JOURNAL_VOLKORNE = "volkorne-journal-naissances-v1";
export const STORAGE_NAISSANCES_VOLKORNE = "volkorne-naissances-attente-v1";
export const STORAGE_CORBEILLE_VOLKORNE = "volkorne-corbeille-v1";
export const STORAGE_GPS_SESSION_VOLKORNE = "volkorne-gps-session-v1";
export const STORAGE_GPS_PARAMS_VOLKORNE = "volkorne-gps-parametres-v1";
export const STORAGE_INSTANTANES_VOLKORNE = "volkorne-instantanes-v1";
export const STORAGE_SYNC_KEY_VOLKORNE = "volkorne-synchronisation-filtres-v1";
export const CORBEILLE_DUREE_JOURS_VOLKORNE = 30;
export const CLES_SAUVEGARDE_VOLKORNE = [STORAGE_KEY_VOLKORNE, STORAGE_HISTORY_KEY_VOLKORNE, STORAGE_JOURNAL_VOLKORNE, STORAGE_NAISSANCES_VOLKORNE, STORAGE_CORBEILLE_VOLKORNE, STORAGE_GPS_SESSION_VOLKORNE, STORAGE_GPS_PARAMS_VOLKORNE, STORAGE_INSTANTANES_VOLKORNE, STORAGE_SYNC_KEY_VOLKORNE];

const GPS_SUIVI_DEFAUT_VOLKORNE = { mode: "couleur", objectif: "Ébène", purification: false, consommes: [], historique: [], totalInitial: 0 };
function normaliserGpsSuiviVolkorne(v) {
  if (!v || typeof v !== "object") return { ...GPS_SUIVI_DEFAUT_VOLKORNE };
  return {
    mode: v.mode || "couleur",
    objectif: v.objectif || "Ébène",
    purification: Boolean(v.purification),
    consommes: Array.isArray(v.consommes) ? v.consommes : [],
    historique: Array.isArray(v.historique) ? v.historique : [],
    totalInitial: Number(v.totalInitial || 0),
  };
}

export function useVolkorneElevage() {
  const [cheptel, setCheptel] = useState(() => chargerJSON(STORAGE_KEY_VOLKORNE, []));
  const [historiqueCouleurs, setHistoriqueCouleurs] = useState(() => chargerJSON(STORAGE_HISTORY_KEY_VOLKORNE, {}));
  const [journal, setJournal] = useState(() => chargerJSON(STORAGE_JOURNAL_VOLKORNE, []));
  const [instantanes, setInstantanes] = useState(() => {
    const saved = chargerJSON(STORAGE_INSTANTANES_VOLKORNE, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [naissances, setNaissances] = useState(() => chargerJSON(STORAGE_NAISSANCES_VOLKORNE, []));
  const persisterNaissances = useCallback((next) => {
    sauvegarderJSON(STORAGE_NAISSANCES_VOLKORNE, next);
  }, []);
  const [corbeille, setCorbeille] = useState(() => {
    const saved = chargerJSON(STORAGE_CORBEILLE_VOLKORNE, []);
    const limite = Date.now() - CORBEILLE_DUREE_JOURS_VOLKORNE * 24 * 60 * 60 * 1000;
    const purge = (Array.isArray(saved) ? saved : []).filter((e) => new Date(e.supprimeLe).getTime() > limite);
    if (purge.length !== saved.length) sauvegarderJSON(STORAGE_CORBEILLE_VOLKORNE, purge);
    return purge;
  });
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [fusionA, setFusionA] = useState("");
  const [fusionB, setFusionB] = useState("");
  // Réglages GPS persistés (voir Muldo.jsx / STORAGE_GPS_PARAMS pour le raisonnement).
  const parametresGpsInitiaux = useMemo(() => chargerJSON(STORAGE_GPS_PARAMS_VOLKORNE, null) || {}, []);
  const [modeGps, setModeGps] = useState(parametresGpsInitiaux.mode ?? "couleur");
  const [objectifGps, setObjectifGps] = useState(parametresGpsInitiaux.objectifCouleur ?? "Ébène");
  const [generationGps, setGenerationGps] = useState(parametresGpsInitiaux.generationCible ?? 3);
  const [generationCollectionMin, setGenerationCollectionMin] = useState(parametresGpsInitiaux.generationMin ?? 2);
  const [generationCollectionMax, setGenerationCollectionMax] = useState(parametresGpsInitiaux.generationMax ?? 10);
  const [purification, setPurification] = useState(parametresGpsInitiaux.purification ?? false);
  const [optimakina, setOptimakina] = useState(parametresGpsInitiaux.optimakina ?? false);
  const [niveauMinimumSession, setNiveauMinimumSession] = useState(parametresGpsInitiaux.niveauMinimumSession ?? 0);

  useEffect(() => {
    sauvegarderJSON(STORAGE_GPS_PARAMS_VOLKORNE, {
      mode: modeGps,
      objectifCouleur: objectifGps,
      generationCible: generationGps,
      generationMin: generationCollectionMin,
      generationMax: generationCollectionMax,
      purification,
      optimakina,
      niveauMinimumSession,
    });
  }, [modeGps, objectifGps, generationGps, generationCollectionMin, generationCollectionMax, purification, optimakina, niveauMinimumSession]);
  const [gpsSuivi, setGpsSuivi] = useState(() => normaliserGpsSuiviVolkorne(chargerJSON(STORAGE_GPS_SESSION_VOLKORNE, GPS_SUIVI_DEFAUT_VOLKORNE)));

  const byId = useMemo(() => Object.fromEntries(cheptel.map((m) => [m.id, m])), [cheptel]);

  const progressionGps = useMemo(
    () => progressionParGenerationVolkorne(cheptel, historiqueCouleurs),
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
      generationsTable: GENERATIONS_VOLKORNE,
      reproductibleFn: volkornePretPourGps,
      meilleureRecetteFn: meilleureRecettePourCouleurVolkorne,
      generationDeCouleurFn: generationDeCouleurVolkorne,
    }),
    [modeGps, objectifGps, generationGps, generationCollectionMin, generationCollectionMax, cheptel, historiqueCouleurs]
  );

  const objectifGpsActif = choixObjectifGps.objectif || objectifGps;

  // Mémoïsé : sinon un nouvel objet est créé à chaque rendu dès que la
  // session suivie ne correspond pas aux réglages courants, ce qui casse la
  // mémoïsation en aval (cheptelGpsDisponible -> sessionGps) et relance
  // l'affectation hongroise O(n^3) sur tout le cheptel à chaque rendu.
  const gpsSuiviActif = useMemo(() => (
    gpsSuivi.mode === modeGps
      && gpsSuivi.objectif === objectifGpsActif
      && gpsSuivi.purification === purification
      ? gpsSuivi
      : { mode: modeGps, objectif: objectifGpsActif, purification, consommes: [], historique: [], totalInitial: 0 }
  ), [gpsSuivi, modeGps, objectifGpsActif, purification]);

  const cheptelGpsDisponible = useMemo(() => {
    const idsConsommes = new Set(gpsSuiviActif.consommes || []);
    return cheptel.filter((m) => !idsConsommes.has(m.id));
  }, [cheptel, gpsSuiviActif.consommes]);

  const sessionGps = useMemo(
    () => optimiserSessionAccouplementsVolkorne(cheptelGpsDisponible, objectifGpsActif, purification, optimakina, niveauMinimumSession),
    [cheptelGpsDisponible, objectifGpsActif, purification, optimakina, niveauMinimumSession]
  );

  // sauvegarderJSON (src/stockage.js) écrit dans un cache en mémoire poussé
  // en arrière-plan vers Supabase — elle ne lève jamais d'exception ici ; un
  // échec réseau se voit via l'indicateur "sauvegarde…/échec" de l'en-tête
  // (etatSauvegarde()), pas par une erreur synchrone à ce point d'appel.
  const sauvegarderSuiviGps = useCallback((next) => {
    setGpsSuivi(next);
    sauvegarderJSON(STORAGE_GPS_SESSION_VOLKORNE, next);
  }, []);

  const synchroniserContexteGps = useCallback(() => {
    if (
      gpsSuivi.mode === modeGps
      && gpsSuivi.objectif === objectifGpsActif
      && gpsSuivi.purification === purification
    ) return;

    const totalInitial = optimiserSessionAccouplementsVolkorne(cheptel, objectifGpsActif, purification).couples.length;

    sauvegarderSuiviGps({
      mode: modeGps,
      objectif: objectifGpsActif,
      purification,
      consommes: [],
      historique: [],
      totalInitial,
    });
  }, [gpsSuivi.mode, gpsSuivi.objectif, gpsSuivi.purification, modeGps, objectifGpsActif, purification, cheptel, sauvegarderSuiviGps]);

  const realiserCouplesGps = useCallback((couplesARealiser) => {
    synchroniserContexteGps();
    setGpsSuivi((prev) => {
      const contexteValide = prev.mode === modeGps
        && prev.objectif === objectifGpsActif
        && prev.purification === purification;

      const base = contexteValide
        ? prev
        : {
            mode: modeGps,
            objectif: objectifGpsActif,
            purification,
            consommes: [],
            historique: [],
            totalInitial: optimiserSessionAccouplementsVolkorne(cheptel, objectifGpsActif, purification).couples.length,
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
        totalInitial: base.totalInitial || optimiserSessionAccouplementsVolkorne(cheptel, objectifGpsActif, purification).couples.length,
      };

      sauvegarderJSON(STORAGE_GPS_SESSION_VOLKORNE, next);
      return next;
    });

    // Chaque couple réalisé ouvre une naissance à confirmer (immédiate et
    // garantie) : le croisement ne donne pas forcément le résultat de la
    // recette, donc on attend la saisie du résultat réel avant de toucher au
    // statut des parents (voir confirmerNaissance).
    setNaissances((prev) => {
      const dejaPaires = new Set(prev.map((n) => `${n.maleId}|${n.femelleId}`));
      const ajouts = (couplesARealiser || [])
        .filter((c) => c?.male?.id && c?.femelle?.id && !dejaPaires.has(`${c.male.id}|${c.femelle.id}`))
        .map((c) => {
          const repartition = c.repartitionCouleurs || {};
          const couleursTriees = Object.keys(repartition).length
            ? Object.entries(repartition).sort((a, b) => b[1] - a[1]).map(([couleur]) => couleur)
            : [...new Set([
                ...couleursNaissancePossiblesVolkorne(c.male.couleur, c.femelle.couleur),
                ...couleursAncetres(c.male, cheptel),
                ...couleursAncetres(c.femelle, cheptel),
              ])];
          // La répartition ne pondère que les recombinaisons simples et ignore
          // les recettes spéciales : le résultat espéré doit rester cliquable
          // même quand il n'a pas reçu de poids.
          if (c.resultat && !couleursTriees.includes(c.resultat)) couleursTriees.push(c.resultat);
          return {
            id: crypto.randomUUID(),
            maleId: c.male.id,
            femelleId: c.femelle.id,
            maleNom: c.male.nom || c.male.couleur,
            femelleNom: c.femelle.nom || c.femelle.couleur,
            maleCouleur: c.male.couleur,
            femelleCouleur: c.femelle.couleur,
            resultatEspere: c.resultat || null,
            possibles: couleursTriees,
            pourcentages: repartition,
            date: new Date().toISOString(),
          };
        });
      if (!ajouts.length) return prev;
      const suivant = [...prev, ...ajouts];
      persisterNaissances(suivant);
      return suivant;
    });
  }, [cheptel, modeGps, objectifGpsActif, purification, synchroniserContexteGps, persisterNaissances]);

  const annulerDernierCoupleGps = useCallback(() => {
    setGpsSuivi((prev) => {
      if (
        prev.mode !== modeGps
        || prev.objectif !== objectifGpsActif
        || prev.purification !== purification
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
      sauvegarderJSON(STORAGE_GPS_SESSION_VOLKORNE, next);

      const [maleId, femelleId] = dernierePaire || [];
      setNaissances((anciennes) => {
        const suivantes = anciennes.filter((n) => !(n.maleId === maleId && n.femelleId === femelleId));
        if (suivantes.length === anciennes.length) return anciennes;
        persisterNaissances(suivantes);
        return suivantes;
      });

      return next;
    });
  }, [modeGps, objectifGpsActif, purification, persisterNaissances]);

  const reinitialiserSessionGps = useCallback(() => {
    const totalInitial = optimiserSessionAccouplementsVolkorne(cheptel, objectifGpsActif, purification).couples.length;
    sauvegarderSuiviGps({
      mode: modeGps,
      objectif: objectifGpsActif,
      purification,
      consommes: [],
      historique: [],
      totalInitial,
    });
  }, [cheptel, modeGps, objectifGpsActif, purification, sauvegarderSuiviGps]);

  const updateCheptel = useCallback((updater) => {
    setCheptel((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      sauvegarderJSON(STORAGE_KEY_VOLKORNE, next);
      return next;
    });
  }, []);

  // Instantané quotidien pour la courbe de progression : un point par jour,
  // pris dès que le cheptel est chargé (limité aux 365 derniers).
  useEffect(() => {
    if (!cheptel.length) return;
    const aujourdhui = new Date().toISOString().slice(0, 10);
    setInstantanes((prev) => {
      const point = {
        date: aujourdhui,
        total: cheptel.length,
        fertiles: cheptel.filter(volkorneReproductible).length,
        couleurs: new Set(cheptel.map((m) => m.couleur)).size,
        naissances: journal.length,
      };
      const dernier = prev[prev.length - 1];
      if (dernier && dernier.date === aujourdhui) {
        if (dernier.total === point.total && dernier.fertiles === point.fertiles
          && dernier.couleurs === point.couleurs && dernier.naissances === point.naissances) return prev;
        const next = [...prev.slice(0, -1), point];
        sauvegarderJSON(STORAGE_INSTANTANES_VOLKORNE, next);
        return next;
      }
      const next = [...prev, point].slice(-365);
      sauvegarderJSON(STORAGE_INSTANTANES_VOLKORNE, next);
      return next;
    });
  }, [cheptel, journal.length]);

  // Raccourci de début de session : bascule en masse tous les "Fertile"
  // (bébés/pas encore marqués prêts) vers "Féconde" (prêt à s'accoupler),
  // jauges forcées à 100, puis relance le plan GPS.
  const demarrerNouvelleSessionAccouplement = useCallback(() => {
    const nb = cheptel.filter((m) => m.statut === "Fertile" && !m.sterile).length;
    if (nb > 0) {
      updateCheptel((prev) => prev.map((m) => (m.statut === "Fertile" && !m.sterile
        ? { ...m, statut: "Féconde", amour: 100, endurance: 100, maturite: 100 }
        : m)));
    }
    reinitialiserSessionGps();
  }, [cheptel, updateCheptel, reinitialiserSessionGps]);

  // Remise à zéro après un suivi de clonage/session mal tenu : les stériles
  // partent à la corbeille (récupérable) et tout le reste repasse Féconde.
  const nettoyerSterilesPuisDemarrerSession = useCallback(() => {
    const steriles = cheptel.filter((m) => m.sterile === true || m.statut === "Stérile");
    const restants = cheptel.filter((m) => !(m.sterile === true || m.statut === "Stérile"));

    if (steriles.length) {
      setCorbeille((prev) => {
        const next = [
          ...steriles.map((muldo) => ({ muldo, supprimeLe: new Date().toISOString() })),
          ...prev,
        ].slice(0, 250);
        sauvegarderJSON(STORAGE_CORBEILLE_VOLKORNE, next);
        return next;
      });
      setSelectedId((s) => (s && steriles.some((m) => m.id === s) ? null : s));
    }

    updateCheptel(() => restants.map((m) => ({
      ...m,
      statut: "Féconde",
      sterile: false,
      reproDone: 0,
      reproRestantes: 1,
      reproductionsRestantes: 1,
      amour: 100,
      endurance: 100,
      maturite: 100,
    })));

    reinitialiserSessionGps();
  }, [cheptel, updateCheptel, reinitialiserSessionGps]);

  const patchMuldo = useCallback((id, patch) => updateCheptel((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))), [updateCheptel]);
  const deleteMuldo = useCallback((id) => {
    setCheptel((prev) => {
      const muldo = prev.find((m) => m.id === id);
      const next = prev.filter((m) => m.id !== id);
      sauvegarderJSON(STORAGE_KEY_VOLKORNE, next);
      if (muldo) {
        setCorbeille((prevCorbeille) => {
          const nextCorbeille = [{ muldo, supprimeLe: new Date().toISOString() }, ...prevCorbeille].slice(0, 250);
          sauvegarderJSON(STORAGE_CORBEILLE_VOLKORNE, nextCorbeille);
          return nextCorbeille;
        });
      }
      return next;
    });
    setSelectedId((s) => (s === id ? null : s));
  }, []);
  // Suppression en masse (sélection multiple dans le Cheptel) : même
  // sécurité que la suppression individuelle, tout part à la corbeille.
  const deleteMuldos = useCallback((ids) => {
    const idsSet = new Set(ids);
    setCheptel((prev) => {
      const muldos = prev.filter((m) => idsSet.has(m.id));
      const next = prev.filter((m) => !idsSet.has(m.id));
      if (muldos.length) {
        sauvegarderJSON(STORAGE_KEY_VOLKORNE, next);
        setCorbeille((prevCorbeille) => {
          const supprimeLe = new Date().toISOString();
          const nextCorbeille = [...muldos.map((muldo) => ({ muldo, supprimeLe })), ...prevCorbeille].slice(0, 250);
          sauvegarderJSON(STORAGE_CORBEILLE_VOLKORNE, nextCorbeille);
          return nextCorbeille;
        });
      }
      return next;
    });
    setSelectedId((s) => (s && idsSet.has(s) ? null : s));
  }, []);
  // Changement de statut en masse (sélection multiple dans le Cheptel) — même
  // règle que le sélecteur Statut individuel : passer en Féconde force les
  // jauges amour/endurance/maturité à 100 (prêt, point).
  const marquerStatutMuldos = useCallback((ids, statut) => {
    const idsSet = new Set(ids);
    if (!idsSet.size) return;
    updateCheptel((prev) => prev.map((m) => (idsSet.has(m.id)
      ? { ...m, statut, ...(statut === "Féconde" ? { amour: 100, endurance: 100, maturite: 100 } : {}) }
      : m)));
  }, [updateCheptel]);
  const restaurerMuldo = useCallback((id) => {
    setCorbeille((prev) => {
      const entree = prev.find((e) => e.muldo.id === id);
      if (!entree) return prev;
      updateCheptel((prevCheptel) => [...prevCheptel, entree.muldo]);
      const next = prev.filter((e) => e.muldo.id !== id);
      sauvegarderJSON(STORAGE_CORBEILLE_VOLKORNE, next);
      return next;
    });
  }, [updateCheptel]);
  const purgerCorbeilleEntree = useCallback((id) => {
    setCorbeille((prev) => {
      const next = prev.filter((e) => e.muldo.id !== id);
      sauvegarderJSON(STORAGE_CORBEILLE_VOLKORNE, next);
      return next;
    });
  }, []);
  const viderCorbeille = useCallback(() => {
    setCorbeille(() => {
      sauvegarderJSON(STORAGE_CORBEILLE_VOLKORNE, []);
      return [];
    });
  }, []);
  const addMuldo = useCallback((form) => {
    updateCheptel((prev) => [...prev, {
      id: crypto.randomUUID(), nom: form.nom || genererNomCourtVolkorne(form.couleur), couleur: form.couleur,
      generation: generationDeCouleurVolkorne(form.couleur), sexe: form.sexe, statut: form.statut, sterile: form.statut === "Stérile",
      reproRestantes: form.statut === "Stérile" ? 0 : 1, reproductionsRestantes: form.statut === "Stérile" ? 0 : 1,
      ...(form.statut === "Féconde" ? { amour: 100, endurance: 100, maturite: 100 } : { amour: 0, endurance: 0, maturite: 0 }),
      serenite: 50,
      dateAjout: new Date().toISOString(),
    }]);
  }, [updateCheptel]);

  const enregistrerHistorique = useCallback((updateurOuValeur) => {
    setHistoriqueCouleurs((prev) => {
      const next = typeof updateurOuValeur === "function" ? updateurOuValeur(prev) : updateurOuValeur;
      sauvegarderJSON(STORAGE_HISTORY_KEY_VOLKORNE, next);
      return next;
    });
  }, []);
  const basculerCouleurHistorique = useCallback((couleur, active) => {
    enregistrerHistorique((prev) => { const n = { ...prev }; if (active) n[couleur] = true; else delete n[couleur]; return n; });
  }, [enregistrerHistorique]);
  const validerGeneration = useCallback((generation) => {
    enregistrerHistorique((prev) => { const n = { ...prev }; (GENERATIONS_VOLKORNE[generation] || []).forEach((c) => { n[c] = true; }); return n; });
  }, [enregistrerHistorique]);

  const onFusion = useCallback((couleurChoisie, sexeChoisi, genealogieChoisie) => {
    if (!fusionA || !fusionB || fusionA === fusionB) return;
    const parentA = byId[fusionA];
    const parentB = byId[fusionB];
    if (!parentA || !parentB || generationDeCouleurVolkorne(parentA.couleur) !== generationDeCouleurVolkorne(parentB.couleur)) return;
    const couleurResultat = [parentA.couleur, parentB.couleur].includes(couleurChoisie) ? couleurChoisie : parentA.couleur;
    const sexeResultat = sexeChoisi === "M" ? "Mâle" : sexeChoisi === "F" ? "Femelle" : "Mâle";
    // Le bébé reprend la génétique d'UN seul parent : ses parents
    // généalogiques enregistrés deviennent les propres parents de celui-là
    // (les grands-parents du couple cloné), pas le couple lui-même.
    const parentGenealogie = genealogieChoisie === "B" ? parentB : parentA;
    // parentIds (parent réel dans le cheptel) ET parentsCouleurs (couleur
    // saisie à la main quand le parent n'est pas/plus dans le cheptel) sont
    // tous les deux à reporter.
    const parentsHerites = parentGenealogie.parentIds || [];
    const couleursHeritees = parentGenealogie.parentsCouleurs || [];
    updateCheptel((prev) => prev.filter((m) => m.id !== fusionA && m.id !== fusionB).concat({
      id: crypto.randomUUID(), nom: genererNomCourtVolkorne(couleurResultat), couleur: couleurResultat,
      generation: generationDeCouleurVolkorne(couleurResultat), sexe: sexeResultat, statut: "Fertile", sterile: false,
      reproRestantes: 1, reproductionsRestantes: 1, amour: 0, endurance: 0, maturite: 0, serenite: 50,
      parentIds: parentsHerites,
      parentsCouleurs: couleursHeritees,
    }));
    setFusionA(""); setFusionB("");
  }, [fusionA, fusionB, byId, updateCheptel]);

  // La naissance est immédiate et garantie, mais pas forcément le résultat de
  // la recette (le RNG du jeu peut retomber sur la couleur d'un parent ou
  // d'un ancêtre) : on confirme donc la couleur réellement obtenue avant de
  // stériliser les parents (voir confirmerNaissance) — realiserCouplesGps
  // (suivi de session GPS) se charge d'ouvrir la naissance à confirmer.

  const confirmerNaissance = useCallback((naissanceId, couleurChoisie, sexe) => {
    const n = naissances.find((x) => x.id === naissanceId);
    if (!n || !couleurChoisie || !sexe) return;
    const couleur = canonicaliserCouleurVolkorne(couleurChoisie);
    const nomCourt = genererNomCourtVolkorne(couleur);
    const bebe = {
      id: crypto.randomUUID(), nom: nomCourt, couleur,
      generation: generationDeCouleurVolkorne(couleur), sexe, statut: "Fertile", sterile: false,
      reproRestantes: 1, reproductionsRestantes: 1, amour: 0, endurance: 0, maturite: 0, serenite: 50,
      parentIds: [n.maleId, n.femelleId],
      dateAjout: new Date().toISOString(),
    };
    updateCheptel((prev) => [
      ...prev.map((m) => (m.id === n.maleId || m.id === n.femelleId)
        ? { ...m, reproDone: 1, reproMax: 1, reproRestantes: 0, reproductionsRestantes: 0, sterile: true, statut: "Stérile" }
        : m),
      bebe,
    ]);
    setNaissances((prev) => {
      const next = prev.filter((x) => x.id !== naissanceId);
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
      sauvegarderJSON(STORAGE_JOURNAL_VOLKORNE, next);
      return next;
    });
  }, [naissances, updateCheptel, persisterNaissances]);

  const supprimerNaissance = useCallback((naissanceId) => {
    setNaissances((prev) => {
      const next = prev.filter((x) => x.id !== naissanceId);
      persisterNaissances(next);
      return next;
    });
  }, [persisterNaissances]);

  return {
    cheptel, selectedId, setSelectedId, filter, setFilter, showNew, setShowNew, addMuldo, byId, historiqueCouleurs, journal, instantanes, naissances, corbeille,
    patchMuldo, deleteMuldo, deleteMuldos, marquerStatutMuldos,
    syncProps: { cheptel, updateCheptel },
    gpsProps: {
      session: sessionGps,
      mode: modeGps,
      setMode: setModeGps,
      objectif: objectifGpsActif,
      objectifCouleur: objectifGps,
      setObjectifCouleur: setObjectifGps,
      generationCible: generationGps,
      setGenerationCible: setGenerationGps,
      generationMin: generationCollectionMin,
      setGenerationMin: setGenerationCollectionMin,
      generationMax: generationCollectionMax,
      setGenerationMax: setGenerationCollectionMax,
      choixObjectif: choixObjectifGps,
      progressionGenerations: progressionGps,
      purification,
      setPurification,
      optimakina,
      setOptimakina,
      niveauMinimumSession,
      setNiveauMinimumSession,
      suivi: gpsSuiviActif,
      realiserCouplesGps,
      onAnnuler: annulerDernierCoupleGps,
      onReinitialiser: reinitialiserSessionGps,
      onDemarrerNouvelleSession: demarrerNouvelleSessionAccouplement,
      onNettoyerSterilesPuisDemarrer: nettoyerSterilesPuisDemarrerSession,
      journal,
    },
    clonageProps: { cheptel, fusionA, fusionB, setFusionA, setFusionB, onFusion, objectif: objectifGpsActif, journal },
    succesProps: { historiqueCouleurs, cheptel, onToggleCouleur: basculerCouleurHistorique, onValidateGeneration: validerGeneration, journal },
    naissancesProps: { naissances, onConfirmer: confirmerNaissance, onSupprimer: supprimerNaissance },
    corbeilleProps: { corbeille, onRestaurer: restaurerMuldo, onPurger: purgerCorbeilleEntree, onVider: viderCorbeille, dureeJours: CORBEILLE_DUREE_JOURS_VOLKORNE },
  };
}
