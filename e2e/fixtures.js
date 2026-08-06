// Helpers partagés entre les specs E2E. Pas de framework de fixtures custom —
// juste des fonctions utilitaires appelées explicitement dans chaque test,
// pour rester lisible sans indirection supplémentaire.

// Le compte Supabase est obligatoire pour voir l'app (App() n'affiche que
// <PortailConnexion> sans session), donc les specs e2e passent toujours par
// le mode invité. modeInvite est un simple useState côté React (rien en
// localStorage) : réinitialisé à chaque page.reload()/goto(), on ne peut
// donc l'entrer qu'une fois, juste avant clickNav — jamais avant un reload.
async function entrerModeInviteSiPresent(page) {
  const essayer = page.getByRole("button", { name: "Essayer sans compte →" });
  if (await essayer.isVisible({ timeout: 2000 }).catch(() => false)) {
    await essayer.click();
  }
}

// Marque le tuto de première visite comme déjà vu — sinon son overlay
// s'ouvre par-dessus le menu latéral au premier rendu et intercepte les
// clics de clickNav (voir STORAGE_ONBOARDING_SITE dans App.jsx).
const STORAGE_ONBOARDING_SITE = "muldo-onboarding-site-v1";

export async function clearAppStorage(page) {
  await page.goto("/");
  await page.evaluate(
    (cle) => { localStorage.clear(); localStorage.setItem(cle, "1"); },
    STORAGE_ONBOARDING_SITE
  );
  await page.reload();
}

// Injecte un cheptel déterministe — nécessaire pour Dragodinde/Volkorne qui
// démarrent vides (contrairement à Muldo, qui a CHEPTEL_INITIAL_AUTO : un
// cheptel déjà déterministe dès localStorage.clear()). Depuis le passage à
// Supabase, use<Créature>Elevage() lit son cheptel via chargerJSON, un cache
// mémoire de stockage.js (jamais du localStorage brut, jamais hydraté en
// mode invité) — on écrit donc directement dedans via un hook exposé
// uniquement en dev (voir window.__seedStockageCache dans stockage.js), et
// SANS reload : ce cache est un singleton par chargement de page, un reload
// le viderait avant que le composant n'ait pu le lire.
export async function seedCheptel(page, storageKey, cheptel) {
  await page.evaluate(
    ({ storageKey, cheptel }) => window.__seedStockageCache(storageKey, cheptel),
    { storageKey, cheptel }
  );
}

function monture({ id, nom, sexe, couleur, generation }) {
  return {
    id,
    nom,
    sexe,
    couleur,
    generation,
    // "Féconde" (pas juste "Fertile") : dragodindePretPourGps/volkornePretPourGps
    // exigent ce statut précis pour qu'un couple compte comme immédiatement
    // réalisable dans le plan GPS — "Fertile" seul (capable mais jauges pas
    // pleines) ne suffit pas.
    statut: "Féconde",
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
  await entrerModeInviteSiPresent(page);
  await page.locator("aside").getByRole("button", { name: label }).click();
}

export async function clickSousNav(page, label) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  // Le tuto "Découverte du GPS" (STORAGE_ONBOARDING_GPS) passe par
  // chargerJSON/sauvegarderJSON (cache mémoire de stockage.js), jamais
  // hydraté en mode invité — contrairement au tuto du site, il ne peut pas
  // être pré-marqué "vu" via localStorage et se rouvre donc à chaque entrée
  // sur la sous-page GPS. On le referme s'il apparaît, sans échouer sinon.
  const passer = page.getByRole("button", { name: "Passer" });
  if (await passer.isVisible({ timeout: 2000 }).catch(() => false)) {
    await passer.click();
  }
}
