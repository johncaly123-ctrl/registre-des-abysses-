// Utilitaires de lecture/écriture localStorage centralisés : lecture JSON sûre
// (jamais de crash sur une valeur corrompue) + migration automatique depuis
// d'anciennes clés versionnées, pour que bumper une clé "-v1" -> "-v2" ne
// fasse jamais perdre les données des visiteurs existants.
//
// Usage lors d'un futur bump de version :
//   const STORAGE_KEY = "cheptel-muldos-v2";
//   chargerJSON(STORAGE_KEY, [], { migrerDepuis: ["cheptel-muldos-v1"] });

export function chargerJSON(cle, valeurParDefaut, { migrerDepuis = [] } = {}) {
  try {
    const brut = localStorage.getItem(cle);
    if (brut !== null) return JSON.parse(brut);
  } catch (e) {
    console.error(`Lecture illisible pour la clé "${cle}"`, e);
  }

  for (const ancienneCle of migrerDepuis) {
    try {
      const brut = localStorage.getItem(ancienneCle);
      if (brut === null) continue;
      const valeur = JSON.parse(brut);
      try {
        localStorage.setItem(cle, brut);
        localStorage.removeItem(ancienneCle);
      } catch (e) {
        console.error(`Migration : écriture impossible pour "${cle}"`, e);
      }
      return valeur;
    } catch (e) {
      console.error(`Migration illisible depuis "${ancienneCle}"`, e);
    }
  }

  return valeurParDefaut;
}

export function sauvegarderJSON(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (e) {
    console.error(`Erreur de sauvegarde pour la clé "${cle}"`, e);
    return false;
  }
}

// Écritures groupées : utile pour les champs modifiés en continu (slider de
// jauge glissé au pixel, champ texte tapé au clavier) où sauvegarder à chaque
// évènement saturerait localStorage pour rien. Le flush est garanti à la
// fermeture/navigation (beforeunload) pour ne jamais perdre la dernière
// valeur en attente.
const ecrituresEnAttente = new Set();
let beforeUnloadBranche = false;

function brancherFlushAvantFermeture() {
  if (beforeUnloadBranche || typeof window === "undefined") return;
  beforeUnloadBranche = true;
  window.addEventListener("beforeunload", () => {
    ecrituresEnAttente.forEach((flush) => flush());
  });
}

export function creerEcritureDebattue(cle, delaiMs = 400) {
  let minuteur = null;
  let derniereValeur;
  let enAttente = false;

  const ecrireMaintenant = () => {
    if (!enAttente) return;
    sauvegarderJSON(cle, derniereValeur);
    enAttente = false;
    if (minuteur) {
      clearTimeout(minuteur);
      minuteur = null;
    }
  };

  ecrituresEnAttente.add(ecrireMaintenant);
  brancherFlushAvantFermeture();

  function ecrire(valeur) {
    derniereValeur = valeur;
    enAttente = true;
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(ecrireMaintenant, delaiMs);
  }

  ecrire.flush = ecrireMaintenant;
  return ecrire;
}

// À appeler avant toute lecture directe de localStorage qui doit voir l'état
// le plus frais possible (ex. export de sauvegarde) : force l'écriture de
// toute valeur encore en attente de debounce.
export function flushToutesEcrituresDebattues() {
  ecrituresEnAttente.forEach((flush) => flush());
}
