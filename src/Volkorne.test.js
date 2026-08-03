import { describe, it, expect } from "vitest";
import {
  generationDeCouleurVolkorne,
  canonicaliserCouleurVolkorne,
  analyserTexteCaptureVolkorne,
  sexeVolkorne,
  volkorneReproductible,
} from "./Volkorne.jsx";

describe("generationDeCouleurVolkorne", () => {
  it("retrouve la génération d'une couleur monocolore de base", () => {
    expect(generationDeCouleurVolkorne("Pourpre")).toBe(1);
    expect(generationDeCouleurVolkorne("Roux")).toBe(3);
    expect(generationDeCouleurVolkorne("Doré")).toBe(7);
  });

  it("retrouve la génération d'un bicolore construit à partir des monocolores", () => {
    const gen = generationDeCouleurVolkorne("Pourpre et Orchidée");
    expect(Number.isFinite(gen)).toBe(true);
    expect(gen).toBeGreaterThan(1);
  });
});

describe("canonicaliserCouleurVolkorne", () => {
  it("laisse une couleur déjà canonique inchangée", () => {
    expect(canonicaliserCouleurVolkorne("Pourpre")).toBe("Pourpre");
  });

  it("corrige les accents/majuscules manqués par l'OCR", () => {
    expect(canonicaliserCouleurVolkorne("emeraude")).toBe("Émeraude");
  });

  it("conserve une couleur vraiment inconnue telle quelle", () => {
    expect(canonicaliserCouleurVolkorne("Xyzzy")).toBe("Xyzzy");
  });
});

describe("analyserTexteCaptureVolkorne", () => {
  it("lit des lignes 'Volkorne <couleur> <qte>' inline", () => {
    const entrees = analyserTexteCaptureVolkorne("Volkorne Pourpre 15\nVolkorne Orchidée 9");
    expect(entrees).toHaveLength(2);
    const pourpre = entrees.find((e) => e.couleur === "Pourpre");
    const orchidee = entrees.find((e) => e.couleur === "Orchidée");
    expect(pourpre.total).toBe(15);
    expect(pourpre.reconnu).toBe(true);
    expect(orchidee.total).toBe(9);
  });

  it("renvoie un tableau vide pour un texte vide", () => {
    expect(analyserTexteCaptureVolkorne("")).toEqual([]);
  });
});

describe("sexeVolkorne", () => {
  it("normalise les libellés français en M/F", () => {
    expect(sexeVolkorne({ sexe: "Mâle" })).toBe("M");
    expect(sexeVolkorne({ sexe: "Femelle" })).toBe("F");
  });

  it("renvoie une chaîne vide pour un sexe absent/inconnu", () => {
    expect(sexeVolkorne({})).toBe("");
  });
});

describe("volkorneReproductible", () => {
  it("est reproductible avec un statut fertile et une reproduction restante", () => {
    expect(volkorneReproductible({ statut: "Féconde", sterile: false, reproRestantes: 1 })).toBe(true);
  });

  it("n'est pas reproductible si stérile", () => {
    expect(volkorneReproductible({ statut: "Fertile", sterile: true, reproRestantes: 1 })).toBe(false);
  });

  it("n'est pas reproductible sans reproduction restante", () => {
    expect(volkorneReproductible({ statut: "Féconde", reproRestantes: 0 })).toBe(false);
  });

  it("gère une monture absente", () => {
    expect(volkorneReproductible(null)).toBe(false);
  });
});
