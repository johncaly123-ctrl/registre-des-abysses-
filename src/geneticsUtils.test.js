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
});
