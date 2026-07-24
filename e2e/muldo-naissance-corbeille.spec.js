import { test, expect } from "@playwright/test";
import { clearAppStorage, clickNav, clickSousNav } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await clearAppStorage(page);
  await clickNav(page, "Muldo");
});

test("réaliser un couple puis confirmer la naissance ajoute un bébé au cheptel", async ({ page }) => {
  await clickSousNav(page, "🛰️ GPS");
  const main = page.locator(".main-view");
  await main.locator("button", { hasText: "Succès" }).first().click();

  await main.locator("button", { hasText: "1 réalisé" }).first().click();

  const naissancePanel = main.locator(".panel-card", { hasText: "Naissances à confirmer" });
  await expect(naissancePanel).toBeVisible();

  // Choisit la première couleur possible puis un sexe, confirme.
  await naissancePanel.locator("button.btn-ghost").first().click();
  await naissancePanel.getByRole("button", { name: "♂ Mâle" }).click();
  await naissancePanel.getByRole("button", { name: /Confirmer la naissance/ }).click();

  await expect(naissancePanel).toHaveCount(0);
  await expect(main.getByText(/Dernier bébé — à renommer en jeu|Dernière portée/)).toBeVisible();
});

test("supprimer un muldo l'envoie à la corbeille, restaurer le ramène au cheptel", async ({ page }) => {
  await clickSousNav(page, "🐴 Cheptel");

  // Ouvre la fiche du premier muldo de la liste.
  await page.locator(".tech-column").getByText(/#\d+$/).first().click();

  await page.locator(".cheptel-detail").getByRole("button", { name: /Retirer/ }).click();

  await clickNav(page, "Dashboard");
  const corbeille = page.locator(".panel-card", { hasText: "Corbeille" });
  await expect(corbeille).toBeVisible();
  await corbeille.click();

  await expect(corbeille.getByRole("button", { name: /Restaurer/ })).toBeVisible();
  await corbeille.getByRole("button", { name: /Restaurer/ }).click();

  await expect(page.locator(".panel-card", { hasText: "Corbeille" })).toHaveCount(0);
});
