import { describe, it, expect } from "vitest";
import { calculerGenerationCible, bonusProbabiliteGenerationCible } from "./geneticsUtils.js";

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

  it("40% de base dès qu'un parent est au moins de génération 2 (vérifié in-game)", () => {
    expect(bonusProbabiliteGenerationCible({ genMax: 2 })).toBe(40);
    expect(bonusProbabiliteGenerationCible({ genMax: 5 })).toBe(40);
  });

  it("reproduit exactement les 6 accouplements observés en jeu (2026-07-25)", () => {
    // Doré et Amande (G4, niv 62) x Roux et Pourpre (G4, niv 64) -> Turquoise 58,9%
    expect(bonusProbabiliteGenerationCible({ niveauA: 62, niveauB: 64, genMax: 4 })).toBeCloseTo(58.9, 1);
    // Turquoise (G5, niv 70) x Indigo (G1, niv 53) -> Turquoise et Indigo 58,45%
    expect(bonusProbabiliteGenerationCible({ niveauA: 70, niveauB: 53, genMax: 5 })).toBeCloseTo(58.45, 1);
    // Orchidée (G1, niv 54) x Turquoise (G5, niv 65) -> Turquoise et Orchidée 57,85%
    expect(bonusProbabiliteGenerationCible({ niveauA: 54, niveauB: 65, genMax: 5 })).toBeCloseTo(57.85, 1);
    // Doré et Indigo (G2, niv 67) x Doré et Ébène (G2, niv 62) -> Roux 59,35%
    expect(bonusProbabiliteGenerationCible({ niveauA: 67, niveauB: 62, genMax: 2 })).toBeCloseTo(59.35, 1);
    // Ébène (G1, niv 64) x Orchidée (G1, niv 57) -> Ébène et Orchidée 48,15%
    expect(bonusProbabiliteGenerationCible({ niveauA: 64, niveauB: 57, genMax: 1 })).toBeCloseTo(48.15, 1);
    // Orchidée (G1, niv 54) x Doré (G1, niv 65) -> Doré et Orchidée 47,85%
    expect(bonusProbabiliteGenerationCible({ niveauA: 54, niveauB: 65, genMax: 1 })).toBeCloseTo(47.85, 1);
  });
});
