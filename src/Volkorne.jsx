// ============================================================
// Registre des Abysses — élevage de VOLKORNES
// Miroir volontairement dupliqué (pas de moteur partagé) du module muldo
// de App.jsx, adapté à la génétique et au vocabulaire volkorne. Voir
// C:\Users\Caly\.claude\plans\dazzling-painting-shamir.md pour le contexte.
// ============================================================
import React, { useState, useMemo, useCallback } from "react";
import { Trash2, Baby } from "lucide-react";
import { affectationMaximale, distanceLevenshtein, calculerGenerationCible, bonusProbabiliteGenerationCible } from "./geneticsUtils.js";

// ---------- Génétique : 15 couleurs monocolores, 105 bicolores (C(15,2)) ----------
// Générations des monocolores confirmées sur l'outil de croisement dofusdb.fr.
const MONOCOLORES_VOLKORNE_PAR_GENERATION = {
  1: ["Pourpre", "Orchidée", "Indigo", "Ébène"],
  3: ["Roux", "Amande", "Ivoire", "Turquoise"],
  5: ["Prune", "Émeraude"],
  7: ["Doré"],
  9: ["Jade", "Rubis", "Saphir", "Améthyste"],
};

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
const RECETTES_SPECIALES_VOLKORNE = {
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
function plierCouleurVolkorne(value) {
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
function couleurEstCanoniqueVolkorne(couleur) {
  return indexCouleursVolkorne().has(plierCouleurVolkorne(couleur));
}
export function canonicaliserCouleurVolkorne(brut) {
  const texte = String(brut || "").trim();
  if (!texte) return texte;
  const index = indexCouleursVolkorne();
  const plie = plierCouleurVolkorne(texte);
  const direct = index.get(plie);
  if (direct) return direct;
  const parties = plie.split(" et ").map((p) => p.trim()).filter(Boolean);
  if (parties.length === 2) {
    const [a, b] = parties;
    const endroit = index.get(`${a} et ${b}`) || index.get(`${b} et ${a}`);
    if (endroit) return endroit;
  }
  const flouEntier = correspondanceFloueVolkorne(plie, [...index.keys()]);
  if (flouEntier) return index.get(flouEntier);
  return texte;
}
function analyserTexteCaptureVolkorne(texte) {
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
      entrees.push({ couleur: canonicaliserCouleurVolkorne(matchInline[1].trim()), quantite: Number(matchInline[2]) });
      continue;
    }
    if (/^Volkorne/i.test(ligne)) {
      entrees.push({ couleur: canonicaliserCouleurVolkorne(ligne.replace(/^Volkorne\s+/i, "").trim()), quantite: null });
      continue;
    }
    if (/^[0-9OolI]+$/.test(ligne)) {
      quantitesEnBloc.push(Number(ligne.replace(/[oO]/g, "0").replace(/[lI]/g, "1")) || 0);
    }
  }
  let k = 0;
  entrees.forEach((e) => { if (e.quantite === null) { e.quantite = k < quantitesEnBloc.length ? quantitesEnBloc[k] : 0; k += 1; } });
  return entrees.map(({ couleur, quantite }) => ({
    couleur, reconnu: couleurEstCanoniqueVolkorne(couleur), male: 0, femelle: 0, inconnu: quantite, total: quantite,
  })).sort((a, b) => a.couleur.localeCompare(b.couleur, "fr"));
}

// ---------- Aides de domaine ----------
function sexeVolkorne(m) {
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
function volkorneReproductible(m) {
  if (!m) return false;
  const sterileBrut = String(m.sterile ?? "").toLowerCase();
  if (m.sterile === true || sterileBrut === "oui" || sterileBrut === "true" || sterileBrut.includes("st")) return false;
  const statut = String(m.statut ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (statut.startsWith("steril") || statut.startsWith("senile")) return false;
  return reproRestantesVolkorne(m) > 0;
}
function couleurPresenteCheptelVolkorne(cheptel, couleur) {
  return cheptel.some((m) => m.couleur === couleur);
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
function isBreedReadyVolkorne(m) { return getNextActionVolkorne(m).key === "pret"; }
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
function chercherCouplePourRecetteVolkorne(recette, cheptel, byId) {
  const [a, b] = recette;
  const candidatsA = cheptel.filter((m) => m.couleur === a && volkorneReproductible(m));
  const candidatsB = cheptel.filter((m) => m.couleur === b && volkorneReproductible(m));
  const couples = [];
  candidatsA.forEach((ma) => candidatsB.forEach((mb) => {
    if (ma.id === mb.id || sexeVolkorne(ma) === sexeVolkorne(mb)) return;
    const coll = collisionScoreVolkorne(ma, mb, byId);
    if (coll >= 99) return;
    const male = sexeVolkorne(ma) === "M" ? ma : mb;
    const femelle = sexeVolkorne(ma) === "F" ? ma : mb;
    const pretBonus = (isBreedReadyVolkorne(ma) ? 20 : 0) + (isBreedReadyVolkorne(mb) ? 20 : 0);
    const reproBonus = reproRestantesVolkorne(ma) + reproRestantesVolkorne(mb);
    couples.push({ male, femelle, parents: [ma, mb], collision: coll, score: pretBonus + reproBonus * 5 - coll * 30 });
  }));
  return couples.sort((x, y) => y.score - x.score)[0] || null;
}
function construirePlanPourCouleurVolkorne(couleur, cheptel, byId, historiqueCouleurs = {}, depth = 0, seen = new Set()) {
  const dejaPresente = couleurPresenteCheptelVolkorne(cheptel, couleur);
  const dejaDecouverte = Boolean(historiqueCouleurs[couleur]) || dejaPresente;
  if (depth > 8 || seen.has(couleur)) return { couleur, dejaPresente, dejaDecouverte, bloquee: true, etapes: [] };
  const recettes = recettesPourCouleurVolkorne(couleur);
  const options = recettes.map((recette) => {
    const couple = chercherCouplePourRecetteVolkorne(recette, cheptel, byId);
    const nouvelleCouleur = !dejaDecouverte;
    if (couple) {
      return {
        couleur, recette, couple, type: dejaPresente ? "renfort" : "creation", nouvelleCouleur,
        score: 10000 + (nouvelleCouleur ? 3000 : 0) + generationDeCouleurVolkorne(couleur) * 100 + couple.score,
        etapes: [{ couleur, recette, couple, nouvelleCouleur, faisableMaintenant: true }], bloquee: false,
      };
    }
    const nextSeen = new Set(seen); nextSeen.add(couleur);
    const sousPlans = recette.map((parent) => construirePlanPourCouleurVolkorne(parent, cheptel, byId, historiqueCouleurs, depth + 1, nextSeen));
    const etapes = sousPlans.flatMap((p) => p.etapes || []);
    const bloquee = etapes.length === 0;
    const nouvelles = etapes.filter((e) => e.nouvelleCouleur).length;
    return {
      couleur, recette, couple: null, type: "preparation", nouvelleCouleur, sousPlans, etapes, bloquee,
      score: (bloquee ? -10000 : 5000) + nouvelles * 2000 - etapes.length * 100 + generationDeCouleurVolkorne(couleur) * 50,
    };
  });
  return options.sort((a, b) => b.score - a.score)[0] || { couleur, recette: [], couple: null, type: "bloque", nouvelleCouleur: !dejaDecouverte, etapes: [], bloquee: true, score: -9999 };
}
function analyserGenerationCibleVolkorne(generation, cheptel, byId, historiqueCouleurs = {}) {
  const objectif = couleursGenerationJusquaVolkorne(generation);
  const possedees = objectif.filter((c) => couleurPresenteCheptelVolkorne(cheptel, c));
  const decouvertes = objectif.filter((c) => historiqueCouleurs[c] || couleurPresenteCheptelVolkorne(cheptel, c));
  const manquantes = objectif.filter((c) => !couleurPresenteCheptelVolkorne(cheptel, c));
  const jamaisDecouvertes = objectif.filter((c) => !(historiqueCouleurs[c] || couleurPresenteCheptelVolkorne(cheptel, c)));
  const plans = [];
  for (let g = Number(generation); g >= 2; g -= 1) {
    const couleurs = (GENERATIONS_VOLKORNE[g] || []).filter((c) => !couleurPresenteCheptelVolkorne(cheptel, c) || !(historiqueCouleurs[c] || couleurPresenteCheptelVolkorne(cheptel, c)));
    couleurs.forEach((couleur) => {
      const plan = construirePlanPourCouleurVolkorne(couleur, cheptel, byId, historiqueCouleurs);
      if (!plan.bloquee && plan.etapes.length > 0) {
        plans.push({ ...plan, generationVisee: g, actionImmediate: { ...plan.etapes[0], generation: generationDeCouleurVolkorne(plan.etapes[0].couleur), bloquee: false } });
      }
    });
    if (plans.length > 0) break;
  }
  const planChoisi = plans.sort((a, b) => b.score - a.score)[0] || null;
  return { generation, objectif, possedees, decouvertes, manquantes, jamaisDecouvertes, plans, planChoisi, actionImmediate: planChoisi?.actionImmediate || null, etapes: planChoisi?.etapes || [] };
}

function cleCoupleCouleurs(a, b) { return [a, b].sort((x, y) => x.localeCompare(y, "fr")).join("||| "); }
function toutesLesRecettesProgressionVolkorne() {
  const map = {};
  COULEURS_VOLKORNE.forEach((enfant) => {
    recettesPourCouleurVolkorne(enfant).forEach(([a, b]) => {
      const key = cleCoupleCouleurs(a, b);
      if (!map[key]) map[key] = [];
      if (!map[key].includes(enfant)) map[key].push(enfant);
    });
  });
  return map;
}
const RESULTATS_PAR_COUPLE_VOLKORNE = toutesLesRecettesProgressionVolkorne();
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
  const key = cleCoupleCouleurs(male.couleur, femelle.couleur);
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
  const { generationCible, viaAncetre } = calculerGenerationCible(male, femelle, byId, generationDeCouleurVolkorne);
  const generationBase = Math.max(generationDeCouleurVolkorne(male.couleur), generationDeCouleurVolkorne(femelle.couleur));
  score += (generationCible - generationBase) * 15;
  const chanceGenerationCible = bonusProbabiliteGenerationCible({ niveauA: Math.max(male.niveau || 0, niveauMinimum), niveauB: Math.max(femelle.niveau || 0, niveauMinimum), optimakina });
  return {
    score, raison, resultat: meilleurResultat, distance: meilleureDistance, chemin,
    generationCible, viaAncetre, chanceGenerationCible,
    couleursGenerationCible: GENERATIONS_VOLKORNE[generationCible] || [],
  };
}
function optimiserSessionAccouplementsVolkorne(cheptel, objectif, purification = false, optimakina = false, niveauMinimum = 0) {
  const fertiles = cheptel.filter(volkorneReproductible);
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
function teintesDeCouleurVolkorne(couleur) {
  return String(couleur).split(" et ").map((p) => PALETTE_VOLKORNE[foldKey(p.trim())] || "#8a7a63");
}
function slugCouleurVolkorne(couleur) { return foldKey(couleur).replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, ""); }
function VolkorneBadge({ couleur, taille = 22 }) {
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
function RechercheVolkorneDeroulante({ muldos, valeurId, onChoisir, placeholder, exclureId }) {
  const [recherche, setRecherche] = useState("");
  const [ferme, setFerme] = useState(true);
  const choisi = (muldos || []).find((m) => m.id === valeurId) || null;
  const prefixe = plierCouleurVolkorne(recherche.trim());
  const etiquette = (m) => `${m.nom || m.id?.slice(0, 6)} — ${m.couleur} ${sexeVolkorne(m) === "F" ? "♀" : sexeVolkorne(m) === "M" ? "♂" : "?"} · G${generationDeCouleurVolkorne(m.couleur)} · ${volkorneReproductible(m) ? "fertile" : "stérile"}`;
  const suggestions = (!ferme && prefixe)
    ? (muldos || []).filter((m) => m.id !== exclureId && (plierCouleurVolkorne(m.nom || "").startsWith(prefixe) || plierCouleurVolkorne(m.couleur || "").startsWith(prefixe))).slice(0, 60)
    : [];
  return (
    <div style={{ position: "relative", minWidth: 260 }}>
      <input className="field" placeholder={placeholder} value={recherche} onChange={(e) => { setRecherche(e.target.value); setFerme(false); }} style={{ width: "100%", padding: "6px 10px", fontSize: 13 }} />
      {choisi && <div style={{ color: "var(--gold)", fontSize: 12, marginTop: 4 }}>→ {etiquette(choisi)}</div>}
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

function VolkorneMiniCard({ m, selected, onClick }) {
  const sterile = !volkorneReproductible(m);
  return (
    <div onClick={onClick} className="panel-card" style={{ padding: 10, marginBottom: 8, cursor: "pointer", border: selected ? "1px solid var(--gold)" : sterile ? "1px solid rgba(232,137,106,.4)" : "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {sexeVolkorne(m) === "F" ? "♀" : sexeVolkorne(m) === "M" ? "♂" : "?"} <VolkorneBadge couleur={m.couleur} taille={16} /> {m.nom || m.couleur}
        </span>
        <span className="pill" style={{ fontSize: 11 }}>G{generationDeCouleurVolkorne(m.couleur)}</span>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>{m.statut} · {sterile ? "stérile" : "1 reproduction"}</div>
    </div>
  );
}

function VolkorneDetail({ m, byId, onPatch, onDelete }) {
  const action = getNextActionVolkorne(m);
  const partners = useMemo(() => geneticPartnersVolkorne(m, Object.values(byId), byId), [m, byId]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{m.nom || m.couleur}</h3>
        <button className="btn btn-ghost" onClick={onDelete}><Trash2 size={13} /> Retirer</button>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Génération {generationDeCouleurVolkorne(m.couleur)} · {m.couleur}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Sexe
          <select className="field" value={m.sexe || ""} onChange={(e) => onPatch({ sexe: e.target.value })}>
            <option value="">?</option><option value="Mâle">Mâle</option><option value="Femelle">Femelle</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Statut
          <select className="field" value={m.sterile ? "Stérile" : "Fertile"} onChange={(e) => onPatch({ sterile: e.target.value === "Stérile", statut: e.target.value })}>
            <option value="Fertile">Fertile</option><option value="Stérile">Stérile</option>
          </select>
        </label>
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
      <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: `1px solid ${action.color}`, background: "rgba(0,0,0,.12)" }}>
        <b style={{ color: action.color }}>{action.label}</b>
        <div style={{ fontSize: 12, marginTop: 4 }}>Objet : {action.objet}</div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{action.detail}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        {["amour", "endurance", "maturite", "serenite"].map((cle) => (
          <label key={cle} style={{ fontSize: 11, color: "var(--muted)", textTransform: "capitalize" }}>{cle}
            <input type="range" min={0} max={100} value={Number(m[cle]) || 0} onChange={(e) => onPatch({ [cle]: Number(e.target.value) })} style={{ width: "100%" }} />
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

function NewVolkorneModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ nom: "", couleur: COULEURS_VOLKORNE[0], sexe: "Femelle", statut: "Fertile" });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,8,6,.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="panel-card" style={{ width: "min(420px,92vw)" }}>
        <h3 style={{ marginTop: 0 }}>Nouveau volkorne</h3>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Nom
          <input className="field" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Optionnel" />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 8 }}>Couleur
          <select className="field" value={form.couleur} onChange={(e) => setForm({ ...form, couleur: e.target.value })}>
            {COULEURS_VOLKORNE.map((c) => <option key={c} value={c}>{c} (G{generationDeCouleurVolkorne(c)})</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 8 }}>Sexe
          <select className="field" value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
            <option value="Femelle">Femelle</option><option value="Mâle">Mâle</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn btn-coral" onClick={() => { onCreate(form); onClose(); }}>Ajouter</button>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Pages exportées ----------
export function VolkorneCheptelListPane({ cheptel, filter, setFilter, selectedId, onSelect }) {
  const filtres = useMemo(() => {
    const p = plierCouleurVolkorne(filter);
    if (!p) return cheptel;
    return cheptel.filter((m) => plierCouleurVolkorne(m.nom || "").includes(p) || plierCouleurVolkorne(m.couleur || "").includes(p));
  }, [cheptel, filter]);
  return (
    <div className="tech-column">
      <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
        <input className="field" placeholder="Rechercher un volkorne…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
        {filtres.map((m) => <VolkorneMiniCard key={m.id} m={m} selected={selectedId === m.id} onClick={() => onSelect(m.id)} />)}
      </div>
    </div>
  );
}

export function VolkorneCheptelMainPane({ cheptel, selectedId, setSelectedId, byId, onPatch, onDelete, showNew, setShowNew, onCreate }) {
  const selected = selectedId ? byId[selectedId] : null;
  return (
    <>
      <div className="cheptel-layout">
        <div className="cheptel-liste">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>Cheptel Volkorne</h1>
            <button className="btn btn-coral" onClick={() => setShowNew(true)}>+ Nouveau volkorne</button>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{cheptel.length} volkorne(s) enregistré(s).</div>
        </div>
        {selected && <div className="cheptel-backdrop" onClick={() => setSelectedId(null)} />}
        {selected && (
          <div className="cheptel-detail">
            <div className="cheptel-detail-barre">
              <span style={{ fontWeight: 700, fontSize: 13 }}><VolkorneBadge couleur={selected.couleur} taille={18} /> {selected.nom || selected.couleur}</span>
              <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setSelectedId(null)}>✕ Fermer</button>
            </div>
            <div className="cheptel-detail-corps">
              <VolkorneDetail m={selected} byId={byId} onPatch={(p) => onPatch(selected.id, p)} onDelete={() => onDelete(selected.id)} />
            </div>
          </div>
        )}
      </div>
      {showNew && <NewVolkorneModal onClose={() => setShowNew(false)} onCreate={onCreate} />}
    </>
  );
}

export function VolkorneSynchronisationPage({ cheptel, updateCheptel, showToast }) {
  const [texte, setTexte] = useState("");
  const analyse = useMemo(() => analyserTexteCaptureVolkorne(texte), [texte]);
  const importer = () => {
    let index = 1;
    const nouveaux = [];
    analyse.forEach((ligne) => {
      for (let i = 0; i < (ligne.total || 0); i += 1) {
        nouveaux.push({
          id: crypto.randomUUID(), nom: `${ligne.couleur} #${index}`, couleur: ligne.couleur,
          generation: generationDeCouleurVolkorne(ligne.couleur), sexe: i % 2 === 0 ? "Mâle" : "Femelle",
          statut: "Fertile", sterile: false, reproRestantes: 1, reproductionsRestantes: 1,
          amour: 100, endurance: 100, maturite: 100, serenite: 50,
          note: "Créé automatiquement depuis le screen du cheptel volkorne.",
        });
        index += 1;
      }
    });
    updateCheptel((prev) => [...prev, ...nouveaux]);
    showToast(`${nouveaux.length} volkorne(s) importé(s) depuis la capture.`);
    setTexte("");
  };
  return (
    <div className="panel-card">
      <h2 style={{ marginTop: 0 }}>Synchronisation Volkorne</h2>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
        Colle ici le texte OCR de ta capture (filtre de recherche "Volkorne" en jeu), exemple :<br />
        Volkorne Pourpre 15<br />Volkorne Orchidée 9
      </div>
      <textarea className="field" rows={8} value={texte} onChange={(e) => setTexte(e.target.value)} style={{ width: "100%", resize: "vertical" }} />
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
        {analyse.length} couleur(s) détectée(s) · {analyse.filter((a) => a.reconnu).length} reconnue(s)
      </div>
      {analyse.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {analyse.map((a) => (
            <div key={a.couleur} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: a.reconnu ? "inherit" : "#e8896a" }}>
              <span><VolkorneBadge couleur={a.couleur} taille={14} /> {a.couleur}{!a.reconnu && " (non reconnu)"}</span>
              <span>{a.total}</span>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-coral" style={{ marginTop: 12 }} disabled={!analyse.length} onClick={importer}>Importer dans le cheptel</button>
    </div>
  );
}

export function VolkorneGpsPage({ cheptel, objectif, setObjectif, generationCible, setGenerationCible, purification, setPurification, byId, historiqueCouleurs, onRealiserUn }) {
  const [optimakina, setOptimakina] = useState(false);
  const [niveauMinimumSession, setNiveauMinimumSession] = useState(0);
  const session = useMemo(() => optimiserSessionAccouplementsVolkorne(cheptel, objectif, purification, optimakina, niveauMinimumSession), [cheptel, objectif, purification, optimakina, niveauMinimumSession]);
  const planGeneration = useMemo(() => analyserGenerationCibleVolkorne(generationCible, cheptel, byId, historiqueCouleurs), [generationCible, cheptel, byId, historiqueCouleurs]);
  return (
    <div>
      <h1 style={{ fontSize: 28 }}>GPS Volkorne</h1>
      <div className="panel-card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Couleur objectif
            <select className="field" value={objectif} onChange={(e) => setObjectif(e.target.value)}>
              {COULEURS_VOLKORNE.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Génération à compléter
            <select className="field" value={generationCible} onChange={(e) => setGenerationCible(Number(e.target.value))}>
              {Object.keys(GENERATIONS_VOLKORNE).map((g) => <option key={g} value={g}>Génération {g}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            <input type="checkbox" checked={purification} onChange={(e) => setPurification(e.target.checked)} /> Mode purification
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            <input type="checkbox" checked={optimakina} onChange={(e) => setOptimakina(e.target.checked)} /> Optimakina utilisée
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            Niveau mini (session)
            <input
              type="number" className="field" min={0} max={200} style={{ width: 70 }}
              value={niveauMinimumSession || ""} placeholder="0"
              title="Suppose que toutes tes montures sont au moins à ce niveau, sans le saisir sur chaque fiche"
              onChange={(e) => setNiveauMinimumSession(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </label>
        </div>
        {planGeneration.actionImmediate && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,.16)", border: "1px solid var(--line)" }}>
            Action immédiate recommandée pour la génération {generationCible} :{" "}
            <b>{planGeneration.actionImmediate.couleur}</b>{" "}
            {planGeneration.actionImmediate.couple && (
              <>— couple trouvé : ♂ {planGeneration.actionImmediate.couple.male.nom} × ♀ {planGeneration.actionImmediate.couple.femelle.nom}</>
            )}
          </div>
        )}
      </div>
      <div className="panel-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <b>{session.groupes.length} couples proposés</b>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>{session.utilises} / {session.totalFertiles} volkornes utilisés</span>
        </div>
        {session.raisonRestants && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>{session.raisonRestants}</div>}
        {session.groupes.map((g) => (
          <div key={g.key} style={{ padding: "10px 0", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span>
              <b>× {g.quantite}</b>{" "}
              ♂ <VolkorneBadge couleur={g.male.couleur} taille={16} /> <b>{g.male.nom || g.male.couleur}</b>
              {" × "}
              ♀ <VolkorneBadge couleur={g.femelle.couleur} taille={16} /> <b>{g.femelle.nom || g.femelle.couleur}</b>
            </span>
            <span style={{ color: "var(--muted)", fontSize: 12, flex: 1, minWidth: 200 }}>
              {g.raison}
              {g.generationCible && (
                <div>🎯 Génération cible : G{g.generationCible} (~{g.chanceGenerationCible}% de chance) · couleurs possibles : {(g.couleursGenerationCible || []).join(", ") || "—"}</div>
              )}
            </span>
            <button className="btn btn-coral" onClick={() => onRealiserUn(g)}>✓ 1 réalisé</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function suggererClonagesVolkorne(cheptel) {
  const candidats = (cheptel || []).filter((m) => !volkorneReproductible(m));
  const parGen = new Map();
  candidats.forEach((m) => {
    const g = generationDeCouleurVolkorne(m.couleur);
    if (!parGen.has(g)) parGen.set(g, []);
    parGen.get(g).push(m);
  });
  const paires = [];
  parGen.forEach((membres) => {
    for (let i = 0; i < membres.length; i += 1) for (let j = i + 1; j < membres.length; j += 1) paires.push({ a: membres[i], b: membres[j] });
  });
  return paires.slice(0, 6);
}

export function VolkorneClonagePage({ cheptel, fusionA, fusionB, setFusionA, setFusionB, onFusion }) {
  const [choix, setChoix] = useState({ couleur: null, sexe: null });
  const A = cheptel.find((m) => m.id === fusionA) || null;
  const B = cheptel.find((m) => m.id === fusionB) || null;
  const genA = A ? generationDeCouleurVolkorne(A.couleur) : null;
  const genB = B ? generationDeCouleurVolkorne(B.couleur) : null;
  const memeGeneration = A && B && genA === genB;
  const candidatsSteriles = useMemo(() => cheptel.filter((m) => !volkorneReproductible(m)), [cheptel]);
  const suggestions = useMemo(() => suggererClonagesVolkorne(cheptel), [cheptel]);
  const sexeA = A ? sexeVolkorne(A) : null;
  const sexeB = B ? sexeVolkorne(B) : null;
  const sexeImpose = sexeA && sexeA === sexeB ? sexeA : null;
  const sexeChoisi = sexeImpose || choix.sexe;
  return (
    <div>
      <div className="panel-card">
        <h2 style={{ marginTop: 0 }}>Clonage des volkornes stériles</h2>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
          Deux volkornes stériles de même génération sont détruits pour créer un nouveau volkorne fertile.
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <RechercheVolkorneDeroulante muldos={candidatsSteriles} valeurId={fusionA} exclureId={fusionB} onChoisir={setFusionA} placeholder="Volkorne A…" />
          <span style={{ color: "var(--gold2)", fontSize: 20, alignSelf: "center" }}>+</span>
          <RechercheVolkorneDeroulante muldos={candidatsSteriles} valeurId={fusionB} exclureId={fusionA} onChoisir={setFusionB} placeholder="Volkorne B…" />
        </div>
      </div>
      <div className="panel-card" style={{ marginTop: 16 }}>
        <b>Résultat du clonage</b>
        {!A || !B ? <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>Choisis deux volkornes stériles.</div>
        : !memeGeneration ? <div style={{ color: "#e8896a", fontSize: 13, marginTop: 8 }}>⚠ Générations différentes.</div>
        : (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {[...new Set([A.couleur, B.couleur])].map((c) => (
                <button key={c} className="pill" style={{ border: choix.couleur === c ? "1px solid var(--gold)" : "1px solid transparent", cursor: "pointer", background: "none" }} onClick={() => setChoix((p) => ({ ...p, couleur: c }))}>{c}</button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              {sexeImpose ? <span className="pill">{sexeImpose === "M" ? "♂ Mâle" : "♀ Femelle"} — imposé</span> : (
                <>
                  <button className="btn btn-ghost" style={choix.sexe === "M" ? { borderColor: "var(--gold)" } : undefined} onClick={() => setChoix((p) => ({ ...p, sexe: "M" }))}>♂ Mâle</button>
                  <button className="btn btn-ghost" style={choix.sexe === "F" ? { borderColor: "var(--gold)" } : undefined} onClick={() => setChoix((p) => ({ ...p, sexe: "F" }))}>♀ Femelle</button>
                </>
              )}
            </div>
            <button className="btn btn-coral" style={{ marginTop: 12 }} disabled={!((A.couleur === B.couleur || choix.couleur) && sexeChoisi)}
              onClick={() => { onFusion(A.couleur === B.couleur ? A.couleur : choix.couleur, sexeChoisi); setChoix({ couleur: null, sexe: null }); }}>
              Cloner
            </button>
          </div>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="panel-card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Clonages suggérés</h2>
          {suggestions.map((s) => (
            <div key={`${s.a.id}|${s.b.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.06)" }}>
              <span><VolkorneBadge couleur={s.a.couleur} taille={16} /> {s.a.nom} + <VolkorneBadge couleur={s.b.couleur} taille={16} /> {s.b.nom}</span>
              <button className="btn btn-ghost" onClick={() => { setFusionA(s.a.id); setFusionB(s.b.id); }}>Choisir ce duo</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VolkorneSuccesPage({ historiqueCouleurs, cheptel, onToggleCouleur, onValidateGeneration }) {
  const presentes = new Set(cheptel.map((m) => m.couleur));
  const seen = (c) => Boolean(historiqueCouleurs[c]) || presentes.has(c);
  return (
    <div>
      <h1 style={{ fontSize: 28 }}>Succès Volkorne</h1>
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
export const CLES_SAUVEGARDE_VOLKORNE = [STORAGE_KEY_VOLKORNE, STORAGE_HISTORY_KEY_VOLKORNE, STORAGE_JOURNAL_VOLKORNE];

function chargerJSON(cle, defaut) {
  try { const v = JSON.parse(localStorage.getItem(cle)); return v ?? defaut; } catch (e) { return defaut; }
}

export function useVolkorneElevage() {
  const [cheptel, setCheptel] = useState(() => chargerJSON(STORAGE_KEY_VOLKORNE, []));
  const [historiqueCouleurs, setHistoriqueCouleurs] = useState(() => chargerJSON(STORAGE_HISTORY_KEY_VOLKORNE, {}));
  const [journal, setJournal] = useState(() => chargerJSON(STORAGE_JOURNAL_VOLKORNE, []));
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [fusionA, setFusionA] = useState("");
  const [fusionB, setFusionB] = useState("");
  const [objectifGps, setObjectifGps] = useState("Ébène");
  const [generationCibleGps, setGenerationCibleGps] = useState(3);
  const [purification, setPurification] = useState(false);

  const byId = useMemo(() => Object.fromEntries(cheptel.map((m) => [m.id, m])), [cheptel]);

  const updateCheptel = useCallback((updater) => {
    setCheptel((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem(STORAGE_KEY_VOLKORNE, JSON.stringify(next));
      return next;
    });
  }, []);

  const patchMuldo = useCallback((id, patch) => updateCheptel((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))), [updateCheptel]);
  const deleteMuldo = useCallback((id) => {
    updateCheptel((prev) => prev.filter((m) => m.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, [updateCheptel]);
  const addMuldo = useCallback((form) => {
    updateCheptel((prev) => [...prev, {
      id: crypto.randomUUID(), nom: form.nom || genererNomCourtVolkorne(form.couleur), couleur: form.couleur,
      generation: generationDeCouleurVolkorne(form.couleur), sexe: form.sexe, statut: form.statut, sterile: form.statut === "Stérile",
      reproRestantes: form.statut === "Stérile" ? 0 : 1, reproductionsRestantes: form.statut === "Stérile" ? 0 : 1,
      amour: 0, endurance: 0, maturite: 0, serenite: 50,
    }]);
  }, [updateCheptel]);

  const enregistrerHistorique = useCallback((next) => {
    setHistoriqueCouleurs(next);
    localStorage.setItem(STORAGE_HISTORY_KEY_VOLKORNE, JSON.stringify(next));
  }, []);
  const basculerCouleurHistorique = useCallback((couleur, active) => {
    enregistrerHistorique((prev) => { const n = { ...prev }; if (active) n[couleur] = true; else delete n[couleur]; return n; });
  }, [enregistrerHistorique]);
  const validerGeneration = useCallback((generation) => {
    enregistrerHistorique((prev) => { const n = { ...prev }; (GENERATIONS_VOLKORNE[generation] || []).forEach((c) => { n[c] = true; }); return n; });
  }, [enregistrerHistorique]);

  const onFusion = useCallback((couleurChoisie, sexeChoisi) => {
    if (!fusionA || !fusionB || fusionA === fusionB) return;
    const parentA = byId[fusionA];
    const parentB = byId[fusionB];
    if (!parentA || !parentB || generationDeCouleurVolkorne(parentA.couleur) !== generationDeCouleurVolkorne(parentB.couleur)) return;
    const couleurResultat = [parentA.couleur, parentB.couleur].includes(couleurChoisie) ? couleurChoisie : parentA.couleur;
    const sexeResultat = sexeChoisi === "M" ? "Mâle" : sexeChoisi === "F" ? "Femelle" : "Mâle";
    updateCheptel((prev) => prev.filter((m) => m.id !== fusionA && m.id !== fusionB).concat({
      id: crypto.randomUUID(), nom: genererNomCourtVolkorne(couleurResultat), couleur: couleurResultat,
      generation: generationDeCouleurVolkorne(couleurResultat), sexe: sexeResultat, statut: "Fertile", sterile: false,
      reproRestantes: 1, reproductionsRestantes: 1, amour: 0, endurance: 0, maturite: 0, serenite: 50,
    }));
    setFusionA(""); setFusionB("");
  }, [fusionA, fusionB, byId, updateCheptel]);

  const onRealiserUn = useCallback((groupe) => {
    const couple = groupe.couples[0];
    if (!couple) return;
    const resultat = couple.resultat || couple.male.couleur;
    const sexeResultat = Math.random() < 0.5 ? "Mâle" : "Femelle";
    const bebe = {
      id: crypto.randomUUID(), nom: genererNomCourtVolkorne(resultat), couleur: resultat,
      generation: generationDeCouleurVolkorne(resultat), sexe: sexeResultat, statut: "Fertile", sterile: false,
      reproRestantes: 1, reproductionsRestantes: 1, amour: 0, endurance: 0, maturite: 0, serenite: 50,
      parentIds: [couple.male.id, couple.femelle.id],
    };
    updateCheptel((prev) => prev.map((m) => {
      if (m.id === couple.male.id || m.id === couple.femelle.id) return { ...m, reproRestantes: Math.max(0, reproRestantesVolkorne(m) - 1), reproductionsRestantes: Math.max(0, reproRestantesVolkorne(m) - 1) };
      return m;
    }).concat(bebe));
    setJournal((prev) => {
      const next = [{ date: new Date().toISOString(), couleur: resultat, nom: bebe.nom }, ...prev].slice(0, 200);
      localStorage.setItem(STORAGE_JOURNAL_VOLKORNE, JSON.stringify(next));
      return next;
    });
  }, [updateCheptel]);

  return {
    cheptel, selectedId, setSelectedId, filter, setFilter, showNew, setShowNew, byId, historiqueCouleurs, journal,
    cheptelListProps: { cheptel, filter, setFilter, selectedId, onSelect: setSelectedId },
    cheptelMainProps: { cheptel, selectedId, setSelectedId, byId, onPatch: patchMuldo, onDelete: deleteMuldo, showNew, setShowNew, onCreate: addMuldo },
    syncProps: { cheptel, updateCheptel },
    gpsProps: { cheptel, objectif: objectifGps, setObjectif: setObjectifGps, generationCible: generationCibleGps, setGenerationCible: setGenerationCibleGps, purification, setPurification, byId, historiqueCouleurs, onRealiserUn },
    clonageProps: { cheptel, fusionA, fusionB, setFusionA, setFusionB, onFusion },
    succesProps: { historiqueCouleurs, cheptel, onToggleCouleur: basculerCouleurHistorique, onValidateGeneration: validerGeneration },
  };
}
