// Fonctions génériques (mathématiques/texte), indépendantes de toute table de
// couleurs — partagées entre muldos, dragodindes et volkornes. Tout ce qui
// touche aux couleurs/générations/recettes reste dupliqué par créature
// (choix délibéré : pas de moteur de croisement générique partagé).

// Couleurs des ancêtres connus d'une monture (parents, grands-parents, ...),
// jusqu'à `profondeur` générations en remontant `parentIds` — sert à élargir
// les couleurs "possibles" à la naissance (le croisement peut retomber sur la
// couleur d'un ancêtre plutôt que sur le résultat espéré de la recette).
// Générique : ne dépend d'aucune table de couleurs, juste des champs
// couleur/parentIds/id déjà communs aux 3 créatures.
export function couleursAncetres(muldo, cheptel, profondeur = 3) {
  const parId = new Map((cheptel || []).map((m) => [m.id, m]));
  const couleurs = new Set();
  let front = [muldo];
  for (let p = 0; p < profondeur; p += 1) {
    const suivant = [];
    front.forEach((m) => {
      (m?.parentIds || []).forEach((id) => {
        const parent = parId.get(id);
        if (parent && parent.couleur) {
          couleurs.add(parent.couleur);
          suivant.push(parent);
        }
      });
    });
    front = suivant;
    if (!front.length) break;
  }
  return couleurs;
}

// Affectation hongroise : meilleur score global, pas choix glouton couple par couple.
export function affectationMaximale(matrice) {
  const rows = matrice.length;
  const cols = rows ? matrice[0].length : 0;
  if (!rows || !cols) return [];
  const n = Math.max(rows, cols);
  const maxVal = Math.max(0, ...matrice.flat().filter(Number.isFinite));
  const cost = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const value = i < rows && j < cols ? matrice[i][j] : 0;
      return maxVal - Math.max(-1000000, value);
    })
  );

  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j += 1) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const out = [];
  for (let j = 1; j <= n; j += 1) {
    const i = p[j] - 1;
    const col = j - 1;
    if (i >= 0 && i < rows && col < cols) out.push([i, col]);
  }
  return out;
}

// ---------- Génération cible (mécanique de reproduction Dofus) ----------
// Remonte les parentIds sur `profondeur` niveaux (par défaut parents +
// grands-parents, l'arbre généalogique du jeu s'arrête là) et renvoie la
// génération de chaque ancêtre trouvé. `generationDeCouleurFn` est la
// fonction propre à chaque créature (couleur -> numéro de génération).
export function ancetresAvecGeneration(muldo, byId, generationDeCouleurFn, profondeur = 2) {
  const resultats = [];
  let front = [muldo];
  for (let distance = 1; distance <= profondeur; distance += 1) {
    const suivant = [];
    front.forEach((m) => {
      (m?.parentIds || []).forEach((id) => {
        const parent = byId?.[id];
        if (!parent || !parent.couleur) return;
        resultats.push({ couleur: parent.couleur, generation: generationDeCouleurFn(parent.couleur), distance });
        suivant.push(parent);
      });
    });
    front = suivant;
    if (!front.length) break;
  }
  return resultats;
}

// Génération cible d'un couple : la génération la plus haute atteignable
// compte tenu de la généalogie connue (parents + grands-parents). Par
// défaut (aucun ancêtre plus haut que les parents), c'est un cran au-dessus
// des parents ; si un ancêtre appartient déjà à une génération supérieure ou
// égale à cette cible naïve, la cible devient la génération de cet ancêtre.
export function calculerGenerationCible(a, b, byId, generationDeCouleurFn) {
  const genA = generationDeCouleurFn(a?.couleur);
  const genB = generationDeCouleurFn(b?.couleur);
  const cibleNaive = Math.max(genA, genB) + 1;

  const ancetres = [
    ...ancetresAvecGeneration(a, byId, generationDeCouleurFn),
    ...ancetresAvecGeneration(b, byId, generationDeCouleurFn),
  ];
  const genAncetreMax = ancetres.reduce((max, anc) => Math.max(max, anc.generation), 0);

  if (genAncetreMax >= cibleNaive) {
    return { generationCible: genAncetreMax, viaAncetre: true };
  }
  return { generationCible: cibleNaive, viaAncetre: false };
}

// Bonus de chance d'obtenir la génération cible : vérifié in-game sur 6
// accouplements (2026-07-25, captures avec % affiché) — base 30% si les DEUX
// parents sont de génération 1 ("pure race"), 40% dès qu'au moins un parent
// est déjà de génération ≥ 2 (porteur de génétique composite), toujours
// + 0.15% par niveau cumulé des deux parents, + 10% avec une Optimakina
// (non observé dans l'échantillon, conservé tel quel). Les niveaux inconnus
// (null/0) ne contribuent simplement rien — pas de saisie obligatoire sur
// tout le cheptel.
export function bonusProbabiliteGenerationCible({ niveauA = 0, niveauB = 0, optimakina = false, genMax = 1 } = {}) {
  const base = Number(genMax) >= 2 ? 40 : 30;
  const bonusNiveau = ((Number(niveauA) || 0) + (Number(niveauB) || 0)) * 0.15;
  const bonusOptimakina = optimakina ? 10 : 0;
  return Math.min(100, Math.round((base + bonusNiveau + bonusOptimakina) * 100) / 100);
}

// ---------- Choix automatique d'objectif GPS (mode succès/couleur/génération/collection) ----------
// Générique : reçoit la table des générations et les fonctions propres à
// chaque créature (reproductible, meilleure recette, génération d'une
// couleur) au lieu de dépendre de globales par créature.
export function choisirObjectifGpsAutomatique({
  mode,
  objectifCouleur,
  generationCible,
  generationMin,
  generationMax,
  cheptel,
  historiqueCouleurs,
  generationsTable,
  reproductibleFn,
  meilleureRecetteFn,
  generationDeCouleurFn,
}) {
  if (mode === "couleur") {
    return {
      objectif: objectifCouleur,
      raison: "Couleur choisie manuellement.",
      candidats: [objectifCouleur],
    };
  }

  const presentes = new Set(cheptel.map((m) => m.couleur));
  const estDecouverte = (couleur) => Boolean(historiqueCouleurs[couleur]) || presentes.has(couleur);
  const stock = cheptel.reduce((acc, m) => {
    if (reproductibleFn(m)) acc[m.couleur] = (acc[m.couleur] || 0) + 1;
    return acc;
  }, {});

  // Mode "succès" : on complète les générations dans l'ordre. On saute celles
  // déjà entièrement découvertes et on vise la première génération incomplète.
  let generationSucces = null;
  if (mode === "succes") {
    for (let g = 1; g <= 10; g += 1) {
      const couleurs = generationsTable[g] || [];
      if (couleurs.length && couleurs.some((c) => !estDecouverte(c))) { generationSucces = g; break; }
    }
    if (generationSucces === null) {
      return { objectif: objectifCouleur, raison: "Bravo — toutes les générations 1 à 10 sont complétées ! 🏆", candidats: [], complete: true };
    }
  }

  let candidats = [];
  if (mode === "generation") {
    candidats = [...(generationsTable[Number(generationCible)] || [])];
  } else if (mode === "succes") {
    candidats = [...(generationsTable[generationSucces] || [])];
  } else {
    const min = Math.min(Number(generationMin), Number(generationMax));
    const max = Math.max(Number(generationMin), Number(generationMax));
    for (let g = min; g <= max; g += 1) candidats.push(...(generationsTable[g] || []));
  }

  const manquantes = candidats.filter((c) => !estDecouverte(c));
  if (!manquantes.length) {
    return {
      objectif: candidats[0] || objectifCouleur,
      raison: mode === "generation"
        ? `Génération ${generationCible} déjà complétée.`
        : `Toutes les générations ${generationMin} à ${generationMax} sont complétées.`,
      candidats,
      complete: true,
    };
  }

  const classees = manquantes
    .map((couleur) => {
      const estimation = meilleureRecetteFn(couleur, stock);
      return {
        couleur,
        cout: Number.isFinite(estimation?.cout) ? estimation.cout : 999,
        generation: generationDeCouleurFn(couleur),
      };
    })
    .sort((a, b) => {
      if (mode === "collection" && a.generation !== b.generation) return a.generation - b.generation;
      if (a.cout !== b.cout) return a.cout - b.cout;
      return b.generation - a.generation;
    });

  const choix = classees[0];
  return {
    objectif: choix.couleur,
    raison: mode === "succes"
      ? `Succès : génération ${generationSucces} à compléter — couleur manquante la plus accessible.`
      : mode === "generation"
        ? `Couleur manquante de génération ${generationCible} estimée la plus accessible.`
        : `Première couleur manquante accessible dans la progression des générations ${generationMin} à ${generationMax}.`,
    candidats: manquantes,
    complete: false,
    cout: choix.cout,
    generationSucces,
  };
}

export function distanceLevenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 2) return 99; // au-delà de la tolérance max, inutile de calculer
  const ligne = new Array(lb + 1);
  for (let j = 0; j <= lb; j += 1) ligne[j] = j;
  for (let i = 1; i <= la; i += 1) {
    let diagonale = ligne[0];
    ligne[0] = i;
    for (let j = 1; j <= lb; j += 1) {
      const memo = ligne[j];
      ligne[j] = Math.min(
        ligne[j] + 1,
        ligne[j - 1] + 1,
        diagonale + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonale = memo;
    }
  }
  return ligne[lb];
}
