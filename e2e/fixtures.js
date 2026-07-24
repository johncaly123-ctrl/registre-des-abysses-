// Helpers partagés entre les specs E2E. Pas de framework de fixtures custom —
// juste des fonctions utilitaires appelées explicitement dans chaque test,
// pour rester lisible sans indirection supplémentaire.

export async function clearAppStorage(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

// Injecte un cheptel déterministe avant de recharger — nécessaire pour
// Dragodinde/Volkorne qui démarrent vides (contrairement à Muldo, qui a
// CHEPTEL_INITIAL_AUTO : un cheptel déjà déterministe dès localStorage.clear()).
export async function seedCheptel(page, storageKey, cheptel) {
  await page.evaluate(
    ({ storageKey, cheptel }) => localStorage.setItem(storageKey, JSON.stringify(cheptel)),
    { storageKey, cheptel }
  );
  await page.reload();
}

function monture({ id, nom, sexe, couleur, generation }) {
  return {
    id,
    nom,
    sexe,
    couleur,
    generation,
    statut: "Fertile",
    sterile: false,
    reproRestantes: 1,
    reproductionsRestantes: 1,
    amour: 100,
    endurance: 100,
    maturite: 100,
    serenite: 50,
  };
}

// Un couple fertile de sexes opposés dont la recette directe est le bicolore
// des deux couleurs (règle commune Dragodinde/Volkorne : generation d'un
// bicolore = max(genA, genB) + 1, recette = les deux monocolores).
export function seedCouplePourObjectif({ couleurMale, couleurFemelle, generation = 1 }) {
  return [
    monture({ id: "seed-m", nom: `${couleurMale} #1`, sexe: "Mâle", couleur: couleurMale, generation }),
    monture({ id: "seed-f", nom: `${couleurFemelle} #1`, sexe: "Femelle", couleur: couleurFemelle, generation }),
  ];
}

// Le libellé de la nav principale ("Muldo", "Dragodinde"...) peut aussi
// apparaître ailleurs sur la page (ex. le sélecteur de créature de
// l'estimation kamas sur le Dashboard) — on scope donc au <aside> latéral.
export async function clickNav(page, label) {
  await page.locator("aside").getByRole("button", { name: label }).click();
}

export async function clickSousNav(page, label) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
}
