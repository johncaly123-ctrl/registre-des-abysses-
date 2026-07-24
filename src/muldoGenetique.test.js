import { describe, it, expect } from "vitest";
import {
  canonicaliserCouleur,
  correspondanceFloue,
  meilleureRecettePourCouleur,
  construirePlanPourCouleur,
  affectationMaximale,
  generationDeCouleur,
  couleurEstCanonique,
} from "./muldoGenetique.js";

describe("canonicaliserCouleur", () => {
  it("laisse une couleur déjà canonique inchangée", () => {
    expect(canonicaliserCouleur("Doré")).toBe("Doré");
    expect(canonicaliserCouleur("Doré et Pourpre")).toBe("Doré et Pourpre");
  });

  it("corrige les accents/majuscules manqués par l'OCR", () => {
    expect(canonicaliserCouleur("dore")).toBe("Doré");
    expect(canonicaliserCouleur("EBENE")).toBe("Ébène");
  });

  it("corrige une distance d'édition ≤ 2 (typo OCR)", () => {
    expect(canonicaliserCouleur("Orchidce")).toBe("Orchidée");
    expect(canonicaliserCouleur("lndigo")).toBe("Indigo");
  });

  it("remet un nom bicolore dans le bon ordre", () => {
    expect(canonicaliserCouleur("Pourpre et Doré")).toBe("Doré et Pourpre");
  });

  it("conserve une couleur vraiment inconnue telle quelle", () => {
    expect(canonicaliserCouleur("Xyzzy")).toBe("Xyzzy");
  });

  it("gère les entrées vides", () => {
    expect(canonicaliserCouleur("")).toBe("");
    expect(canonicaliserCouleur(undefined)).toBe("");
  });
});

describe("couleurEstCanonique", () => {
  it("reconnaît les couleurs du référentiel", () => {
    expect(couleurEstCanonique("Roux")).toBe(true);
    expect(couleurEstCanonique("Pas une couleur")).toBe(false);
  });
});

describe("correspondanceFloue", () => {
  it("ne corrige rien en cas d'ex æquo", () => {
    // "abc" est à distance 1 de "abd" ET de "abe" : ambigu, donc pas de correction.
    expect(correspondanceFloue("abc", ["abd", "abe"])).toBeNull();
  });

  it("corrige quand un seul candidat est dans la tolérance", () => {
    expect(correspondanceFloue("orchidee", ["orchidee".replace("e", "é"), "indigo"])).not.toBeNull();
  });
});

describe("generationDeCouleur", () => {
  it("retrouve la génération d'une couleur de base", () => {
    expect(generationDeCouleur("Doré")).toBe(1);
  });

  it("retrouve la génération d'une couleur spéciale", () => {
    expect(generationDeCouleur("Roux")).toBe(3);
    expect(generationDeCouleur("Ambre")).toBe(9);
  });

  it("retombe sur la génération 4 pour un bicolore non listé", () => {
    expect(generationDeCouleur("Couleur et Inconnue")).toBe(4);
  });
});

describe("meilleureRecettePourCouleur", () => {
  it("coûte 0 si la couleur est déjà en stock", () => {
    const result = meilleureRecettePourCouleur("Roux", { "Roux": 1 });
    expect(result.cout).toBe(0);
    expect(result.recette).toBeNull();
  });

  it("trouve la recette la moins chère quand les deux parents sont en stock", () => {
    const stock = { "Doré et Pourpre": 1, "Doré et Indigo": 1 };
    const result = meilleureRecettePourCouleur("Roux", stock);
    expect(result.cout).toBe(1);
    expect(result.recette).toEqual(["Doré et Pourpre", "Doré et Indigo"]);
  });

  it("chiffre le coût en cascade quand rien n'est en stock", () => {
    // Roux nécessite deux bicolores, chacun nécessite ses deux couleurs de base.
    const result = meilleureRecettePourCouleur("Roux", {});
    expect(result.cout).toBeGreaterThan(1);
    expect(Number.isFinite(result.cout)).toBe(true);
  });
});

describe("construirePlanPourCouleur", () => {
  it("signale une couleur déjà présente dans le cheptel via la garde de profondeur", () => {
    // dejaPresente n'est renvoyé explicitement que par la branche de garde
    // (profondeur/cycle) — comportement d'origine conservé tel quel.
    const cheptel = [{ id: "1", couleur: "Doré", sexe: "M" }];
    const seen = new Set(["Doré"]);
    const plan = construirePlanPourCouleur("Doré", cheptel, {}, {}, 0, seen);
    expect(plan.dejaPresente).toBe(true);
  });

  it("propose un couple exploitable quand les deux parents sont présents", () => {
    const cheptel = [
      { id: "1", couleur: "Doré et Pourpre", sexe: "M", statut: "Fertile", reproRestantes: 1 },
      { id: "2", couleur: "Doré et Indigo", sexe: "F", statut: "Fertile", reproRestantes: 1 },
    ];
    const byId = Object.fromEntries(cheptel.map((m) => [m.id, m]));
    const plan = construirePlanPourCouleur("Roux", cheptel, byId, {});
    expect(plan.bloquee).toBe(false);
    expect(plan.couple).not.toBeNull();
  });

  it("signale un plan bloqué quand rien n'est disponible pour une couleur sans ancêtre", () => {
    const plan = construirePlanPourCouleur("Doré", [], {}, {});
    expect(plan.bloquee).toBe(true);
  });
});

describe("affectationMaximale (algorithme hongrois)", () => {
  it("choisit l'appariement qui maximise le score total", () => {
    // La diagonale (0,0)+(1,1) = 3+3 = 6 bat l'anti-diagonale (0,1)+(1,0) = 1+1 = 2.
    const matrice = [
      [3, 1],
      [1, 3],
    ];
    const affectations = affectationMaximale(matrice);
    const total = affectations.reduce((sum, [i, j]) => sum + matrice[i][j], 0);
    expect(total).toBe(6);
  });

  it("retourne un tableau vide pour une matrice vide", () => {
    expect(affectationMaximale([])).toEqual([]);
  });
});
