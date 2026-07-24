// Panneaux d'élevage génériques, partagés entre muldo/dragodinde/volkorne
// (contrairement au moteur génétique par couleur, volontairement dupliqué
// par créature — voir geneticsUtils.js). Chaque composant reçoit les bouts
// spécifiques à la créature appelante en props (BadgeComponent,
// generationDeCouleurFn, plierCouleurFn, couleursToutes...).
import { useState } from "react";
import { Trash2 } from "lucide-react";

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
