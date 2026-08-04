// Stockage centralisé de toutes les données d'élevage : un cache en mémoire
// hydraté une fois depuis la ligne Supabase du compte (table
// sauvegardes_elevage, un blob JSON par utilisateur — voir supabase-setup.sql
// v19), avec un push réseau débattu et regroupé (une seule écriture pour
// toutes les clés modifiées, pas un appel par clé). Remplace l'ancienne
// version localStorage : signatures inchangées pour chargerJSON/
// sauvegarderJSON/creerEcritureDebattue/flushToutesEcrituresDebattues, pour
// que les modules appelants n'aient rien à connaître du transport.
//
// Usage lors d'un futur bump de version de clé :
//   const STORAGE_KEY = "cheptel-muldos-v2";
//   chargerJSON(STORAGE_KEY, [], { migrerDepuis: ["cheptel-muldos-v1"] });

import { supabase } from "./supabaseClient.js";

const DELAI_PUSH_MS = 800;
const DELAI_RETRY_MS = 1600;

let cache = {};
let clesSales = new Set();
let utilisateurActuel = null;
let minuteurPush = null;
let pushEnCours = null;
let dernierEchec = false;

// Écritures locales débattues (creerEcritureDebattue) : coalescent les
// évènements UI rapides (slider glissé, frappe clavier) avant même de
// toucher au cache — indépendant du debounce réseau ci-dessus, qui regroupe
// ensuite tout ce qui a été marqué "sale" en une seule requête.
const ecrituresEnAttente = new Set();
let filetsBranches = false;

function brancherFiletsSecurite() {
  if (filetsBranches || typeof window === "undefined") return;
  filetsBranches = true;
  window.addEventListener("beforeunload", (e) => {
    ecrituresEnAttente.forEach((flush) => flush());
    if (clesSales.size > 0 || pushEnCours) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        ecrituresEnAttente.forEach((flush) => flush());
        pousserMaintenant();
      }
    });
  }
}

async function pousserMaintenant() {
  clearTimeout(minuteurPush);
  minuteurPush = null;
  if (!utilisateurActuel || !supabase || clesSales.size === 0) return;
  clesSales.clear();
  const instantane = { ...cache };
  pushEnCours = supabase
    .from("sauvegardes_elevage")
    .upsert({ utilisateur: utilisateurActuel, donnees: instantane }, { onConflict: "utilisateur" });
  const { error } = await pushEnCours;
  pushEnCours = null;
  if (error) {
    console.error("Échec de la sauvegarde vers le compte, nouvel essai programmé", error);
    dernierEchec = true;
    // On republie tout l'instantané courant (idempotent) plutôt que de
    // tenter un suivi clé-par-clé des modifications survenues entre-temps.
    clesSales.add("__retry__");
    minuteurPush = setTimeout(pousserMaintenant, DELAI_RETRY_MS);
  } else {
    dernierEchec = false;
  }
}

function marquerSale(cle) {
  clesSales.add(cle);
  clearTimeout(minuteurPush);
  minuteurPush = setTimeout(pousserMaintenant, DELAI_PUSH_MS);
}

// À appeler une fois après connexion (compte.session.user.id) : remplace le
// cache par le contenu de la ligne du compte. Retourne true si la ligne
// était vide/absente (compte neuf ou jamais migré — déclenche la proposition
// de migration des données locales héritées côté App.jsx).
export async function hydraterStockage(utilisateurId) {
  brancherFiletsSecurite();
  clearTimeout(minuteurPush);
  minuteurPush = null;
  utilisateurActuel = utilisateurId;
  clesSales.clear();
  dernierEchec = false;
  cache = {};
  if (!supabase || !utilisateurId) return true;
  const { data, error } = await supabase
    .from("sauvegardes_elevage")
    .select("donnees")
    .eq("utilisateur", utilisateurId)
    .maybeSingle();
  if (error) {
    console.error("Impossible de charger la sauvegarde du compte", error);
    dernierEchec = true;
    return true;
  }
  cache = data?.donnees && typeof data.donnees === "object" ? { ...data.donnees } : {};
  return Object.keys(cache).length === 0;
}

// À appeler à la déconnexion (ou avant de changer de compte) : vide le cache
// pour ne jamais laisser les données d'un compte visibles pour un autre.
export function reinitialiserStockage() {
  clearTimeout(minuteurPush);
  minuteurPush = null;
  cache = {};
  clesSales.clear();
  utilisateurActuel = null;
  dernierEchec = false;
}

// Snapshot { [cle]: valeur } de tout ce qui est actuellement connu — utilisé
// par l'export de sauvegarde (SauvegardePanel).
export function obtenirCacheComplet() {
  return { ...cache };
}

// Remplace intégralement le cache ET la ligne Supabase en une seule requête
// — utilisé par l'import de sauvegarde (fichier ou migration des données
// locales héritées).
export async function remplacerCacheComplet(contenu) {
  cache = { ...contenu };
  clearTimeout(minuteurPush);
  minuteurPush = null;
  clesSales.clear();
  if (!utilisateurActuel || !supabase) return;
  const { error } = await supabase
    .from("sauvegardes_elevage")
    .upsert({ utilisateur: utilisateurActuel, donnees: cache }, { onConflict: "utilisateur" });
  if (error) {
    dernierEchec = true;
    throw error;
  }
  dernierEchec = false;
}

// Pour un indicateur UI ("💾 sauvegarde… / ✓ à jour / ⚠ échec").
export function etatSauvegarde() {
  return { enAttente: clesSales.size > 0 || !!pushEnCours, dernierEchec };
}

// Sauvegardes manuelles nommées (table sauvegardes_manuelles, v29) : des
// instantanés complets pris à la demande (bouton "Sauvegarder" de l'en-tête),
// distincts du blob live ci-dessus. Plafonnées à MAX_SAUVEGARDES_MANUELLES
// côté client : la plus ancienne est supprimée avant d'insérer la nouvelle.
const MAX_SAUVEGARDES_MANUELLES = 3;

export async function listerSauvegardesManuelles(utilisateurId) {
  if (!supabase || !utilisateurId) return [];
  const { data, error } = await supabase
    .from("sauvegardes_manuelles")
    .select("id, cree_le")
    .eq("utilisateur_id", utilisateurId)
    .order("cree_le", { ascending: false });
  if (error) {
    console.error("Impossible de lister les sauvegardes manuelles", error);
    return [];
  }
  return data || [];
}

export async function creerSauvegardeManuelle(utilisateurId) {
  if (!supabase || !utilisateurId) throw new Error("Compte non connecté.");
  await flushToutesEcrituresDebattues();
  const donnees = obtenirCacheComplet();
  const { error } = await supabase
    .from("sauvegardes_manuelles")
    .insert({ utilisateur_id: utilisateurId, donnees });
  if (error) throw error;
  const existantes = await listerSauvegardesManuelles(utilisateurId);
  const excedent = existantes.slice(MAX_SAUVEGARDES_MANUELLES);
  if (excedent.length) {
    await supabase.from("sauvegardes_manuelles").delete().in("id", excedent.map((e) => e.id));
  }
  return existantes.length - excedent.length;
}

export async function chargerSauvegardeManuelle(id) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase
    .from("sauvegardes_manuelles")
    .select("donnees")
    .eq("id", id)
    .single();
  if (error) throw error;
  await remplacerCacheComplet(data.donnees);
}

export function chargerJSON(cle, valeurParDefaut, { migrerDepuis = [] } = {}) {
  if (cle in cache) return cache[cle];
  for (const ancienneCle of migrerDepuis) {
    if (ancienneCle in cache) {
      const valeur = cache[ancienneCle];
      cache[cle] = valeur;
      delete cache[ancienneCle];
      marquerSale(cle);
      return valeur;
    }
  }
  return valeurParDefaut;
}

export function sauvegarderJSON(cle, valeur) {
  cache[cle] = valeur;
  marquerSale(cle);
  return true;
}

export function creerEcritureDebattue(cle, delaiMs = 400) {
  let minuteurLocal = null;
  let derniereValeur;
  let enAttente = false;

  const ecrireMaintenant = () => {
    if (!enAttente) return;
    sauvegarderJSON(cle, derniereValeur);
    enAttente = false;
    if (minuteurLocal) {
      clearTimeout(minuteurLocal);
      minuteurLocal = null;
    }
  };

  ecrituresEnAttente.add(ecrireMaintenant);
  brancherFiletsSecurite();

  function ecrire(valeur) {
    derniereValeur = valeur;
    enAttente = true;
    if (minuteurLocal) clearTimeout(minuteurLocal);
    minuteurLocal = setTimeout(ecrireMaintenant, delaiMs);
  }

  ecrire.flush = ecrireMaintenant;
  return ecrire;
}

// À appeler avant toute lecture qui doit voir l'état le plus frais possible
// (export de sauvegarde) : force les écritures locales encore en attente de
// debounce, puis attend la fin d'un éventuel push réseau en vol.
export async function flushToutesEcrituresDebattues() {
  ecrituresEnAttente.forEach((flush) => flush());
  await pousserMaintenant();
  if (pushEnCours) {
    try {
      await pushEnCours;
    } catch {
      // déjà loggé dans pousserMaintenant
    }
  }
}
