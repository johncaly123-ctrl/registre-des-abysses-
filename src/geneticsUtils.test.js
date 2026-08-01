import { describe, it, expect } from "vitest";
import { calculerGenerationCible, bonusProbabiliteGenerationCible, couleursCandidatesAccouplement, repartitionProbabilitesAccouplement } from "./geneticsUtils.js";

// Table de générations synthétique, indépendante de toute vraie créature —
// on teste ici uniquement l'algorithme générique de génération cible.
const generationDeCouleurTest = (couleur) => ({ A1: 1, B1: 1, D5: 5 }[couleur] ?? 1);

describe("calculerGenerationCible", () => {
  it("cible = max(générations des parents) + 1 quand aucun ancêtre plus haut n'est connu", () => {
    const a = { id: "a", couleur: "A1", parentIds: [] };
    const b = { id: "b", couleur: "B1", parentIds: [] };
    const { generationCible, viaAncetre } = calculerGenerationCible(a, b, { a, b }, generationDeCouleurTest);
    expect(generationCible).toBe(2);
    expect(viaAncetre).toBe(false);
  });

  it("cible = génération de l'ancêtre le plus haut quand un grand-parent la dépasse", () => {
    const gp = { id: "gp", couleur: "D5", parentIds: [] };
    const p = { id: "p", couleur: "A1", parentIds: ["gp"] };
    const a = { id: "a", couleur: "A1", parentIds: ["p"] };
    const b = { id: "b", couleur: "B1", parentIds: [] };
    const byId = { gp, p, a, b };
    const { generationCible, viaAncetre } = calculerGenerationCible(a, b, byId, generationDeCouleurTest);
    expect(generationCible).toBe(5);
    expect(viaAncetre).toBe(true);
  });

  it("ignore les ancêtres au-delà des grands-parents (l'arbre du jeu s'arrête là)", () => {
    const agp = { id: "agp", couleur: "D5", parentIds: [] }; // arrière-grand-parent
    const gp = { id: "gp", couleur: "A1", parentIds: ["agp"] };
    const p = { id: "p", couleur: "A1", parentIds: ["gp"] };
    const a = { id: "a", couleur: "A1", parentIds: ["p"] };
    const b = { id: "b", couleur: "B1", parentIds: [] };
    const byId = { agp, gp, p, a, b };
    const { generationCible, viaAncetre } = calculerGenerationCible(a, b, byId, generationDeCouleurTest);
    expect(generationCible).toBe(2); // pas 5 : l'arrière-grand-parent est hors profondeur
    expect(viaAncetre).toBe(false);
  });

  it("gère l'absence de généalogie (monture capturée)", () => {
    const a = { id: "a", couleur: "A1" };
    const b = { id: "b", couleur: "B1" };
    const { generationCible } = calculerGenerationCible(a, b, {}, generationDeCouleurTest);
    expect(generationCible).toBe(2);
  });
});

describe("bonusProbabiliteGenerationCible", () => {
  it("30% de base sans niveau ni Optimakina", () => {
    expect(bonusProbabiliteGenerationCible({})).toBe(30);
  });

  it("ajoute 0.15% par niveau cumulé des deux parents", () => {
    expect(bonusProbabiliteGenerationCible({ niveauA: 200, niveauB: 200 })).toBe(90);
  });

  it("ajoute 10% avec Optimakina", () => {
    expect(bonusProbabiliteGenerationCible({ optimakina: true })).toBe(40);
  });

  it("plafonne à 100%", () => {
    expect(bonusProbabiliteGenerationCible({ niveauA: 200, niveauB: 200, optimakina: true })).toBe(100);
  });

  it("ignore les niveaux non renseignés (null)", () => {
    expect(bonusProbabiliteGenerationCible({ niveauA: null, niveauB: null })).toBe(30);
  });

  it("reproduit exactement les 6 accouplements observés en jeu (2026-07-25)", () => {
    // Les 4 premiers ont été réalisés avec une Makina (Optimakina) active.
    // Doré et Amande (niv 62) x Roux et Pourpre (niv 64), Makina -> Turquoise 58,9%
    expect(bonusProbabiliteGenerationCible({ niveauA: 62, niveauB: 64, optimakina: true })).toBeCloseTo(58.9, 1);
    // Turquoise (niv 70) x Indigo (niv 53), Makina -> Turquoise et Indigo 58,45%
    expect(bonusProbabiliteGenerationCible({ niveauA: 70, niveauB: 53, optimakina: true })).toBeCloseTo(58.45, 1);
    // Orchidée (niv 54) x Turquoise (niv 65), Makina -> Turquoise et Orchidée 57,85%
    expect(bonusProbabiliteGenerationCible({ niveauA: 54, niveauB: 65, optimakina: true })).toBeCloseTo(57.85, 1);
    // Doré et Indigo (niv 67) x Doré et Ébène (niv 62), Makina -> Roux 59,35%
    expect(bonusProbabiliteGenerationCible({ niveauA: 67, niveauB: 62, optimakina: true })).toBeCloseTo(59.35, 1);
    // Ébène (niv 64) x Orchidée (niv 57), sans Makina -> Ébène et Orchidée 48,15%
    expect(bonusProbabiliteGenerationCible({ niveauA: 64, niveauB: 57 })).toBeCloseTo(48.15, 1);
    // Orchidée (niv 54) x Doré (niv 65), sans Makina -> Doré et Orchidée 47,85%
    expect(bonusProbabiliteGenerationCible({ niveauA: 54, niveauB: 65 })).toBeCloseTo(47.85, 1);
  });
});

describe("couleursCandidatesAccouplement", () => {
  // Table de générations réduite, mêmes noms que le vrai jeu muldo — reproduit
  // exactement 3 couples capturés in-game (2026-07-31) pour vérifier que la
  // dérivation des couleurs candidates colle aux vraies couleurs affichées
  // dans "Génération cible" / "Autres" (pas seulement leur nombre).
  const GEN = {
    1: ["Ébène", "Pourpre", "Orchidée", "Indigo"],
    2: ["Ébène et Pourpre", "Ébène et Orchidée", "Ébène et Indigo", "Orchidée et Pourpre", "Indigo et Orchidée"],
    3: ["Roux", "Amande"],
    4: ["Roux et Pourpre", "Roux et Amande", "Roux et Indigo", "Ébène et Amande", "Indigo et Amande", "Roux et Ébène", "Orchidée et Amande"],
  };
  const generationDeCouleurTest = (c) => {
    for (const [gen, couleurs] of Object.entries(GEN)) if (couleurs.includes(c)) return Number(gen);
    return 1;
  };
  const combiner = (ca, cb) => {
    if (!ca || !cb || ca === cb) return null;
    const nom1 = `${ca} et ${cb}`, nom2 = `${cb} et ${ca}`;
    for (const couleurs of Object.values(GEN)) {
      if (couleurs.includes(nom1)) return nom1;
      if (couleurs.includes(nom2)) return nom2;
    }
    return null;
  };

  it("couple sans généalogie connue : une seule cible (combo direct), repli = les 2 couleurs seules", () => {
    const a = { couleur: "Ébène", parentIds: [] };
    const b = { couleur: "Pourpre", parentIds: [] };
    const { generationCible, couleursCible, couleursAutres } =
      couleursCandidatesAccouplement(a, b, {}, generationDeCouleurTest, combiner);
    expect(generationCible).toBe(2);
    expect(couleursCible).toEqual(["Ébène et Pourpre"]);
    expect(couleursAutres.sort()).toEqual(["Ébène", "Pourpre"].sort());
  });

  it("un seul côté a 2 ancêtres connus : cible multiple (combos + couleur propre si assez haute)", () => {
    // Reproduit la capture "Ébène x Orchidée et Pourpre" (2026-07-31) : 3 cibles GEN.2.
    const orchidee = { id: "o", couleur: "Orchidée", parentIds: [] };
    const pourpre = { id: "p", couleur: "Pourpre", parentIds: [] };
    const mere = { id: "m", couleur: "Orchidée et Pourpre", parentIds: ["o", "p"] };
    const byId = { o: orchidee, p: pourpre, m: mere };
    const male = { couleur: "Ébène", parentIds: [] };
    const { generationCible, couleursCible, couleursAutres } =
      couleursCandidatesAccouplement(male, mere, byId, generationDeCouleurTest, combiner);
    expect(generationCible).toBe(2);
    expect(couleursCible.sort()).toEqual(["Ébène et Orchidée", "Ébène et Pourpre", "Orchidée et Pourpre"].sort());
    expect(couleursAutres.sort()).toEqual(["Ébène", "Orchidée", "Pourpre"].sort());
  });

  it("ancêtres connus des deux côtés : un combo croisé sous la cible part en Autres, pas en cible", () => {
    // Reproduit "Indigo et Amande x Roux et Pourpre" (2026-07-31) : 5 cibles GEN.4,
    // et "Ébène et Indigo" (combo croisé qui ne monte qu'à GEN.2) en Autres.
    const amande = { id: "am", couleur: "Amande", parentIds: [] };
    const indigo = { id: "in", couleur: "Indigo", parentIds: [] };
    const femelle = { id: "f", couleur: "Indigo et Amande", parentIds: ["am", "in"] };
    const roux = { id: "ro", couleur: "Roux", parentIds: [] };
    const ebene = { id: "eb", couleur: "Ébène", parentIds: [] };
    const male = { id: "mm", couleur: "Roux et Pourpre", parentIds: ["ro", "eb"] };
    const byId = { am: amande, in: indigo, f: femelle, ro: roux, eb: ebene, mm: male };
    const { generationCible, couleursCible, couleursAutres } =
      couleursCandidatesAccouplement(male, femelle, byId, generationDeCouleurTest, combiner);
    expect(generationCible).toBe(4);
    expect(couleursCible.sort()).toEqual(
      ["Roux et Pourpre", "Indigo et Amande", "Roux et Amande", "Roux et Indigo", "Ébène et Amande"].sort()
    );
    expect(couleursAutres).toContain("Ébène et Indigo");
    expect(couleursCible).not.toContain("Ébène et Indigo");
  });
});

describe("repartitionProbabilitesAccouplement", () => {
  // Formule postée par un joueur (non officielle), vérifiée exactement le
  // 2026-08-01 contre 7 captures réelles en jeu (44 points de données,
  // écart max 0.008 point de %). Les 2 cas ci-dessous reprennent 2 de ces
  // captures telles quelles (mêmes couples que les tests
  // couleursCandidatesAccouplement ci-dessus, mêmes % cible connus).
  const GEN = {
    1: ["Ébène", "Pourpre", "Orchidée", "Indigo"],
    2: ["Ébène et Pourpre", "Ébène et Orchidée", "Ébène et Indigo", "Orchidée et Pourpre", "Indigo et Orchidée"],
    3: ["Roux", "Amande"],
    4: ["Roux et Pourpre", "Roux et Amande", "Roux et Indigo", "Ébène et Amande", "Indigo et Amande", "Roux et Ébène", "Orchidée et Amande"],
  };
  const generationDeCouleurTest = (c) => {
    for (const [gen, couleurs] of Object.entries(GEN)) if (couleurs.includes(c)) return Number(gen);
    return 1;
  };
  const combiner = (ca, cb) => {
    if (!ca || !cb || ca === cb) return null;
    const nom1 = `${ca} et ${cb}`, nom2 = `${cb} et ${ca}`;
    for (const couleurs of Object.values(GEN)) {
      if (couleurs.includes(nom1)) return nom1;
      if (couleurs.includes(nom2)) return nom2;
    }
    return null;
  };

  it("couple sans généalogie connue : 47.25% sur le combo, 26.38%/26.38% en repli", () => {
    const a = { couleur: "Ébène", parentIds: [] };
    const b = { couleur: "Pourpre", parentIds: [] };
    const repartition = repartitionProbabilitesAccouplement(a, b, {}, generationDeCouleurTest, combiner, 2, 47.25);
    expect(repartition["Ébène et Pourpre"]).toBeCloseTo(47.25, 1);
    expect(repartition["Ébène"]).toBeCloseTo(26.38, 1);
    expect(repartition["Pourpre"]).toBeCloseTo(26.38, 1);
  });

  it("ancêtres connus des deux côtés (5 candidats cible + 1 combo croisé en Autres)", () => {
    const amande = { id: "am", couleur: "Amande", parentIds: [] };
    const indigo = { id: "in", couleur: "Indigo", parentIds: [] };
    const femelle = { id: "f", couleur: "Indigo et Amande", parentIds: ["am", "in"] };
    const roux = { id: "ro", couleur: "Roux", parentIds: [] };
    const ebene = { id: "eb", couleur: "Ébène", parentIds: [] };
    const male = { id: "mm", couleur: "Roux et Pourpre", parentIds: ["ro", "eb"] };
    const byId = { am: amande, in: indigo, f: femelle, ro: roux, eb: ebene, mm: male };
    const repartition = repartitionProbabilitesAccouplement(male, femelle, byId, generationDeCouleurTest, combiner, 4, 44.85);
    expect(repartition["Roux et Pourpre"]).toBeCloseTo(8.28, 1);
    expect(repartition["Indigo et Amande"]).toBeCloseTo(8.28, 1);
    expect(repartition["Roux et Amande"]).toBeCloseTo(9.43, 1);
    expect(repartition["Roux et Indigo"]).toBeCloseTo(9.43, 1);
    expect(repartition["Ébène et Amande"]).toBeCloseTo(9.43, 1);
    expect(repartition["Roux"]).toBeCloseTo(12.47, 1);
    expect(repartition["Amande"]).toBeCloseTo(12.47, 1);
    expect(repartition["Indigo"]).toBeCloseTo(12.47, 1);
    expect(repartition["Ébène"]).toBeCloseTo(12.47, 1);
    expect(repartition["Ébène et Indigo"]).toBeCloseTo(5.26, 1);
  });
});
