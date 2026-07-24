import { test, expect } from "@playwright/test";
import { clearAppStorage, clickNav, clickSousNav } from "./fixtures.js";

// Rejoue le scénario qui a concrètement cassé deux fois cette session
// (parité GPS Dragodinde/Volkorne, puis refactor architectural App.jsx) :
// changer de mode GPS, réaliser un couple, annuler le dernier.

test.beforeEach(async ({ page }) => {
  await clearAppStorage(page);
  await clickNav(page, "Muldo");
  await clickSousNav(page, "🛰️ GPS");
});

test("la page GPS Muldo charge sans erreur avec les 4 modes", async ({ page }) => {
  const main = page.locator(".main-view");
  await expect(main.getByText("Objectif intelligent")).toBeVisible();
  for (const mode of ["Succès", "Une couleur", "Une génération", "Collection"]) {
    await main.locator("button", { hasText: mode }).first().click();
  }
  await expect(main.getByText("Objectif actuellement choisi par le GPS")).toBeVisible();
});

test("réaliser un couple puis annuler ramène la session à son état initial", async ({ page }) => {
  const main = page.locator(".main-view");
  // Mode "Succès" : le GPS choisit un objectif atteignable automatiquement
  // avec le cheptel de départ déterministe (CHEPTEL_INITIAL_AUTO).
  await main.locator("button", { hasText: "Succès" }).first().click();

  const compteur = main.locator("text=/\\d+ \\/ \\d+ réalisés/");
  await expect(compteur).toBeVisible();
  const avant = await compteur.textContent();
  expect(avant).toMatch(/^0 \/ \d+ réalisés/);

  const realiserBtn = main.locator("button", { hasText: "1 réalisé" }).first();
  await expect(realiserBtn).toBeVisible();
  await realiserBtn.click();

  await expect(compteur).toHaveText(/^1 \/ \d+ réalisés/);

  const annulerBtn = main.getByRole("button", { name: "+1 / Annuler le dernier" });
  await annulerBtn.click();

  await expect(compteur).toHaveText(avant);
});
