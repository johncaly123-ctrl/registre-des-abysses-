import React, { useState, useEffect } from "react";
import { chargerJSON, sauvegarderJSON } from "./stockage.js";
import { formatKamas } from "./panneauxElevage.jsx";

// Mangeoire d'enclos : 6 jauges à monter (Dragofesse, Mangeoire, Foudroyeur,
// Baffeur, Abreuvoir, Caresseur), chacune nourrie par 4 paliers de consommables
// (Extrait jusqu'à 40 000, Philtre jusqu'à 70 000, Potion jusqu'à 90 000,
// Élixir jusqu'au max), eux-mêmes déclinés en 5 tailles (Minuscule à
// Gigantesque, 1000 à 5000 points). Le nombre d'ingrédients augmente d'un par
// palier (2 pour un extrait, jusqu'à 5 pour un élixir).
//
// La composition des recettes (noms/quantités d'ingrédients, points par
// recette) est fixée par le jeu et ne change jamais : elle vit dans
// `structure`, indépendamment des prix kamas qui eux fluctuent selon le
// serveur/moment et vivent dans `prix` (map ingredientId -> prix unitaire).
// Les sauvegardes nommées ne figent donc que des jeux de prix, jamais la
// structure des recettes.
export const STORAGE_MANGEOIRE_STRUCTURE = "mangeoire-structure-v1";
export const STORAGE_MANGEOIRE_PRIX = "mangeoire-prix-v2";
export const STORAGE_MANGEOIRE_SAUVEGARDES = "mangeoire-sauvegardes-v2";
export const CLES_SAUVEGARDE_MANGEOIRE = [STORAGE_MANGEOIRE_STRUCTURE, STORAGE_MANGEOIRE_PRIX, STORAGE_MANGEOIRE_SAUVEGARDES];

const JAUGES = ["Dragofesse", "Mangeoire", "Foudroyeur", "Baffeur", "Abreuvoir", "Caresseur"];

const PALIERS = [
  { cle: "extrait", label: "Extrait", jaugeMax: 40000, nbIngredients: 2 },
  { cle: "philtre", label: "Philtre", jaugeMax: 70000, nbIngredients: 3 },
  { cle: "potion", label: "Potion", jaugeMax: 90000, nbIngredients: 4 },
  { cle: "elixir", label: "Élixir", jaugeMax: null, nbIngredients: 5 },
];

const TAILLES = [
  { cle: "minuscule", nom: "Minuscule", points: 1000 },
  { cle: "petit", nom: "Petit", points: 2000 },
  { cle: "moyen", nom: "Moyen", points: 3000 },
  { cle: "grand", nom: "Grand", points: 4000 },
  { cle: "gigantesque", nom: "Gigantesque", points: 5000 },
];

// Composition réelle des recettes (noms d'ingrédients), saisie manuellement
// depuis le jeu au fur et à mesure — jauge -> palier -> taille -> ingrédients.
// Les recettes absentes d'ici gardent des noms génériques "Ingrédient N"
// modifiables à la main dans l'interface.
const RECETTES_CONNUES = {
  Dragofesse: {
    extrait: {
      minuscule: ["Viande Intangible", "Herbe Folle"],
      petit: ["Viande Intangible", "Crinière de Scélérat Strubien"],
      moyen: ["Viande Faisandée", "Rondelles de Milirat Strubien"],
      grand: ["Viande Faisandée", "Chauve-souris"],
      gigantesque: ["Viande Minérale", "Corail Passaoh"],
    },
    philtre: {
      minuscule: ["Viande Minérale", "Osselet de Black Wabbit Squelette", "Fléau de Robot Fléau"],
      petit: ["Viande Ladre", "Pierre de Crystaloboule", "Kolérat Mort"],
      moyen: ["Viande Ladre", "Coquille de Dragoeuf Charbon", "Boomerang du Warko Marron"],
      grand: ["Viande Sanguinolente", "Poils de Koalak Reinette", "Dent de Gargantûl"],
      gigantesque: ["Viande Sanguinolente", "Patte de Bouledogre", "Queue du Mulou"],
    },
    potion: {
      minuscule: ["Viande Exsudative", "Plume de Dostrogo", "Antenne de Trésantène", "Coco du Bitouf des Plaines"],
      petit: ["Viande Exsudative", "Oreille de Bouftonmouth", "Couche usagée de Warko Violet", "Laine du Trooll Furieux"],
      moyen: ["Viande Saignante", "Peau de Draguaindrop", "Mouchoir de la Gamine Zoth", "Oreilles de Wabbit Fluo"],
      grand: ["Viande Saignante", "Aile de Mansobèse", "Écorce de Brouture", "Os de Sramouraï"],
      gigantesque: ["Viande Macérée", "Cuir de Gliglibido", "Peau de Rouquette", "Coquille de Fantimonier"],
    },
    elixir: {
      minuscule: ["Viande Macérée", "Résidu de Solfataré", "Griffe de Phorrêveur", "Bolas de Maltrio", "Chaîne de Panthègros"],
      petit: ["Viande Fraîche", "Os de Jiangshi-Nobi", "Cuir de Maho Givrefoux", "Dent de Trezz", "Œil de Madura"],
      moyen: ["Viande Fraîche", "Oreille de Fistulor", "Patte de Masticroc", "Lamelle de Champbis", "Caleçon Rouge"],
      grand: ["Viande Gâtée", "Manubrium de Wolvero", "Aile de Puceronde", "Péroné du Marôdeur", "Queue de Wolvero"],
      gigantesque: ["Viande Gâtée", "Cœur d'Empaillé", "Huile de Pikoleur", "Griffe de Kanimate", "Bec de Dodox"],
    },
  },
  Mangeoire: {
    extrait: {
      minuscule: ["Goujon", "Patte d'Arakne Magique"],
      petit: ["Goujon", "Pierre de Granit"],
      moyen: ["Truite", "Œil de Pikdoa"],
      grand: ["Truite", "Dent de Kwoan"],
      gigantesque: ["Poisson-Chaton", "Scalp de Bwork Archer"],
    },
    philtre: {
      minuscule: ["Poisson-Chaton", "Minerai Étrange", "Poils de Wo Wabbit"],
      petit: ["Carpe d'Iem", "Peau de Koalak Immature", "Étoffe de Foufayteur"],
      moyen: ["Carpe d'Iem", "Œuf de Dragoeuf Calcaire", "Œil de Kanigrou"],
      grand: ["Brochet", "Peau de Piralak", "Peau de Tivelo"],
      gigantesque: ["Brochet", "Peau de Cochon de Farle", "Échasse de Molette"],
    },
    potion: {
      minuscule: ["Anguille", "Bourgeon de Fourbasse", "Faux menton du Bourbassingue", "Bâton du Kilibriss"],
      petit: ["Anguille", "Corne de Boufmouth de guerre", "Étoffe du Fauchalak", "Slip de Troollaraj"],
      moyen: ["Perche", "Tibia du Guerrier Zoth", "Morpion de Truchideur", "Cawotte Transgénique"],
      grand: ["Perche", "Duvet de Mamansot", "Amygdales du Bitouf Sombre", "Fleur de Cactiflore"],
      gigantesque: ["Lotte", "Défense de Gliglicérin", "Bracelet de Ino-Naru", "Étoffe de Vigie Pirate"],
    },
    elixir: {
      minuscule: ["Lotte", "Œuf de Crapeur", "Œil de Phozami", "Bave du Kaskargo", "Crinière d'Orfélin"],
      petit: ["Bar Rikain", "Oreille de Chargus", "Queue de Yomi Givrefoux", "Barbe de Seith", "Lanterne usée"],
      moyen: ["Bar Rikain", "Volve de Fongeur", "Écorce de Champaknyde", "Racine d'Abrazif", "Caleçon Blanc"],
      grand: ["Tanche", "Oreille de Blérice", "Vomer d'Apériglours", "Aile de Gloursaya", "Molaire de Blérice"],
      gigantesque: ["Tanche", "Pince de Krabouilleur", "Cervelle de Verglasseur", "Pédoncule de Mérulor", "Pic du Nocturlabe"],
    },
  },
  Abreuvoir: {
    extrait: {
      minuscule: ["Ortie", "Bois Vermoulu"],
      petit: ["Ortie", "Bougie du Mineur Sombre"],
      moyen: ["Sauge", "Plume de Tofu Maléfique"],
      grand: ["Sauge", "Estomac de Tofu Ventripotent"],
      gigantesque: ["Trèfle à 5 feuilles", "Lait de Cochon de Lait"],
    },
    philtre: {
      minuscule: ["Trèfle à 5 feuilles", "Oreille du Grand Pa Wabbit", "Peau de Larve Champêtre"],
      petit: ["Menthe Sauvage", "Baballe", "Boîte de Vétauran"],
      moyen: ["Menthe Sauvage", "Œuf de Dragoeuf Charbon", "Boomerang du Dok Alako"],
      grand: ["Orchidée Freyesque", "Os de Pékeualak", "Œil de Saltik"],
      gigantesque: ["Orchidée Freyesque", "Os de Mama Koalak", "Plume de Gobvious"],
    },
    potion: {
      minuscule: ["Edelweiss", "Glouto Rhum", "Bec du Kido", "Peau de Mandrine"],
      petit: ["Edelweiss", "Œil de Boufmouth de guerre", "Boomerang du Maître Koalak", "Bracelet de Force de Trooll"],
      moyen: ["Graine de Pandouille", "Peau de Dragnarok", "Plume de Truchideur", "Œil de Wabbit Céphale"],
      grand: ["Graine de Pandouille", "Huile de Mamansot", "Coco du Bitouf Sombre", "Parchemin de Cactana"],
      gigantesque: ["Ginseng", "Sabot de Gliglicérin", "Étoffe de Kurookin", "Écaille de Harpirate"],
    },
    elixir: {
      minuscule: ["Ginseng", "Cœur de Crapeur", "Corne de Père Phorreur", "Porte-bonheur de Malalfa", "Étoffe de Kaniblou"],
      petit: ["Belladone", "Croissant de Tsukinochi", "Crâne de Yokaï Givrefoux", "Pagne de Trantroa", "Collier de Chakichan"],
      moyen: ["Belladone", "Pédoncule de Fongeur", "Carapace de Ver des Sables", "Écorce d'Abrazif", "Caleçon Bleu"],
      grand: ["Mandragore", "Étoffe de Croleur", "Venin d'Éperfide", "Laine de Glouragan", "Oreille de Croleur"],
      gigantesque: ["Mandragore", "Bec de Granduk", "Malleus de Karkanik", "Oreille de Mécanofoux", "Chaussette du Cyclophandre"],
    },
  },
  Foudroyeur: {
    extrait: {
      minuscule: ["Fer", "Sporme du Champ Champ"],
      petit: ["Fer", "Étoffe du Sanglier"],
      moyen: ["Cuivre", "Scalp de Milimulou"],
      grand: ["Cuivre", "Crâne de Chafer"],
      gigantesque: ["Bronze", "Corail Morito"],
    },
    philtre: {
      minuscule: ["Bronze", "Estomac de Wo Wabbit", "Bidule inutile"],
      petit: ["Kobalte", "Humérus du Sparo", "Langue de Craquelope"],
      moyen: ["Kobalte", "Coquille de Dragoeuf Ardoise", "Racine d'Abraknyde Sombre"],
      grand: ["Manganèse", "Poils de Koalak Indigo", "Fil de Néfileuse"],
      gigantesque: ["Manganèse", "Peau de Drakoalak", "Canine de Mergranlou"],
    },
    potion: {
      minuscule: ["Étain", "Trukikol Mort", "Corne de Berserkoffre", "Peau de Minoskito"],
      petit: ["Étain", "Cuir de Bouftonmouth", "Peau de Maître Koalak", "Épaulière de Troolligark"],
      moyen: ["Argent", "Corne de Dragacé", "Écusson du Sergent Zoth", "Dents de Wabbit Vampire"],
      grand: ["Argent", "Peau de Mansobèse", "Écorce de Fécorce", "Moustaches de Cactoblongo"],
      gigantesque: ["Bauxite", "Étoffe de Gliglidoudur", "Tête de lance de Fangshu", "Mât de Fantômat"],
    },
    elixir: {
      minuscule: ["Bauxite", "Ulna de Solfataré", "Peau de Métaphorreur", "Pic de Malépik", "Boule de Panthègros"],
      petit: ["Or", "Plastron de Tambouraï", "Laine de Maho Givrefoux", "Peau de Vindeux", "Kapokaza"],
      moyen: ["Or", "Volve de Fistulor", "Peau de Trémorse", "Bave de Champ à Gnons", "Caleçon Brun"],
      grand: ["Cendrepierre", "Poil de Blérauve", "Pince de Lucrane", "Iris de Boulglours", "Griffe de Blérauve"],
      gigantesque: ["Cendrepierre", "Dent de Cuirboule", "Ethmoïde de Stalak", "Sternum de Mansordide", "Sépale de Drosérâle"],
    },
  },
  Caresseur: {
    extrait: {
      minuscule: ["Blé", "Engrais"],
      petit: ["Blé", "Feuille de Rose Obscure"],
      moyen: ["Orge", "Œil de Ramane Strubien"],
      grand: ["Orge", "Champignon Luidegît"],
      gigantesque: ["Avoine", "Corail Malibout"],
    },
    philtre: {
      minuscule: ["Avoine", "Bandeau de Black Wabbit Squelette", "Souris verte"],
      petit: ["Houblon", "Cœur de Craqueleur", "Fragment d'Épée Reptilienne"],
      moyen: ["Houblon", "Coquille de Dragoeuf Argile", "Écorce de Liroye Merline"],
      grand: ["Lin", "Poils de Koalak Coco", "Laine de Dardalaine"],
      gigantesque: ["Lin", "Oreille de Bouledogre", "Testicules de Cocholou"],
    },
    potion: {
      minuscule: ["Seigle", "Fleur de Gloutovore", "Langue de Mimikado", "Fragment de cerveau poli"],
      petit: ["Seigle", "Clavicule de Boufmouth", "Poils de Barbe du Warko Violet", "Enfumoir Zoth"],
      moyen: ["Malt", "Aile de Draguaindrop", "Braguette du Maître Zoth", "Feuille de Cawotman"],
      grand: ["Malt", "Plume du Timansot", "Écorce de Nerbe", "Sacoche de Kartouche"],
      gigantesque: ["Chanvre", "Estomac de Gliglidoudur", "Poils de Pétartifoux", "Queue de Fantomalamère"],
    },
    elixir: {
      // minuscule non ajouté : liste incomplète fournie (4 ingrédients sur 5 attendus) —
      // laissé éditable en attendant le nom du 5e ingrédient.
      petit: ["Maïs", "Étoffe de Samouraï fantôme", "Oreille de Soryo Givrefoux", "Poil de Chacrebleu", "Yokayu"],
      moyen: ["Maïs", "Œil de Dramanite", "Langue de Morsquale", "Œil de Champmane", "String en Cuir de la Mama Bwork"],
      grand: ["Millet", "Œil de Fleuro", "Patte de Scoliopode", "Peau d'Ouilleur", "Oreille de Fleuro"],
      gigantesque: ["Millet", "Étoffe de Grodruche", "Molaire de Ventrublion", "Queue de Sinistrofu", "Crinière de Krakal"],
    },
  },
  Baffeur: {
    extrait: {
      minuscule: ["Bois de Frêne", "Feuille de Tournesol Sauvage"],
      petit: ["Bois de Frêne", "Os Invisible du Chafer Invisible"],
      moyen: ["Bois de Châtaignier", "Patte d'Arakne des Égouts"],
      grand: ["Bois de Châtaignier", "Colonne Vertébrale"],
      gigantesque: ["Bois de Noyer", "Corail Kouraçao"],
    },
    philtre: {
      minuscule: ["Bois de Noyer", "Crâne de Wabbit Squelette", "Duvet de Bourdard"],
      petit: ["Bois de Chêne", "Dent en Or de Craqueleur", "Œil de Crowneille"],
      moyen: ["Bois de Chêne", "Coquille de Dragoeuf Calcaire", "Ambre d'Abraknyde Sombre"],
      grand: ["Bois d'Érable", "Poils de Koalak Griotte", "Chélicères d'Arapex"],
      gigantesque: ["Bois d'Érable", "Jus de Ouassingue", "Poils de Mulounoké"],
    },
    potion: {
      minuscule: ["Bois de Pin", "Feuille de Fourbasse", "Corde de Boursoin", "Cœur de pierre poli"],
      petit: ["Bois de Pin", "Laine de Boufmouth", "Cubitus de Momie Koalak", "Peau de Kraméléhon"],
      moyen: ["Bois de Merisier", "Peau de Dragueuse", "Rotule du Disciple Zoth", "Sang de Wabbit Garou"],
      grand: ["Bois de Merisier", "Bec du Timansot", "Écorce de Chiendent", "Foulard de Milimaître"],
      gigantesque: ["Bois d'Ébène", "Poil de Gliglitch", "Poils de Boumbardier", "Pince du Fancrôme"],
    },
    elixir: {
      minuscule: ["Bois d'Ébène", "Pierre d'Atomystique", "Tresse du Poolay", "Pétale de Malter", "Griffe de Félygiène"],
      petit: ["Bois de Charme", "Fleur d'Onabu-Geisha", "Patte de Soryo Givrefoux", "Queue de Chasquatch", "Kaokurimono"],
      moyen: ["Bois de Charme", "Lamelle de Dramanite", "Dent de Cycloporth", "Langue de Champodonte", "Furoncle de la Mama Bwork"],
      grand: ["Bois d'Orme", "Oreille de Gobosteur", "Oreille d'Apériglours", "Œil de Sapeur", "Calcanéus de Meliglours"],
      gigantesque: ["Bois d'Orme", "Culotte de Harrogant", "Plume de Cycloïde", "Broderie d'Eskoglyphe", "Molaire de Nessil"],
    },
  },
};

function estRecetteConnue(jauge, palierCle, tailleCle) {
  return Boolean(RECETTES_CONNUES[jauge]?.[palierCle]?.[tailleCle]);
}

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function preposition(nom) {
  return /^[aeiouhAEIOUHÀÂÄÉÈÊËÎÏÔÖÙÛÜàâäéèêëîïôöùûü]/.test(nom) ? `d'${nom}` : `de ${nom}`;
}

function libelleRecette(jauge, palier, taille) {
  return `${taille.nom} ${palier.label} ${preposition(jauge)}`;
}

function libelleCourt(palier, taille) {
  return `${taille.nom} ${palier.label}`;
}

function creerIngredientsStructure(nb, noms) {
  return Array.from({ length: nb }, (_, i) => ({ id: uid(), nom: (noms && noms[i]) || `Ingrédient ${i + 1}`, quantite: 1 }));
}

function creerStructureParDefaut() {
  const structure = {};
  JAUGES.forEach((jauge) => {
    structure[jauge] = {};
    PALIERS.forEach((palier) => {
      structure[jauge][palier.cle] = TAILLES.map((taille) => ({
        id: uid(),
        tailleCle: taille.cle,
        points: taille.points,
        ingredients: creerIngredientsStructure(palier.nbIngredients, RECETTES_CONNUES[jauge]?.[palier.cle]?.[taille.cle]),
      }));
    });
  });
  return structure;
}

function normaliserStructure(brut) {
  const base = creerStructureParDefaut();
  if (!brut || typeof brut !== "object") return base;

  JAUGES.forEach((jauge) => {
    PALIERS.forEach((palier) => {
      const liste = brut?.[jauge]?.[palier.cle];
      if (!Array.isArray(liste)) return;

      base[jauge][palier.cle] = TAILLES.map((taille, index) => {
        const existante = liste.find((r) => r.tailleCle === taille.cle) || liste[index];
        if (!existante) return base[jauge][palier.cle][index];

        const ingredients = Array.isArray(existante.ingredients) && existante.ingredients.length
          ? existante.ingredients.map((ing, i) => ({
              id: ing.id || uid(),
              nom: ing.nom || `Ingrédient ${i + 1}`,
              quantite: Number(ing.quantite) || 0,
            }))
          : creerIngredientsStructure(palier.nbIngredients, RECETTES_CONNUES[jauge]?.[palier.cle]?.[taille.cle]);

        return {
          id: existante.id || uid(),
          tailleCle: taille.cle,
          points: Number(existante.points) || taille.points,
          ingredients,
        };
      });
    });
  });

  return base;
}

function normaliserPrix(brut) {
  if (!brut || typeof brut !== "object") return {};
  const propre = {};
  Object.keys(brut).forEach((id) => {
    const n = Number(brut[id]);
    if (Number.isFinite(n)) propre[id] = n;
  });
  return propre;
}

function coutRecette(recette, prixParIngredient) {
  return recette.ingredients.reduce(
    (total, ing) => total + (Number(ing.quantite) || 0) * (Number(prixParIngredient[ing.id]) || 0),
    0
  );
}

function fmtRatio(n, decimales = 2) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimales }).format(n);
}

export function MangeoirePage() {
  const [structure, setStructure] = useState(() => normaliserStructure(chargerJSON(STORAGE_MANGEOIRE_STRUCTURE, null)));
  const [prix, setPrix] = useState(() => normaliserPrix(chargerJSON(STORAGE_MANGEOIRE_PRIX, null)));
  const [sauvegardes, setSauvegardes] = useState(() => chargerJSON(STORAGE_MANGEOIRE_SAUVEGARDES, []));
  const [jaugeActive, setJaugeActive] = useState(JAUGES[0]);
  const [palierActif, setPalierActif] = useState(PALIERS[0].cle);
  const [classementFiltre, setClassementFiltre] = useState("tous");
  const [nomSauvegarde, setNomSauvegarde] = useState("");
  const [rechercheSauvegarde, setRechercheSauvegarde] = useState("");
  const [statut, setStatut] = useState("");
  const [ingredientCopieId, setIngredientCopieId] = useState(null);

  useEffect(() => { sauvegarderJSON(STORAGE_MANGEOIRE_STRUCTURE, structure); }, [structure]);
  useEffect(() => { sauvegarderJSON(STORAGE_MANGEOIRE_PRIX, prix); }, [prix]);
  useEffect(() => { sauvegarderJSON(STORAGE_MANGEOIRE_SAUVEGARDES, sauvegardes); }, [sauvegardes]);

  const palier = PALIERS.find((p) => p.cle === palierActif);
  const recettes = structure[jaugeActive][palierActif];

  const majPoints = (tailleCle, valeur) => {
    setStructure((prev) => {
      const suivant = { ...prev };
      suivant[jaugeActive] = { ...suivant[jaugeActive] };
      suivant[jaugeActive][palierActif] = suivant[jaugeActive][palierActif].map((r) =>
        r.tailleCle === tailleCle ? { ...r, points: Number(valeur) || 0 } : r
      );
      return suivant;
    });
  };

  const majIngredientChamp = (tailleCle, ingredientId, champ, valeur) => {
    if (estRecetteConnue(jaugeActive, palierActif, tailleCle)) return;
    setStructure((prev) => {
      const suivant = { ...prev };
      suivant[jaugeActive] = { ...suivant[jaugeActive] };
      suivant[jaugeActive][palierActif] = suivant[jaugeActive][palierActif].map((r) => {
        if (r.tailleCle !== tailleCle) return r;
        return {
          ...r,
          ingredients: r.ingredients.map((ing) =>
            ing.id === ingredientId
              ? { ...ing, [champ]: champ === "nom" ? valeur : Number(valeur) || 0 }
              : ing
          ),
        };
      });
      return suivant;
    });
  };

  const majIngredientPrix = (ingredientId, valeur) => {
    setPrix((prev) => ({ ...prev, [ingredientId]: Number(valeur) || 0 }));
  };

  const ajouterIngredient = (tailleCle) => {
    if (estRecetteConnue(jaugeActive, palierActif, tailleCle)) return;
    setStructure((prev) => {
      const suivant = { ...prev };
      suivant[jaugeActive] = { ...suivant[jaugeActive] };
      suivant[jaugeActive][palierActif] = suivant[jaugeActive][palierActif].map((r) =>
        r.tailleCle === tailleCle
          ? { ...r, ingredients: [...r.ingredients, { id: uid(), nom: `Ingrédient ${r.ingredients.length + 1}`, quantite: 1 }] }
          : r
      );
      return suivant;
    });
  };

  const supprimerIngredient = (tailleCle, ingredientId) => {
    if (estRecetteConnue(jaugeActive, palierActif, tailleCle)) return;
    setStructure((prev) => {
      const suivant = { ...prev };
      suivant[jaugeActive] = { ...suivant[jaugeActive] };
      suivant[jaugeActive][palierActif] = suivant[jaugeActive][palierActif].map((r) =>
        r.tailleCle === tailleCle
          ? { ...r, ingredients: r.ingredients.filter((ing) => ing.id !== ingredientId) }
          : r
      );
      return suivant;
    });
    setPrix((prev) => {
      const suivant = { ...prev };
      delete suivant[ingredientId];
      return suivant;
    });
  };

  const copierNomIngredient = (ing) => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      afficherStatut("Copie non supportée par ce navigateur.");
      return;
    }
    navigator.clipboard.writeText(ing.nom).then(() => {
      setIngredientCopieId(ing.id);
      setTimeout(() => setIngredientCopieId((prev) => (prev === ing.id ? null : prev)), 1200);
    }).catch(() => afficherStatut("Impossible de copier."));
  };

  const classement = PALIERS
    .filter((p) => classementFiltre === "tous" || p.cle === classementFiltre)
    .flatMap((p) =>
      TAILLES.map((taille) => {
        const recette = structure[jaugeActive][p.cle].find((r) => r.tailleCle === taille.cle);
        const cout = coutRecette(recette, prix);
        const points = Number(recette.points) || 0;
        return {
          label: libelleCourt(p, taille),
          cout,
          points,
          coutParPoint: points > 0 ? cout / points : Infinity,
          coutPour1000: points > 0 ? (cout / points) * 1000 : Infinity,
        };
      })
    )
    .sort((a, b) => a.coutParPoint - b.coutParPoint);

  const meilleure = classement.find((r) => Number.isFinite(r.coutParPoint));

  const afficherStatut = (msg) => {
    setStatut(msg);
    setTimeout(() => setStatut((prev) => (prev === msg ? "" : prev)), 1800);
  };

  const enregistrerSauvegarde = () => {
    const nom = nomSauvegarde.trim();
    if (!nom) { afficherStatut("Donne un nom à la sauvegarde."); return; }

    const indexExistant = sauvegardes.findIndex((s) => s.nom.toLowerCase() === nom.toLowerCase());
    if (indexExistant >= 0 && !confirm(`Une sauvegarde nommée « ${nom} » existe déjà. La remplacer ?`)) return;

    const entree = {
      id: indexExistant >= 0 ? sauvegardes[indexExistant].id : uid(),
      nom,
      enregistreLe: new Date().toISOString(),
      prix: JSON.parse(JSON.stringify(prix)),
    };

    setSauvegardes((prev) => {
      if (indexExistant >= 0) {
        const copie = [...prev];
        copie[indexExistant] = entree;
        return copie;
      }
      return [entree, ...prev];
    });
    setNomSauvegarde("");
    afficherStatut(`Sauvegarde « ${nom} » enregistrée.`);
  };

  const chargerSauvegarde = (id) => {
    const entree = sauvegardes.find((s) => s.id === id);
    if (!entree) return;
    if (!confirm(`Charger « ${entree.nom} » ? Les prix actuellement affichés seront remplacés (les ingrédients ne bougent pas).`)) return;
    setPrix(normaliserPrix(entree.prix));
    afficherStatut(`Sauvegarde « ${entree.nom} » chargée.`);
  };

  const supprimerSauvegarde = (id) => {
    const entree = sauvegardes.find((s) => s.id === id);
    if (!entree) return;
    if (!confirm(`Supprimer définitivement la sauvegarde « ${entree.nom} » ?`)) return;
    setSauvegardes((prev) => prev.filter((s) => s.id !== id));
    afficherStatut(`Sauvegarde « ${entree.nom} » supprimée.`);
  };

  const reinitialiserPrix = () => {
    if (!confirm("Remettre tous les prix à 0 ? Les noms/quantités d'ingrédients et tes sauvegardes de prix nommées sont conservés.")) return;
    setPrix({});
  };

  const sauvegardesFiltrees = sauvegardes
    .filter((s) => s.nom.toLowerCase().includes(rechercheSauvegarde.trim().toLowerCase()))
    .sort((a, b) => new Date(b.enregistreLe) - new Date(a.enregistreLe));

  return (
    <>
      <div className="panel-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2>Mangeoire d'enclos — Rentabilité</h2>
          <button className="btn btn-ghost" onClick={reinitialiserPrix}>Réinitialiser les prix</button>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6, marginBottom: 14 }}>
          Compare le coût des recettes de mangeoire selon leur coût total et leurs points, pour les 6 jauges
          et les 4 paliers de consommables. Les noms/quantités d'ingrédients sont fixes (recettes du jeu) et
          se sauvegardent automatiquement ; seuls les prix kamas changent selon le serveur ou le moment.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {JAUGES.map((jauge) => (
            <button
              key={jauge}
              className="btn btn-ghost"
              style={jauge === jaugeActive ? { borderColor: "var(--gold)", color: "var(--gold2)" } : undefined}
              onClick={() => setJaugeActive(jauge)}
            >
              {jauge}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {PALIERS.map((p) => (
            <button
              key={p.cle}
              className="btn btn-ghost"
              style={p.cle === palierActif ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : undefined}
              onClick={() => setPalierActif(p.cle)}
            >
              {p.label} <span style={{ opacity: 0.75, fontWeight: 500 }}>({p.jaugeMax ? `jusqu'à ${p.jaugeMax.toLocaleString("fr-FR")}` : "jusqu'au max"})</span>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {TAILLES.map((taille) => {
            const recette = recettes.find((r) => r.tailleCle === taille.cle);
            const cout = coutRecette(recette, prix);
            const verrouille = estRecetteConnue(jaugeActive, palierActif, taille.cle);
            return (
              <div key={taille.cle} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 12, background: "rgba(0,0,0,.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <b style={{ fontSize: 14 }}>
                    {libelleRecette(jaugeActive, palier, taille)}
                    {verrouille && <span title="Recette officielle : ingrédients verrouillés" style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "var(--muted)" }}>🔒</span>}
                  </b>
                  <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                    Points / utilisations
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="1"
                      value={recette.points}
                      onChange={(e) => majPoints(taille.cle, e.target.value)}
                      style={{ width: 140, textAlign: "right" }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 80px 110px auto", gap: 8, fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    <div>Ingrédient</div>
                    <div>Quantité</div>
                    <div>Prix unitaire</div>
                    <div></div>
                  </div>
                  {recette.ingredients.map((ing) => (
                    <div key={ing.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 80px 110px auto", gap: 8, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          className="field"
                          value={ing.nom}
                          readOnly={verrouille}
                          onChange={(e) => majIngredientChamp(taille.cle, ing.id, "nom", e.target.value)}
                          style={{ flex: 1, opacity: verrouille ? 0.85 : 1, cursor: verrouille ? "default" : "text" }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          title="Copier le nom de l'ingrédient"
                          onClick={() => copierNomIngredient(ing)}
                          style={{ padding: "8px 10px", color: ingredientCopieId === ing.id ? "var(--green)" : undefined }}
                        >
                          {ingredientCopieId === ing.id ? "✓" : "📋"}
                        </button>
                      </div>
                      <input
                        className="field"
                        type="number"
                        min="0"
                        step="0.01"
                        value={ing.quantite}
                        readOnly={verrouille}
                        onChange={(e) => majIngredientChamp(taille.cle, ing.id, "quantite", e.target.value)}
                        style={{ textAlign: "right", opacity: verrouille ? 0.85 : 1, cursor: verrouille ? "default" : "text" }}
                      />
                      <input className="field" type="number" min="0" step="1" value={prix[ing.id] || 0} onChange={(e) => majIngredientPrix(ing.id, e.target.value)} style={{ textAlign: "right" }} />
                      {verrouille
                        ? <span style={{ padding: "8px 10px", color: "var(--muted)", textAlign: "center" }} title="Ingrédient verrouillé (recette officielle)">🔒</span>
                        : <button className="btn btn-ghost" style={{ color: "var(--red)", padding: "8px 10px" }} title="Supprimer cet ingrédient" onClick={() => supprimerIngredient(taille.cle, ing.id)}>×</button>}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  {verrouille
                    ? <span style={{ color: "var(--muted)", fontSize: 12 }}>🔒 Recette officielle — ingrédients verrouillés</span>
                    : <button className="btn btn-ghost" onClick={() => ajouterIngredient(taille.cle)}>+ Ajouter un ingrédient</button>}
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>Coût total : <b style={{ color: "var(--text)" }}>{formatKamas(cout)}</b></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h2>Classement — {jaugeActive}</h2>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
          {classementFiltre === "tous"
            ? "Toutes tailles et tous paliers confondus, pour la jauge sélectionnée."
            : `Toutes tailles du palier ${PALIERS.find((p) => p.cle === classementFiltre).label}, pour la jauge sélectionnée.`}
          {" "}La recette première est celle qui revient au moins cher pour 1 000 points.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button
            className="btn btn-ghost"
            style={classementFiltre === "tous" ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : undefined}
            onClick={() => setClassementFiltre("tous")}
          >
            Tous types
          </button>
          {PALIERS.map((p) => (
            <button
              key={p.cle}
              className="btn btn-ghost"
              style={p.cle === classementFiltre ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : undefined}
              onClick={() => setClassementFiltre(p.cle)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 16 }}>
          <div className="pill" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "10px 14px" }}>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>Meilleure recette</span>
            <span style={{ color: "var(--green)", fontWeight: 900, fontSize: 15 }}>{meilleure ? meilleure.label : "—"}</span>
          </div>
          <div className="pill" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "10px 14px" }}>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>Coût pour 1 000 points</span>
            <span style={{ fontWeight: 900, fontSize: 15 }}>{meilleure ? formatKamas(meilleure.coutPour1000) : "—"}</span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                {["Recette", "Coût total", "Points", "K/point", "K/1 000"].map((h) => (
                  <th key={h} style={{ textAlign: h === "Recette" ? "left" : "right", padding: "8px", borderBottom: "1px solid var(--line)", color: "var(--gold2)", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classement.map((r, index) => {
                const complet = Number.isFinite(r.coutParPoint);
                return (
                  <tr key={r.label} style={index === 0 && complet ? { background: "rgba(52,211,153,.07)" } : undefined}>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", fontWeight: 700 }}>{index + 1}. {r.label}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", textAlign: "right" }}>{formatKamas(r.cout)}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", textAlign: "right" }}>{r.points > 0 ? r.points.toLocaleString("fr-FR") : <span style={{ color: "var(--accent)", fontStyle: "italic" }}>à saisir</span>}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", textAlign: "right" }}>{complet ? fmtRatio(r.coutParPoint, 4) : "—"}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid rgba(91,71,51,.45)", textAlign: "right" }}>{complet ? fmtRatio(r.coutPour1000, 2) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h2>Mes sauvegardes de prix</h2>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
          Enregistre un jeu de prix nommé (ex. par serveur) pour le retrouver plus tard. Ça ne sauvegarde que
          les prix — les noms/quantités d'ingrédients restent partagés et intacts quelle que soit la sauvegarde chargée.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)", fontWeight: 700, flex: 1, minWidth: 220 }}>
            Nom de la sauvegarde
            <input
              className="field"
              placeholder="Ex. Prix du 26 juillet, serveur Draconiros…"
              value={nomSauvegarde}
              onChange={(e) => setNomSauvegarde(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enregistrerSauvegarde(); }}
            />
          </label>
          <button className="btn btn-coral" onClick={enregistrerSauvegarde}>Enregistrer</button>
        </div>
        {statut && <div style={{ color: "var(--green)", fontSize: 12, marginBottom: 10 }}>{statut}</div>}

        <input
          className="field"
          type="search"
          placeholder="Rechercher une sauvegarde…"
          value={rechercheSauvegarde}
          onChange={(e) => setRechercheSauvegarde(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <div style={{ display: "grid", gap: 8 }}>
          {!sauvegardesFiltrees.length && (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 16 }}>
              {sauvegardes.length ? "Aucune sauvegarde ne correspond à la recherche." : "Aucune sauvegarde nommée pour le moment."}
            </div>
          )}
          {sauvegardesFiltrees.map((s) => (
            <div key={s.id} className="row-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 10, border: "1px solid var(--line)", borderRadius: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{s.nom}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Jeu de prix · {new Date(s.enregistreLe).toLocaleString("fr-FR")}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" onClick={() => chargerSauvegarde(s.id)}>Charger</button>
                <button className="btn btn-ghost" style={{ color: "var(--red)" }} onClick={() => supprimerSauvegarde(s.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
