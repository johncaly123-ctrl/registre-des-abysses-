import { test, expect } from "@playwright/test";
import { clearAppStorage, clickNav, clickSousNav, seedCheptel } from "./fixtures.js";

const STORAGE_KEY = "cheptel-muldos-v1";

function sterile({ id, nom, sexe, couleur, generation }) {
  return {
    id, nom, sexe, couleur, generation,
    statut: "Stérile", sterile: true,
    reproRestantes: 0, reproductionsRestantes: 0,
    amour: 0, endurance: 0, maturite: 0, serenite: 50,
  };
}

test.beforeEach(async ({ page }) => {
  await clearAppStorage(page);
  // Deux stériles de même couleur/sexe/génération : résultat et sexe du
  // clonage garantis, pas de choix supplémentaire à faire dans le test.
  await seedCheptel(page, STORAGE_KEY, [
    sterile({ id: "a", nom: "Doré #A", sexe: "Mâle", couleur: "Doré", generation: 1 }),
    sterile({ id: "b", nom: "Doré #B", sexe: "Mâle", couleur: "Doré", generation: 1 }),
  ]);
  await clickNav(page, "Muldo");
  await clickSousNav(page, "🧬 Clonage");
});

test("cloner deux stériles de même génération crée une nouvelle monture fertile", async ({ page }) => {
  const main = page.locator(".main-view");

  await main.getByPlaceholder("Muldo A : nom ou couleur…").fill("Doré");
  await main.getByText("Doré #A — Doré", { exact: false }).click();

  await main.getByPlaceholder("Muldo B : nom ou couleur…").fill("Doré");
  await main.getByText("Doré #B — Doré", { exact: false }).click();

  // Couleur et sexe sont imposés (parents identiques), mais la lignée
  // génétique à conserver reste un choix explicite même dans ce cas.
  await main.getByRole("button", { name: /Doré #A — parents/ }).click();

  const clonerBtn = main.getByRole("button", { name: /Cloner/ });
  await expect(clonerBtn).toBeEnabled();
  await clonerBtn.click();

  await expect(page.getByText(/Clonage effectué/)).toBeVisible();
});
