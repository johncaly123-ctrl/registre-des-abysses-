import { test, expect } from "@playwright/test";
import { clearAppStorage, clickNav, clickSousNav, seedCheptel, seedCouplePourObjectif } from "./fixtures.js";

const STORAGE_KEY_DRAGODINDE = "cheptel-dragodindes-v1";

// Version allégée du scénario GPS Muldo (mode/réaliser/annuler) — garde-fou
// direct contre une régression de parité GPS comme celle de cette session
// (Dragodinde/Volkorne avaient un GPS bien plus simple que Muldo, corrigé
// puis re-cassé une fois par un bug TDZ pendant le refactor suivant).

test.beforeEach(async ({ page }) => {
  await clearAppStorage(page);
  await seedCheptel(
    page,
    STORAGE_KEY_DRAGODINDE,
    seedCouplePourObjectif({ couleurMale: "Dorée", couleurFemelle: "Amande", generation: 1 })
  );
  await clickNav(page, "Dragodinde");
  await clickSousNav(page, "🛰️ GPS");
});

test("GPS Dragodinde : changer de mode, réaliser un couple, annuler", async ({ page }) => {
  const main = page.locator(".main-view");
  await expect(main.getByText("Objectif intelligent")).toBeVisible();

  // Mode "couleur" est déjà actif par défaut : cible directement le bicolore
  // atteignable avec les deux parents seedés (recette directe, un cran GPS).
  await main.locator("select").first().selectOption("Dorée et Amande");

  const compteur = main.locator("text=/\\d+ \\/ \\d+ réalisés/");
  await expect(compteur).toHaveText(/^0 \/ \d+ réalisés/);

  const realiserBtn = main.locator("button", { hasText: "1 réalisé" }).first();
  await expect(realiserBtn).toBeVisible();
  await realiserBtn.click();
  await expect(compteur).toHaveText(/^1 \/ \d+ réalisés/);

  await main.getByRole("button", { name: "+1 / Annuler le dernier" }).click();
  await expect(compteur).toHaveText(/^0 \/ \d+ réalisés/);
});
