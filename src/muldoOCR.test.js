import { describe, it, expect } from "vitest";
import { analyserTexteCaptureMuldo, normaliserTexteOCR } from "./muldoOCR.js";

describe("normaliserTexteOCR", () => {
  it("nettoie les séparateurs de colonnes OCR et les espaces multiples", () => {
    expect(normaliserTexteOCR("Muldo   Doré |  5")).toBe("Muldo Doré 5");
  });
});

describe("analyserTexteCaptureMuldo", () => {
  it("lit des lignes 'Muldo <couleur> <qte>' inline", () => {
    const entrees = analyserTexteCaptureMuldo("Muldo Doré 5\nMuldo Indigo 3");
    expect(entrees).toHaveLength(2);
    const dore = entrees.find((e) => e.couleur === "Doré");
    const indigo = entrees.find((e) => e.couleur === "Indigo");
    expect(dore.total).toBe(5);
    expect(dore.reconnu).toBe(true);
    expect(indigo.total).toBe(3);
  });

  it("associe un bloc de chiffres de fin aux couleurs sans chiffre inline, dans l'ordre", () => {
    const entrees = analyserTexteCaptureMuldo("Muldo Doré\nMuldo Indigo\n5\n3");
    const dore = entrees.find((e) => e.couleur === "Doré");
    const indigo = entrees.find((e) => e.couleur === "Indigo");
    expect(dore.total).toBe(5);
    expect(indigo.total).toBe(3);
  });

  it("répare un préfixe 'Muldo' mal lu par l'OCR", () => {
    const entrees = analyserTexteCaptureMuldo("Muido Doré 2");
    expect(entrees).toHaveLength(1);
    expect(entrees[0].couleur).toBe("Doré");
    expect(entrees[0].total).toBe(2);
  });

  it("recolle un nom de couleur coupé sur deux lignes", () => {
    const entrees = analyserTexteCaptureMuldo("Muldo Doré et\nAmande 1");
    expect(entrees).toHaveLength(1);
    expect(entrees[0].couleur).toBe("Doré et Amande");
  });

  it("renvoie un tableau vide pour un texte vide", () => {
    expect(analyserTexteCaptureMuldo("")).toEqual([]);
  });
});
