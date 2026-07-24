// Panneaux d'élevage génériques, partagés entre muldo/dragodinde/volkorne
// (contrairement au moteur génétique par couleur, volontairement dupliqué
// par créature — voir geneticsUtils.js). Chaque composant reçoit les bouts
// spécifiques à la créature appelante en props (BadgeComponent,
// generationDeCouleurFn, plierCouleurFn, couleursToutes...).
import { useState } from "react";
import { Trash2 } from "lucide-react";

export async function copierPressePapiers(texte) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texte);
    } else {
      const zone = document.createElement("textarea");
      zone.value = texte;
      document.body.appendChild(zone);
      zone.select();
      document.execCommand("copy");
      document.body.removeChild(zone);
    }
    return true;
  } catch (e) {
    console.error("Copie impossible", e);
    return false;
  }
}

// ---------- Derniers bébés à renommer en jeu ----------
export function BebesARenommerPanel({ journal, BadgeComponent }) {
  const [copie, setCopie] = useState(null);
  // On n'affiche que la DERNIÈRE portée : le dernier bébé confirmé, plus le
  // précédent uniquement s'il vient du même couple juste avant (portée double
  // Reproducteur). Au-delà, impossible de savoir quel nom copier — les anciens
  // noms restent consultables sur les fiches du cheptel.
  const nommes = (journal || []).filter((n) => n.nom);
  const dernier = nommes[nommes.length - 1];
  if (!dernier) return null;
  const precedent = nommes[nommes.length - 2];
  const memePortee = precedent
    && precedent.male === dernier.male
    && precedent.femelle === dernier.femelle
    && Math.abs(new Date(dernier.date) - new Date(precedent.date)) < 10 * 60 * 1000;
  const recents = memePortee ? [dernier, precedent] : [dernier];

  const copier = async (nom) => {
    if (await copierPressePapiers(nom)) {
      setCopie(nom);
      setTimeout(() => setCopie((c) => (c === nom ? null : c)), 1500);
    }
  };

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <b>{recents.length > 1 ? "Dernière portée — à renommer en jeu" : "Dernier bébé — à renommer en jeu"}</b>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
        Le nom est copié automatiquement à la naissance ; récupère-le ici si besoin (« Copier » puis
        Ctrl+V dans le renommage en jeu). Seule la dernière portée s'affiche — les noms plus anciens
        restent sur les fiches du cheptel.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {recents.map((n, i) => (
          <div key={`${n.nom}-${i}`} style={{
            display: "flex", alignItems: "center", gap: 8,
            border: "1px solid var(--line)", borderRadius: 12, padding: "7px 10px",
            background: "rgba(0,0,0,.15)",
          }}>
            <BadgeComponent couleur={n.obtenu} taille={18} />
            <span style={{ fontSize: 13 }}>
              {n.obtenu} {n.sexe === "F" ? "♀" : "♂"} ·{" "}
              <b style={{ color: "var(--gold2)", letterSpacing: .4 }}>{n.nom}</b>
              <span style={{ color: "var(--muted)", fontSize: 11 }}> · {new Date(n.date).toLocaleDateString("fr-FR")}</span>
            </span>
            <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => copier(n.nom)}>
              {copie === n.nom ? "✓ copié" : "Copier"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Corbeille (suppression douce) ----------
export function CorbeillePanel({ corbeille, onRestaurer, onPurger, onVider, dureeJours = 30 }) {
  const [ouvert, setOuvert] = useState(false);
  if (!corbeille.length) return null;
  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setOuvert((o) => !o)}>
        <div>
          <b>🗑️ Corbeille</b>
          <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>
            {corbeille.length} monture(s) supprimée(s) récemment — restaurables {dureeJours} jours
          </span>
        </div>
        <span style={{ color: "var(--gold2)" }}>{ouvert ? "▾" : "▸"}</span>
      </div>
      {ouvert && (
        <div style={{ marginTop: 12 }}>
          {corbeille.map(({ muldo, supprimeLe }) => (
            <div key={muldo.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.05)", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13 }}>
                <b>{muldo.nom || muldo.couleur}</b>
                <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                  {muldo.couleur} · G{muldo.generation} · supprimé le {new Date(supprimeLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => onRestaurer(muldo.id)}>↩ Restaurer</button>
                <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12, color: "var(--red)" }} onClick={() => onPurger(muldo.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={onVider}>Vider la corbeille</button>
        </div>
      )}
    </div>
  );
}

// ---------- Liste de courses ----------
// Pour chaque (couleur, sexe) absent du stock, combien de montures
// aujourd'hui sans partenaire deviendraient appariables si on l'ajoutait
// (capture ou HDV). Majorant honnête : "jusqu'à X couples".
function calculerListeCourses(restants, { sexeFn, couleurEstCanoniqueFn, couleursToutes, resultatsParCouple, cleCoupleCouleursFn, generationDeCouleurFn }) {
  const besoins = new Map();
  (restants || []).forEach((m) => {
    const s = sexeFn(m);
    if (!s || !couleurEstCanoniqueFn(m.couleur)) return;
    const sexeVoulu = s === "M" ? "F" : "M";
    couleursToutes.forEach((partenaire) => {
      const recettes = resultatsParCouple[cleCoupleCouleursFn(m.couleur, partenaire)] || [];
      if (!recettes.length) return;
      const cle = `${partenaire}|${sexeVoulu}`;
      besoins.set(cle, (besoins.get(cle) || 0) + 1);
    });
  });
  return [...besoins.entries()]
    .map(([cle, impact]) => {
      const [couleur, sexe] = cle.split("|");
      return { couleur, sexe, impact, generation: generationDeCouleurFn(couleur) };
    })
    .sort((a, b) => b.impact - a.impact || a.generation - b.generation)
    .slice(0, 12);
}

export function ListeCoursesPanel({
  restants,
  BadgeComponent,
  sexeFn,
  couleurEstCanoniqueFn,
  couleursToutes,
  resultatsParCouple,
  cleCoupleCouleursFn,
  generationDeCouleurFn,
  lieuCapture,
}) {
  const [ouvert, setOuvert] = useState(false);
  if (!restants || !restants.length) return null;
  const courses = calculerListeCourses(restants, { sexeFn, couleurEstCanoniqueFn, couleursToutes, resultatsParCouple, cleCoupleCouleursFn, generationDeCouleurFn });
  if (!courses.length) return null;
  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOuvert((o) => !o)}>
        <h2 style={{ margin: 0 }}>Liste de courses {ouvert ? "▾" : "▸"}</h2>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>quoi capturer/acheter pour débloquer tes {restants.length} sans-partenaire</span>
      </div>
      {ouvert && (
        <div style={{ marginTop: 10 }}>
          {courses.map((c) => (
            <div key={`${c.couleur}|${c.sexe}`} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,.04)", flexWrap: "wrap" }}>
              <b>{c.sexe === "F" ? "♀" : "♂"} <BadgeComponent couleur={c.couleur} taille={16} /> {c.couleur}</b>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                G{c.generation} · débloquerait jusqu'à {c.impact} couple(s)
                {c.generation === 1 ? ` · capturable ${lieuCapture}` : " · via HDV, élevage ou clonage"}
              </span>
            </div>
          ))}
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 6 }}>
            Impact = nombre de tes montures sans partenaire qui ont une recette avec cette couleur. Un même
            achat ne débloque qu'un couple à la fois : c'est un plafond, pas une garantie.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Statistiques de croisements ----------
// N'a besoin que du journal (male/femelle/espere/obtenu/type), déjà la même
// forme pour les 3 créatures.
export function StatsCroisementsPanel({ journal }) {
  const [ouvert, setOuvert] = useState(false);
  const naissances = (journal || []).filter((n) => !n.type); // naissances uniquement (ni clonage, ni ajout manuel)
  if (!naissances.length) return null;

  const parCouple = new Map();
  naissances.forEach((n) => {
    const cle = `${n.male} × ${n.femelle}`;
    if (!parCouple.has(cle)) parCouple.set(cle, { cle, male: n.male, femelle: n.femelle, total: 0, espere: n.espere, reussites: 0, resultats: new Map() });
    const g = parCouple.get(cle);
    g.total += 1;
    if (n.espere && n.obtenu === n.espere) g.reussites += 1;
    g.resultats.set(n.obtenu, (g.resultats.get(n.obtenu) || 0) + 1);
  });
  const groupes = [...parCouple.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOuvert((o) => !o)}>
        <h2 style={{ margin: 0 }}>Statistiques de croisements {ouvert ? "▾" : "▸"}</h2>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{naissances.length} naissance(s) enregistrée(s)</span>
      </div>
      {ouvert && groupes.map((g) => {
        const distribution = [...g.resultats.entries()]
          .sort((x, y) => y[1] - x[1])
          .map(([couleur, n]) => `${couleur} ×${n} (${Math.round(n / g.total * 100)}%)`)
          .join(" · ");
        return (
          <div key={g.cle} style={{ borderTop: "1px solid rgba(255,255,255,.06)", marginTop: 10, paddingTop: 10, fontSize: 13 }}>
            <b>♂ {g.male} × ♀ {g.femelle}</b>
            <span style={{ color: "var(--muted)" }}> · {g.total} naissance(s)</span>
            {g.espere && (
              <span style={{ color: "var(--gold)" }}> · {g.espere} obtenu {g.reussites}/{g.total} ({Math.round(g.reussites / g.total * 100)}%)</span>
            )}
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{distribution}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Arbre généalogique ----------
export function ArbreGenealogiquePanel({ cheptel, onSelect, sexeFn, plierCouleurFn }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [choisiId, setChoisiId] = useState(null);

  const parId = new Map((cheptel || []).map((m) => [m.id, m]));
  const enfantsDe = new Map();
  (cheptel || []).forEach((m) => {
    (m.parentIds || m.parents || []).forEach((pid) => {
      if (!enfantsDe.has(pid)) enfantsDe.set(pid, []);
      enfantsDe.get(pid).push(m);
    });
  });

  // Seuls les montures reliées à une généalogie (parents connus OU descendants) sont proposables.
  const relies = (cheptel || []).filter((m) => (m.parentIds || m.parents || []).length || enfantsDe.has(m.id));
  const prefixe = plierCouleurFn(recherche.trim());
  const suggestions = prefixe
    ? relies.filter((m) => plierCouleurFn(m.nom || "").startsWith(prefixe) || plierCouleurFn(m.couleur || "").startsWith(prefixe)).slice(0, 8)
    : [];
  const choisi = choisiId ? parId.get(choisiId) : null;

  const etiquette = (m) => `${m.nom || m.id?.slice(0, 6)} — ${m.couleur} ${sexeFn(m) === "F" ? "♀" : sexeFn(m) === "M" ? "♂" : "?"}${m.sterile ? " (stérile)" : ""}`;
  const ligneMuldo = (m, retrait) => (
    <div key={`${m.id}-${retrait}`} style={{ paddingLeft: retrait * 18, fontSize: 13, padding: "3px 0", paddingInlineStart: retrait * 18 }}>
      <button
        type="button"
        onClick={() => setChoisiId(m.id)}
        style={{ background: "none", border: "none", padding: 0, color: m.id === choisiId ? "var(--gold)" : "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
      >
        {etiquette(m)}
      </button>
      {onSelect && (
        <button type="button" className="btn btn-ghost" style={{ marginLeft: 8, padding: "0 6px", fontSize: 11 }} onClick={() => onSelect(m.id)}>
          fiche
        </button>
      )}
    </div>
  );

  const parentsDe = (m) => (m?.parentIds || m?.parents || []).map((id) => parId.get(id)).filter(Boolean);

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOuvert((o) => !o)}>
        <h2 style={{ margin: 0 }}>Arbre généalogique {ouvert ? "▾" : "▸"}</h2>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {(cheptel || []).filter((m) => (m.parentIds || m.parents || []).length).length} monture(s) à généalogie connue
        </span>
      </div>
      {!ouvert ? null : (<>
      <div style={{ color: "var(--muted)", fontSize: 12, margin: "8px 0" }}>
        Recherche une monture par son nom court ou sa couleur — seules les montures à généalogie
        connue (nées dans l'appli ou parents enregistrés) apparaissent.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="field"
          placeholder="Nom ou couleur…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{ width: 230, padding: "4px 8px", fontSize: 12 }}
        />
        {suggestions.map((m) => (
          <button
            key={m.id}
            className="btn btn-ghost"
            style={m.id === choisiId ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
            onClick={() => setChoisiId(m.id)}
          >
            {m.nom || m.couleur}
          </button>
        ))}
        {prefixe && !suggestions.length && (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>aucune monture à généalogie connue ne correspond</span>
        )}
        {!relies.length && (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            (aucune généalogie pour l'instant : elle se construit à chaque naissance confirmée)
          </span>
        )}
      </div>

      {choisi && (
        <div style={{ marginTop: 12 }}>
          {(() => {
            const parents = parentsDe(choisi);
            const grandsParents = parents.flatMap((p) => parentsDe(p));
            const enfants = enfantsDe.get(choisi.id) || [];
            const petitsEnfants = enfants.flatMap((e) => enfantsDe.get(e.id) || []);
            const section = (titre, liste, retrait) => liste.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: "var(--gold)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{titre}</div>
                {liste.map((m) => ligneMuldo(m, retrait))}
              </div>
            );
            return (
              <>
                {section("Grands-parents", grandsParents, 0)}
                {section("Parents", parents, 1)}
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--gold)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>Monture sélectionnée</div>
                  <div style={{ paddingLeft: 36, fontSize: 13, fontWeight: 700, padding: "3px 0", paddingInlineStart: 36 }}>{etiquette(choisi)}</div>
                </div>
                {section("Enfants", enfants, 3)}
                {section("Petits-enfants", petitsEnfants, 4)}
                {!parents.length && !enfants.length && (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>Ni parents ni descendants connus pour cette monture.</div>
                )}
              </>
            );
          })()}
        </div>
      )}
      </>)}
    </div>
  );
}

// ---------- Naissances à confirmer ----------
// La naissance est immédiate et garantie, mais pas forcément le résultat de
// la recette (le RNG du jeu peut retomber sur la couleur d'un parent ou d'un
// ancêtre) : on confirme la couleur réellement obtenue avant de créer la fiche.
export function NaissancesEnAttentePanel({
  naissances,
  onConfirmer,
  onSupprimer,
  BadgeComponent,
  generationDeCouleurFn,
  plierCouleurFn,
  couleursToutes,
  supporteReproducteur = true,
}) {
  const [choix, setChoix] = useState({});
  if (!naissances || !naissances.length) return null;

  const setC = (id, patch) => setChoix((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Naissances à confirmer ({naissances.length})</h2>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
        La naissance est immédiate et garantie : confirme la couleur <b>réellement obtenue</b> — le
        croisement peut retomber sur la couleur d'un parent ou d'un ancêtre au lieu du résultat
        espéré — puis le sexe.
      </div>
      {naissances.map((n) => {
        const c = choix[n.id] || {};
        return (
          <div key={n.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 13 }}>
              <b>{n.maleCouleur} ♂ × {n.femelleCouleur} ♀</b>
              {n.second && (
                <span style={{ color: "var(--gold)", fontWeight: 700 }}> · Bébé 2/2 — confirme le second de la portée</span>
              )}
              {n.resultatEspere && (
                <span style={{ color: "var(--muted)" }}> · espéré : {n.resultatEspere}</span>
              )}
              <span style={{ color: "var(--muted)" }}> · lancé le {new Date(n.date).toLocaleDateString("fr-FR")}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
              {(n.possibles || []).map((couleur) => (
                <button
                  key={couleur}
                  className="btn btn-ghost"
                  style={c.couleur === couleur ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
                  onClick={() => setC(n.id, { couleur })}
                >
                  <BadgeComponent couleur={couleur} taille={16} />{" "}{couleur}{n.resultatEspere === couleur ? " ★" : ""}
                </button>
              ))}
              <div style={{ position: "relative" }}>
                <input
                  className="field"
                  placeholder="Autre couleur : tape les premières lettres…"
                  value={c.recherche || ""}
                  onChange={(e) => setC(n.id, { recherche: e.target.value, ferme: false })}
                  title="La généalogie des parents peut faire naître d'autres couleurs (ancêtres) — la recherche filtre par début de nom"
                  style={{ width: 240, padding: "4px 8px", fontSize: 12 }}
                />
                {(() => {
                  const recherche = (c.recherche || "").trim();
                  if (!recherche || c.ferme) return null;
                  // Filtre par PRÉFIXE replié (sans accents/casse) : "d" liste
                  // TOUTES les couleurs commençant par d (Doré, Doré et Amande,
                  // Doré et Indigo…) mais pas Roux et Doré. Chaque lettre affine.
                  const prefixe = plierCouleurFn(recherche);
                  const suggestions = [...new Set(couleursToutes)]
                    .filter((couleur) => plierCouleurFn(couleur).startsWith(prefixe))
                    .sort((x, y) => x.localeCompare(y, "fr"));
                  return (
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      zIndex: 20,
                      minWidth: 240,
                      maxHeight: 230,
                      overflowY: "auto",
                      background: "var(--panel, #1d1710)",
                      border: "1px solid var(--gold)",
                      borderRadius: 10,
                      boxShadow: "0 12px 30px rgba(0,0,0,.45)",
                      padding: 4,
                    }}>
                      {suggestions.length === 0 && (
                        <div style={{ color: "var(--muted)", fontSize: 12, padding: "6px 8px" }}>
                          aucune couleur ne commence par « {recherche} »
                        </div>
                      )}
                      {suggestions.map((couleur) => (
                        <div
                          key={couleur}
                          onClick={() => setC(n.id, { couleur, recherche: couleur, ferme: true })}
                          style={{
                            padding: "5px 8px",
                            fontSize: 13,
                            cursor: "pointer",
                            borderRadius: 6,
                            color: c.couleur === couleur ? "var(--gold)" : "inherit",
                            fontWeight: c.couleur === couleur ? 700 : 400,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <BadgeComponent couleur={couleur} taille={16} />{" "}{couleur} <span style={{ color: "var(--muted)", fontSize: 11 }}>G{generationDeCouleurFn(couleur)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {c.couleur && !(n.possibles || []).includes(c.couleur) && (
                <span style={{ color: "var(--gold)", fontSize: 12 }}>→ {c.couleur}</span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
              <button
                className="btn btn-ghost"
                style={c.sexe === "M" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
                onClick={() => setC(n.id, { sexe: "M" })}
              >
                ♂ Mâle
              </button>
              <button
                className="btn btn-ghost"
                style={c.sexe === "F" ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}
                onClick={() => setC(n.id, { sexe: "F" })}
              >
                ♀ Femelle
              </button>
              {supporteReproducteur && !n.second && (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted)", fontSize: 12 }} title="Capacité Reproducteur : la portée compte 2 bébés, chacun avec sa couleur et son sexe">
                  <input
                    type="checkbox"
                    checked={!!c.deuxBebes}
                    onChange={(e) => setC(n.id, { deuxBebes: e.target.checked })}
                  />
                  2 bébés (Reproducteur)
                </label>
              )}
              <button
                className="btn"
                disabled={!c.couleur || !c.sexe}
                style={!c.couleur || !c.sexe ? { opacity: 0.5 } : undefined}
                onClick={() => {
                  const encoreUn = !n.second && !!c.deuxBebes;
                  onConfirmer(n.id, c.couleur, c.sexe, encoreUn);
                  // Réinitialise la saisie (prête pour le 2e bébé le cas échéant)
                  setChoix((prev) => ({ ...prev, [n.id]: {} }));
                }}
              >
                {n.second ? "Confirmer le 2e bébé" : c.deuxBebes ? "Confirmer le bébé 1/2" : "Confirmer la naissance"}
              </button>
              <button className="btn btn-ghost" onClick={() => onSupprimer(n.id)} title="Erreur de clic : retire l'entrée sans toucher aux parents">
                Retirer (erreur)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
