import { test, expect } from "@playwright/test";
import { clearAppStorage, clickNav, clickSousNav, seedCheptel, seedCouplePourObjectif } from "./fixtures.js";

const STORAGE_KEY_VOLKORNE = "cheptel-volkornes-v1";

// Miroir de dragodinde-gps.spec.js — même garde-fou pour la 3e créature.

test.beforeEach(async ({ page }) => {
  await clearAppStorage(page);
  await seedCheptel(
    page,
    STORAGE_KEY_VOLKORNE,
    seedCouplePourObjectif({ couleurMale: "Pourpre", couleurFemelle: "Orchidée", generation: 1 })
  );
  await clickNav(page, "Volkorne");
  await clickSousNav(page, "🛰️ GPS");
});

test("GPS Volkorne : changer de mode, réaliser un couple, annuler", async ({ page }) => {
  const main = page.locator(".main-view");
  await expect(main.getByText("Objectif intelligent")).toBeVisible();

  await main.locator("select").first().selectOption("Pourpre et Orchidée");

  const compteur = main.locator("text=/\\d+ \\/ \\d+ réalisés/");
  await expect(compteur).toHaveText(/^0 \/ \d+ réalisés/);

  const realiserBtn = main.locator("button", { hasText: "1 réalisé" }).first();
  await expect(realiserBtn).toBeVisible();
  await realiserBtn.click();
  await expect(compteur).toHaveText(/^1 \/ \d+ réalisés/);

  await main.getByRole("button", { name: "+1 / Annuler le dernier" }).click();
  await expect(compteur).toHaveText(/^0 \/ \d+ réalisés/);
});
