// Fonctions génériques (mathématiques/texte), indépendantes de toute table de
// couleurs — partagées entre muldos, dragodindes et volkornes. Tout ce qui
// touche aux couleurs/générations/recettes reste dupliqué par créature
// (choix délibéré : pas de moteur de croisement générique partagé).

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
