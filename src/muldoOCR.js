// Parsing du texte brut extrait par Tesseract.js depuis une capture du
// cheptel/des recettes : reconstruction des lignes "Muldo <couleur> <qte>"
// malgré les défauts OCR (colonnes séparées, mots coupés, chiffres/lettres
// confondus), plus quelques utilitaires de stock dérivés du cheptel.

import { distanceLevenshtein, plierCouleur, canonicaliserCouleur, couleurEstCanonique, RECETTES_COULEURS } from "./muldoGenetique.js";

export function normaliserTexteOCR(value) {
  return String(value || "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extraireNombreDansLigne(ligne) {
  const nums = String(ligne || "").match(/\b\d{1,3}\b/g);
  if (!nums || nums.length === 0) return 1;
  return Math.max(1, Number(nums[nums.length - 1]) || 1);
}


export function analyserTexteCaptureMuldo(texte) {
  const lignes = String(texte || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Deux colonnes dans l'interface Dofus : l'OCR lit souvent TOUS les noms,
  // puis TOUS les chiffres en bloc à la fin — mais certaines lignes gardent
  // leur chiffre inline ("Muldo Roux et Pourpre 1"). On associe donc chaque
  // couleur à son chiffre inline si elle en a un, et le bloc de fin ne remplit
  // que les couleurs restantes, dans l'ordre d'apparition. Empiler tous les
  // chiffres dans un seul tableau décalerait toutes les quantités dès la
  // première ligne inline.
  const entrees = []; // { couleur, quantite: number | null }
  const quantitesEnBloc = [];

  for (let i = 0; i < lignes.length; i++) {
    let ligne = lignes[i];

    // "Muldo" mal lu par l'OCR ("Mulde", "Muido", "MuIdo"…) : on répare le
    // préfixe si le premier mot est à distance ≤ 2 du mot attendu.
    const premierMot = (ligne.split(/\s+/)[0] || "");
    if (
      premierMot
      && !/^muldo$/i.test(premierMot)
      && distanceLevenshtein(plierCouleur(premierMot), "muldo") <= 2
    ) {
      ligne = `Muldo${ligne.slice(premierMot.length)}`;
    }

    // Nom coupé sur deux lignes ("Muldo Doré et" / "Amande").
    if (/^Muldo\s+/i.test(ligne) && /et$/i.test(ligne) && i + 1 < lignes.length) {
      ligne += " " + lignes[i + 1];
      i++;
    }

    ligne = ligne
      .replace(/Mulda/gi, "Muldo")
      .replace(/Orchidées/gi, "Orchidée")
      .replace(/\bat\b/gi, "et")
      .replace(/\bét\b/gi, "et");

    const matchInline = ligne.match(/^Muldo\s+(.+?)\s+(\d+)$/i);
    if (matchInline) {
      entrees.push({
        couleur: canonicaliserCouleur(matchInline[1].trim()),
        quantite: Number(matchInline[2]),
      });
      continue;
    }

    if (/^Muldo/i.test(ligne)) {
      entrees.push({
        couleur: canonicaliserCouleur(ligne.replace(/^Muldo\s+/i, "").trim()),
        quantite: null,
      });
      continue;
    }

    // Ligne de compteur seule. L'OCR confond parfois 0 avec o/O et 1 avec l/I.
    if (/^[0-9OolI]+$/.test(ligne)) {
      quantitesEnBloc.push(Number(ligne.replace(/[oO]/g, "0").replace(/[lI]/g, "1")) || 0);
    }
  }

  // Le bloc de chiffres remplit, dans l'ordre, les couleurs sans chiffre inline.
  let k = 0;
  entrees.forEach((entree) => {
    if (entree.quantite === null) {
      entree.quantite = k < quantitesEnBloc.length ? quantitesEnBloc[k] : 0;
      k += 1;
    }
  });

  return entrees.map(({ couleur, quantite }) => ({
    couleur,
    reconnu: couleurEstCanonique(couleur),
    male: 0,
    femelle: 0,
    inconnu: quantite,
    total: quantite,
  })).sort((a, b) => a.couleur.localeCompare(b.couleur, "fr"));
}

export function stockMF(cheptel) {
  return cheptel.reduce((acc, m) => {
    const couleur = m.couleur;
    if (!acc[couleur]) acc[couleur] = { male: 0, femelle: 0, total: 0 };
    const sexe = String(m.sexe || "").toLowerCase();

    if (sexe.includes("mâle") || sexe.includes("male") || sexe === "m") acc[couleur].male += 1;
    else if (sexe.includes("femelle") || sexe === "f") acc[couleur].femelle += 1;

    acc[couleur].total += 1;
    return acc;
  }, {});
}

export function analyseRecettesPourCible(cible, cheptel) {
  const stock = stockMF(cheptel);
  const recettes = RECETTES_COULEURS[cible] || [];

  return recettes.map(([a, b]) => {
    const sa = stock[a] || { male: 0, femelle: 0, total: 0 };
    const sb = stock[b] || { male: 0, femelle: 0, total: 0 };

    const couplesAB = sa.male * sb.femelle;
    const couplesBA = sa.femelle * sb.male;
    const couples = couplesAB + couplesBA;

    const manque = [];
    if (sa.total === 0) manque.push(a);
    if (sb.total === 0) manque.push(b);

    return {
      parentA: a,
      parentB: b,
      stockA: sa,
      stockB: sb,
      couples,
      manque,
      possible: couples > 0,
      partiel: manque.length === 1,
    };
  }).sort((x, y) => {
    if (x.possible !== y.possible) return x.possible ? -1 : 1;
    if (x.manque.length !== y.manque.length) return x.manque.length - y.manque.length;
    return y.couples - x.couples;
  });
}

export function actionsAvecCouleur(couleur, cheptel) {
  const stock = stockMF(cheptel);

  return Object.entries(RECETTES_COULEURS).flatMap(([cible, recettes]) =>
    recettes
      .filter(([a, b]) => a === couleur || b === couleur)
      .map(([a, b]) => {
        const partenaire = a === couleur ? b : a;
        const s = stock[partenaire] || { male: 0, femelle: 0, total: 0 };
        return {
          cible,
          partenaire,
          stockPartenaire: s,
          disponible: s.total > 0,
        };
      })
  );
}
