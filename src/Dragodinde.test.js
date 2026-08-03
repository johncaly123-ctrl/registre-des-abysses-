import { describe, it, expect } from "vitest";
import {
  generationDeCouleurDragodinde,
  canonicaliserCouleurDragodinde,
  analyserTexteCaptureDragodinde,
  sexeDragodinde,
  dragodindeReproductible,
} from "./Dragodinde.jsx";

describe("generationDeCouleurDragodinde", () => {
  it("retrouve la génération d'une couleur monocolore de base", () => {
    expect(generationDeCouleurDragodinde("Dorée")).toBe(1);
    expect(generationDeCouleurDragodinde("Ébène")).toBe(3);
    expect(generationDeCouleurDragodinde("Émeraude")).toBe(9);
  });

  it("retrouve la génération d'un bicolore construit à partir des monocolores", () => {
    // Un bicolore combinant une couleur de gen 1 et une de gen 3 doit se
    // classer dans la table construite par construireGenerationsDragodinde.
    const gen = generationDeCouleurDragodinde("Dorée et Ébène");
    expect(Number.isFinite(gen)).toBe(true);
    expect(gen).toBeGreaterThan(1);
  });
});

describe("canonicaliserCouleurDragodinde", () => {
  it("laisse une couleur déjà canonique inchangée", () => {
    expect(canonicaliserCouleurDragodinde("Dorée")).toBe("Dorée");
  });

  it("corrige les accents/majuscules manqués par l'OCR", () => {
    expect(canonicaliserCouleurDragodinde("doree")).toBe("Dorée");
  });

  it("corrige une distance d'édition faible (typo OCR)", () => {
    expect(canonicaliserCouleurDragodinde("Doree")).toBe("Dorée");
  });

  it("conserve une couleur vraiment inconnue telle quelle", () => {
    expect(canonicaliserCouleurDragodinde("Xyzzy")).toBe("Xyzzy");
  });
});

describe("analyserTexteCaptureDragodinde", () => {
  it("lit des lignes 'Dragodinde <couleur> <qte>' inline", () => {
    const entrees = analyserTexteCaptureDragodinde("Dragodinde Dorée 15\nDragodinde Amande 9");
    expect(entrees).toHaveLength(2);
    const doree = entrees.find((e) => e.couleur === "Dorée");
    const amande = entrees.find((e) => e.couleur === "Amande");
    expect(doree.total).toBe(15);
    expect(doree.reconnu).toBe(true);
    expect(amande.total).toBe(9);
  });

  it("répare un préfixe 'Dragodinde' mal lu par l'OCR", () => {
    const entrees = analyserTexteCaptureDragodinde("Dragodlnde Dorée 2");
    expect(entrees).toHaveLength(1);
    expect(entrees[0].couleur).toBe("Dorée");
    expect(entrees[0].total).toBe(2);
  });

  it("recolle un nom de couleur bicolore coupé sur deux lignes", () => {
    const entrees = analyserTexteCaptureDragodinde("Dragodinde Dorée et\nÉbène 1");
    expect(entrees).toHaveLength(1);
    expect(entrees[0].total).toBe(1);
  });

  it("renvoie un tableau vide pour un texte vide", () => {
    expect(analyserTexteCaptureDragodinde("")).toEqual([]);
  });
});

describe("sexeDragodinde", () => {
  it("normalise les libellés français en M/F", () => {
    expect(sexeDragodinde({ sexe: "Mâle" })).toBe("M");
    expect(sexeDragodinde({ sexe: "Femelle" })).toBe("F");
  });

  it("accepte déjà des lettres M/F", () => {
    expect(sexeDragodinde({ sexe: "M" })).toBe("M");
    expect(sexeDragodinde({ sexe: "F" })).toBe("F");
  });

  it("renvoie une chaîne vide pour un sexe absent/inconnu", () => {
    expect(sexeDragodinde({})).toBe("");
    expect(sexeDragodinde({ sexe: "?" })).toBe("");
  });
});

describe("dragodindeReproductible", () => {
  it("est reproductible avec un statut fertile et une reproduction restante", () => {
    expect(dragodindeReproductible({ statut: "Féconde", sterile: false, reproRestantes: 1 })).toBe(true);
  });

  it("n'est pas reproductible si stérile", () => {
    expect(dragodindeReproductible({ statut: "Fertile", sterile: true, reproRestantes: 1 })).toBe(false);
  });

  it("n'est pas reproductible si le statut est Stérile même sans le flag", () => {
    expect(dragodindeReproductible({ statut: "Stérile", reproRestantes: 1 })).toBe(false);
  });

  it("n'est pas reproductible sans reproduction restante", () => {
    expect(dragodindeReproductible({ statut: "Féconde", reproRestantes: 0 })).toBe(false);
  });

  it("gère une monture absente", () => {
    expect(dragodindeReproductible(null)).toBe(false);
  });
});
