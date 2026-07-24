// Panneaux d'élevage génériques, partagés entre muldo/dragodinde/volkorne
// (contrairement au moteur génétique par couleur, volontairement dupliqué
// par créature — voir geneticsUtils.js). Chaque composant reçoit les bouts
// spécifiques à la créature appelante en props (BadgeComponent,
// generationDeCouleurFn, plierCouleurFn, couleursToutes...).
import { useState, useMemo, useEffect } from "react";
import { Trash2, ChevronRight } from "lucide-react";
import { COLORS } from "./muldoGenetique.js";
import { supabase } from "./supabaseClient.js";

// Nom de serveur Dofus — texte libre (pas de liste figée qui deviendrait vite
// obsolète), partagé entre les 3 créatures : un joueur ne change pas de
// serveur d'une page d'estimation à l'autre.
const STORAGE_SERVEUR = "muldo-serveur-v1";

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

// ---------- Nom / couleur copiables en un clic ----------
export function CouleurCopiable({ couleur, gras = true, BadgeComponent }) {
  const [copie, setCopie] = useState(false);
  const onClick = async (e) => {
    e.stopPropagation();
    if (await copierPressePapiers(couleur)) {
      setCopie(true);
      setTimeout(() => setCopie(false), 1200);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Copier « ${couleur} » pour la recherche HDV`}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: "inherit",
        font: "inherit",
        fontWeight: gras ? 700 : "inherit",
        cursor: "pointer",
        textDecoration: "underline dotted",
        textUnderlineOffset: 3,
      }}
    >
      {BadgeComponent && <BadgeComponent couleur={couleur} taille={18} />}{" "}{couleur}{copie ? " ✓" : ""}
    </button>
  );
}

export function NomCopiable({ nom, gras = true }) {
  const [copie, setCopie] = useState(false);
  const onClick = async (e) => {
    e.stopPropagation();
    if (await copierPressePapiers(nom)) {
      setCopie(true);
      setTimeout(() => setCopie(false), 1200);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Copier « ${nom} »`}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: "inherit",
        font: "inherit",
        fontWeight: gras ? 700 : "inherit",
        cursor: "pointer",
        textDecoration: "underline dotted",
        textUnderlineOffset: 3,
      }}
    >
      {nom}{copie ? " ✓" : ""}
    </button>
  );
}

// ---------- Export de fiche en image ----------
export function exporterFicheImage(muldo, { teintesFn, slugFn, nomCreature }) {
  const largeur = 900, hauteur = 520;
  const canvas = document.createElement("canvas");
  canvas.width = largeur; canvas.height = hauteur;
  const ctx = canvas.getContext("2d");

  const degrade = ctx.createLinearGradient(0, 0, largeur, hauteur);
  degrade.addColorStop(0, "#2b241d");
  degrade.addColorStop(1, "#17130f");
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, largeur, hauteur);

  ctx.strokeStyle = "#d6a64a";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, largeur - 20, hauteur - 20);

  const teintes = teintesFn(muldo.couleur);
  const cx = 165, cy = 260, r = 120;
  ctx.save();
  if (teintes.length >= 2) {
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2); ctx.closePath();
    ctx.fillStyle = teintes[1]; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2); ctx.closePath();
    ctx.fillStyle = teintes[0]; ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = teintes[0]; ctx.fill();
  }
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  const gaucheTexte = 340;
  const largeurDispoTitre = largeur - gaucheTexte - 30;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f4ead4";
  let tailleTitre = 44;
  const titre = muldo.nom || muldo.couleur;
  ctx.font = `bold ${tailleTitre}px Georgia, 'Iowan Old Style', serif`;
  while (tailleTitre > 22 && ctx.measureText(titre).width > largeurDispoTitre) {
    tailleTitre -= 2;
    ctx.font = `bold ${tailleTitre}px Georgia, 'Iowan Old Style', serif`;
  }
  ctx.fillText(titre, gaucheTexte, 150);

  ctx.fillStyle = "#d6a64a";
  ctx.font = "600 24px Georgia, serif";
  ctx.fillText(muldo.couleur, gaucheTexte, 190);

  const lignes = [
    `Génération ${muldo.generation}`,
    `${muldo.sexe === "F" ? "♀ Femelle" : "♂ Mâle"}`,
    `${muldo.statut || (muldo.sterile ? "Stérile" : "Fertile")}`,
  ];
  ctx.fillStyle = "#c9bfae";
  ctx.font = "22px Georgia, sans-serif";
  lignes.forEach((ligne, i) => ctx.fillText(ligne, gaucheTexte, 245 + i * 36));

  ctx.fillStyle = "rgba(244,234,212,.55)";
  ctx.font = "16px Georgia, sans-serif";
  ctx.fillText(`🍺 Registre des Abysses — élevage de ${nomCreature}`, gaucheTexte, hauteur - 50);
  ctx.font = "13px Georgia, sans-serif";
  ctx.fillText("Projet communautaire non affilié à Ankama.", gaucheTexte, hauteur - 28);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `${slugFn(muldo.couleur)}-${(muldo.nom || "fiche").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }, "image/png");
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
              <b>{c.sexe === "F" ? "♀" : "♂"} <CouleurCopiable couleur={c.couleur} BadgeComponent={BadgeComponent} /></b>
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

// ---------- Bouton "Fiche" (ouvre la fiche détail d'une monture) ----------
export function BoutonFiche({ id, onVoir, label }) {
  if (!onVoir || !id) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost"
      title={`Ouvrir la fiche${label ? " de " + label : ""}`}
      style={{ padding: "2px 7px", fontSize: 11, lineHeight: 1.4 }}
      onClick={() => onVoir(id)}
    >
      🔍 Fiche
    </button>
  );
}

// ---------- Page GPS (objectif intelligent + session + plan d'accouplement) ----------
// Générique : reçoit tout ce qui dépend de la créature (couleurs, badge,
// fonctions de génération/canonicalisation, table des générations, libellés)
// en props. Copié fidèlement depuis App.jsx (muldo) — voir le plan de parité
// GPS pour le détail des risques (suivi de session à ne pas réinventer).
export function GpsDofusPage({
  session,
  mode,
  setMode,
  objectif,
  objectifCouleur,
  setObjectifCouleur,
  generationCible,
  setGenerationCible,
  generationMin,
  setGenerationMin,
  generationMax,
  setGenerationMax,
  choixObjectif,
  progressionGenerations,
  purification,
  setPurification,
  optimakina,
  setOptimakina,
  niveauMinimumSession,
  setNiveauMinimumSession,
  suivi,
  naissances,
  journal,
  onConfirmerNaissance,
  onSupprimerNaissance,
  onRealiserUn,
  onTerminerGroupe,
  onAnnuler,
  onReinitialiser,
  onDemarrerNouvelleSession,
  onNettoyerSterilesPuisDemarrer,
  onVoirMuldo,
  BadgeComponent,
  generationDeCouleurFn,
  plierCouleurFn,
  couleursToutes,
  generationsTable,
  sexeFn,
  couleurEstCanoniqueFn,
  resultatsParCouple,
  cleCoupleCouleursFn,
  lieuCapture,
  nomObjectifLabel = "Muldo objectif",
  nomEntitePluriel = "Muldos",
  supporteReproducteur = true,
  onPartagerTaverne,
}) {
  const [etapesOuvertes, setEtapesOuvertes] = useState({});
  const toggleEtapes = (key) => {
    setEtapesOuvertes((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const [forcerJaugesNettoyage, setForcerJaugesNettoyage] = useState(false);
  const [planCopie, setPlanCopie] = useState(false);

  const resumeTextePlan = () => {
    const lignes = (session.groupes || []).map((g) =>
      `${g.quantite}x ${g.male.couleur} × ${g.femelle.couleur} → ${g.resultat || "?"}`
    );
    const entete = `Plan GPS ${nomEntitePluriel}${objectif ? ` — objectif ${objectif}` : ""}`;
    return lignes.length ? `${entete}\n${lignes.join("\n")}` : `${entete}\nAucun croisement possible avec le cheptel actuel.`;
  };
  const copierPlan = async () => {
    if (await copierPressePapiers(resumeTextePlan())) {
      setPlanCopie(true);
      setTimeout(() => setPlanCopie(false), 1500);
    }
  };

  const pct = session.totalFertiles
    ? Math.round(session.utilises / session.totalFertiles * 100)
    : 0;
  const realises = (suivi?.historique || []).length;
  const totalInitial = Math.max(
    Number(suivi?.totalInitial || 0),
    realises + session.couples.length
  );
  const progression = totalInitial
    ? Math.round(realises / totalInitial * 100)
    : 0;

  const generationsAffichees = (progressionGenerations || []).filter((g) => {
    if (mode === "generation") return g.generation === Number(generationCible);
    if (mode === "collection") {
      const min = Math.min(Number(generationMin), Number(generationMax));
      const max = Math.max(Number(generationMin), Number(generationMax));
      return g.generation >= min && g.generation <= max;
    }
    return g.generation >= 2;
  });

  return (
    <div>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{
            color: "var(--gold)",
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: 1.6,
            textTransform: "uppercase",
          }}>
            GPS session complète
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>
            Objectif intelligent
          </h1>
          <div style={{ color: "var(--muted)", marginTop: 7 }}>
            Le plan est recalculé après chaque accouplement réalisé.
          </div>
        </div>
        {(session.groupes || []).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={copierPlan}>{planCopie ? "✓ Copié" : "📋 Copier le plan"}</button>
            {onPartagerTaverne && (
              <button className="btn btn-ghost" onClick={() => onPartagerTaverne(resumeTextePlan())}>🍻 Partager dans la Taverne</button>
            )}
          </div>
        )}
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}>
          {[
            ["succes", "Succès 🏆", "Compléter les générations dans l'ordre"],
            ["couleur", "Une couleur", `Produire un ${nomObjectifLabel.split(" ")[0]} précis`],
            ["generation", "Une génération", "Compléter une génération choisie"],
            ["collection", "Collection", "Compléter une plage de générations"],
          ].map(([value, titre, detail]) => (
            <button
              key={value}
              className={`btn ${mode === value ? "btn-coral" : "btn-ghost"}`}
              style={{
                minHeight: 74,
                flexDirection: "column",
                alignItems: "flex-start",
                textAlign: "left",
              }}
              onClick={() => setMode(value)}
            >
              <span>{titre}</span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                opacity: .78,
              }}>
                {detail}
              </span>
            </button>
          ))}
        </div>

        {mode === "couleur" && (
          <div>
            <label style={{
              display: "block",
              fontSize: 11,
              color: "var(--muted)",
              marginBottom: 6,
            }}>
              {nomObjectifLabel}
            </label>
            <select
              className="field"
              value={objectifCouleur}
              onChange={(e) => setObjectifCouleur(e.target.value)}
            >
              {couleursToutes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {mode === "generation" && (
          <div>
            <label style={{
              display: "block",
              fontSize: 11,
              color: "var(--muted)",
              marginBottom: 6,
            }}>
              Génération à compléter
            </label>
            <select
              className="field"
              value={generationCible}
              onChange={(e) => setGenerationCible(Number(e.target.value))}
            >
              {Object.keys(generationsTable).map((g) => (
                <option key={g} value={g}>Génération {g}</option>
              ))}
            </select>
          </div>
        )}

        {mode === "collection" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "end",
            gap: 12,
          }}>
            <div>
              <label style={{
                display: "block",
                fontSize: 11,
                color: "var(--muted)",
                marginBottom: 6,
              }}>
                Génération de départ
              </label>
              <select
                className="field"
                value={generationMin}
                onChange={(e) => setGenerationMin(Number(e.target.value))}
              >
                {Object.keys(generationsTable).map((g) => (
                  <option key={g} value={g}>Génération {g}</option>
                ))}
              </select>
            </div>
            <div style={{
              color: "var(--gold2)",
              fontWeight: 950,
              paddingBottom: 10,
            }}>
              →
            </div>
            <div>
              <label style={{
                display: "block",
                fontSize: 11,
                color: "var(--muted)",
                marginBottom: 6,
              }}>
                Génération finale
              </label>
              <select
                className="field"
                value={generationMax}
                onChange={(e) => setGenerationMax(Number(e.target.value))}
              >
                {Object.keys(generationsTable).map((g) => (
                  <option key={g} value={g}>Génération {g}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 14,
          border: "1px solid var(--gold)",
          background: "rgba(214,166,74,.08)",
        }}>
          <div style={{
            color: "var(--muted)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}>
            Objectif actuellement choisi par le GPS
          </div>
          <div style={{
            fontSize: 25,
            fontWeight: 950,
            color: "var(--gold2)",
            marginTop: 4,
          }}>
            {objectif}
          </div>
          <div style={{
            color: "var(--muted)",
            fontSize: 12,
            marginTop: 5,
          }}>
            {choixObjectif?.raison}
          </div>
          {choixObjectif?.complete && (
            <div style={{
              color: "var(--green)",
              fontWeight: 900,
              marginTop: 8,
            }}>
              ✓ Objectif de collection déjà complété
            </div>
          )}
        </div>
      </div>

      {mode !== "couleur" && (
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}>
            <b>Progression des générations</b>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              Une couleur déjà possédée ou validée compte comme découverte.
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 10,
          }}>
            {generationsAffichees.map((g) => (
              <div
                key={g.generation}
                style={{
                  padding: 12,
                  borderRadius: 13,
                  border: "1px solid var(--line)",
                  background: g.pct === 100
                    ? "rgba(104,193,111,.09)"
                    : "rgba(0,0,0,.13)",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}>
                  <b>Génération {g.generation}</b>
                  <b style={{
                    color: g.pct === 100
                      ? "var(--green)"
                      : "var(--gold2)",
                  }}>
                    {g.decouvertes}/{g.total}
                  </b>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
                {g.manquantes.length > 0 && (
                  <div style={{
                    color: "var(--muted)",
                    fontSize: 10,
                    marginTop: 7,
                    lineHeight: 1.45,
                  }}>
                    Manque : {g.manquantes.slice(0, 3).join(", ")}
                    {g.manquantes.length > 3 ? ` +${g.manquantes.length - 3}` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
            }}>
              <b>Progression de la session</b>
              <b style={{ color: "var(--gold2)" }}>
                {realises} / {totalInitial} réalisés · {progression}%
              </b>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progression}%` }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-ghost"
              onClick={onAnnuler}
              disabled={realises === 0}
            >
              +1 / Annuler le dernier
            </button>
            <button
              className="btn btn-ghost"
              onClick={onReinitialiser}
            >
              Réinitialiser la session
            </button>
            <button
              className="btn btn-coral"
              onClick={onDemarrerNouvelleSession}
              title="Repasse tous les Féconde en Fertile (repos terminé) puis relance la session"
            >
              🌱 Tous fertiles → nouvelle session
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => onNettoyerSterilesPuisDemarrer(forcerJaugesNettoyage)}
              title="Met tous les montures Stérile à la corbeille (récupérable) et repasse tout le reste en Fertile — pratique après un suivi de clonage mal tenu"
            >
              🧹 Nettoyer stériles → tout fertile
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={forcerJaugesNettoyage}
                onChange={(e) => setForcerJaugesNettoyage(e.target.checked)}
              />
              forcer jauges à 100 (fictif)
            </label>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{session.couples.length}</div>
          <div className="stat-label">Accouplements restants</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{session.utilises}</div>
          <div className="stat-label">{nomEntitePluriel} encore affectées</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pct}%</div>
          <div className="stat-label">Cheptel restant affecté</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{session.restants.length}</div>
          <div className="stat-label">Restantes sans partenaire</div>
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div>
            <b>Règles appliquées</b>
            <div style={{
              color: "var(--muted)",
              fontSize: 12,
              marginTop: 5,
            }}>
              Chaque clic retire réellement un mâle et une femelle du stock
              virtuel, puis le plan complet est recalculé.
            </div>
          </div>
          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--muted)",
            fontSize: 12,
          }}>
            <input
              type="checkbox"
              checked={purification}
              onChange={(e) => setPurification(e.target.checked)}
            />
            Mode purification
          </label>
          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--muted)",
            fontSize: 12,
          }}>
            <input
              type="checkbox"
              checked={optimakina}
              onChange={(e) => setOptimakina(e.target.checked)}
            />
            Optimakina utilisée
          </label>
          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--muted)",
            fontSize: 12,
          }}>
            Niveau mini (session)
            <input
              type="number"
              className="field"
              min={0}
              max={200}
              style={{ width: 70 }}
              value={niveauMinimumSession || ""}
              placeholder="0"
              title="Suppose que toutes tes montures sont au moins à ce niveau pour ce calcul, sans avoir à le saisir sur chaque fiche"
              onChange={(e) => setNiveauMinimumSession(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <NaissancesEnAttentePanel
        naissances={naissances}
        onConfirmer={onConfirmerNaissance}
        onSupprimer={onSupprimerNaissance}
        BadgeComponent={BadgeComponent}
        generationDeCouleurFn={generationDeCouleurFn}
        plierCouleurFn={plierCouleurFn}
        couleursToutes={couleursToutes}
        supporteReproducteur={supporteReproducteur}
      />

      <BebesARenommerPanel journal={journal} BadgeComponent={BadgeComponent} />

      <StatsCroisementsPanel journal={journal} />

      <div className="panel-card">
        <h2 style={{ marginTop: 0 }}>Plan d'accouplement optimisé</h2>
        {session.groupes.length === 0 && (
          <div style={{ color: "var(--muted)" }}>
            {realises > 0
              ? "Tous les accouplements disponibles ont été réalisés."
              : "Aucun couple compatible trouvé avec les sexes actuels."}
          </div>
        )}

        {session.groupes.map((g, idx) => {
          const aDesEtapes = Array.isArray(g.arbreCouples) && g.arbreCouples.length > 0;
          const etapesVisibles = Boolean(etapesOuvertes[g.key]);
          return (
          <div
            key={g.key}
            style={{
              padding: "13px 4px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "70px minmax(230px,1fr) minmax(210px,1fr) auto",
                gap: 12,
                alignItems: "center",
              }}
            >
            <span
              className="pill"
              style={{
                justifyContent: "center",
                color: "var(--gold2)",
              }}
            >
              × {g.quantite}
            </span>
            <div>
              <b>♂ <NomCopiable nom={g.male.nom || g.male.couleur} /></b>{" "}
              <BoutonFiche id={g.male.id} onVoir={onVoirMuldo} label={g.male.nom || g.male.couleur} />
              <span style={{
                color: "var(--gold2)",
                margin: "0 7px",
              }}>
                ×
              </span>
              <b>♀ <NomCopiable nom={g.femelle.nom || g.femelle.couleur} /></b>{" "}
              <BoutonFiche id={g.femelle.id} onVoir={onVoirMuldo} label={g.femelle.nom || g.femelle.couleur} />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                <CouleurCopiable couleur={g.male.couleur} gras={false} BadgeComponent={BadgeComponent} />
                <span style={{ margin: "0 5px" }}>×</span>
                <CouleurCopiable couleur={g.femelle.couleur} gras={false} BadgeComponent={BadgeComponent} />
              </div>
              <div style={{
                color: "var(--muted)",
                fontSize: 11,
                marginTop: 4,
              }}>
                Priorité #{idx + 1} · score {Math.round(g.score)}
              </div>
            </div>
            <div style={{
              color: g.resultat === objectif
                ? "var(--green)"
                : "var(--muted)",
              fontSize: 12,
            }}>
              {g.resultat ? (
                <>
                  <b>{g.resultat}</b><br />
                </>
              ) : null}
              {g.raison}
              {g.generationCible && (
                <div style={{ marginTop: 4 }}>
                  🎯 Génération cible : G{g.generationCible} (~{g.chanceGenerationCible}% de chance)
                  <br />
                  couleurs possibles : {(g.couleursGenerationCible || []).join(", ") || "—"}
                </div>
              )}
            </div>
            <div style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}>
              <button
                className="btn btn-coral"
                onClick={() => onRealiserUn(g)}
              >
                ✓ 1 réalisé
              </button>
              {g.quantite > 1 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => onTerminerGroupe(g)}
                >
                  Tout réaliser
                </button>
              )}
              {aDesEtapes && (
                <button
                  className="btn btn-ghost"
                  onClick={() => toggleEtapes(g.key)}
                >
                  {etapesVisibles ? "Masquer les étapes" : "Voir les étapes"}
                </button>
              )}
            </div>
            </div>

            {aDesEtapes && etapesVisibles && (
              <div style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--panelAlt, rgba(255,255,255,.03))",
                border: "1px solid var(--line)",
                fontSize: 12,
                color: "var(--muted)",
              }}>
                <div style={{
                  color: "var(--gold2)",
                  fontWeight: 800,
                  marginBottom: 8,
                  fontSize: 11,
                  letterSpacing: .4,
                  textTransform: "uppercase",
                }}>
                  Arbre d'accouplements jusqu'à {objectif}
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}>
                  {g.arbreCouples.map((etape, i) => {
                    const estDerniere = etape.produit === objectif;
                    return (
                      <div
                        key={`${g.key}-etape-${i}`}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {i === 0 && (
                          <span
                            className="pill"
                            style={{ color: "var(--gold2)", fontWeight: 900 }}
                          >
                            {g.resultat}
                          </span>
                        )}
                        {i > 0 && (
                          <span className="pill" style={{ fontWeight: 700 }}>
                            {g.arbreCouples[i - 1].produit}
                          </span>
                        )}
                        <span style={{ color: "var(--gold2)" }}>×</span>
                        <span className="pill" style={{ fontWeight: 700 }}>
                          {etape.parents[0] === (i === 0 ? g.resultat : g.arbreCouples[i - 1].produit)
                            ? etape.parents[1]
                            : etape.parents[0]}
                        </span>
                        <ChevronRight size={14} style={{ color: "var(--gold2)", flexShrink: 0 }} />
                        <span
                          className="pill"
                          style={{
                            color: estDerniere ? "var(--green)" : "var(--text)",
                            fontWeight: 900,
                          }}
                        >
                          {etape.produit}
                        </span>
                        {i === 0 && (
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            (déjà réalisé)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      <ListeCoursesPanel
        restants={session.restants}
        BadgeComponent={BadgeComponent}
        sexeFn={sexeFn}
        couleurEstCanoniqueFn={couleurEstCanoniqueFn}
        couleursToutes={couleursToutes}
        resultatsParCouple={resultatsParCouple}
        cleCoupleCouleursFn={cleCoupleCouleursFn}
        generationDeCouleurFn={generationDeCouleurFn}
        lieuCapture={lieuCapture}
      />

      {session.restants.length > 0 && (
        <div className="panel-card" style={{ marginTop: 16 }}>
          <b>{nomEntitePluriel} sans partenaire</b>
          {session.raisonRestants && (
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 5 }}>
              {session.raisonRestants}
            </div>
          )}
          <div style={{
            color: "var(--muted)",
            fontSize: 12,
            marginTop: 7,
          }}>
            {Object.entries(
              session.restants.reduce((acc, m) => {
                const sexe = sexeFn(m);
                const k = `${m.couleur} ${
                  sexe === "M" ? "♂" : sexe === "F" ? "♀" : "? (sexe inconnu)"
                }`;
                acc[k] = (acc[k] || 0) + 1;
                return acc;
              }, {})
            ).map(([k, n]) => `${n}× ${k}`).join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Petits helpers UI génériques (partagés entre les 3 créatures) ----------
export function LabeledSelect({ label, value, options, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>{label}</div>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

export function StatCard({ value, label, emoji }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 22, marginBottom: 12 }}>{emoji}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function formatKamas(n) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0))} k`;
}

// Estimation de la valeur du cheptel. Dofus n'expose pas d'API HDV : les prix
// sont saisis à la main par couleur (une fois), persistés, et le total suit
// automatiquement l'évolution du cheptel. Les stériles sont comptés avec une
// décote réglable (leur valeur réelle est surtout le recyclage).
export function EstimationKamasTable({ cheptel, storageKey, generationDeCouleurFn, nomHdv, labelExtraction, icone, badge: Badge, creature, userId }) {
  const [sourcePrix, setSourcePrix] = useState("perso");
  const [serveur, setServeur] = useState(() => localStorage.getItem(STORAGE_SERVEUR) || "");
  useEffect(() => {
    localStorage.setItem(STORAGE_SERVEUR, serveur);
  }, [serveur]);
  // couleur -> { median, nb }, chargé depuis Supabase pour (creature, serveur).
  const [communaute, setCommunaute] = useState({});
  const [chargementCommunaute, setChargementCommunaute] = useState(false);
  const serveurNormalise = serveur.trim();
  useEffect(() => {
    if (!supabase || sourcePrix !== "communaute" || !serveurNormalise) { setCommunaute({}); return; }
    let annule = false;
    setChargementCommunaute(true);
    supabase.from("prix_communautaires_medianes")
      .select("couleur, prix_median, nb_soumissions")
      .eq("creature", creature)
      .eq("serveur", serveurNormalise)
      .then(({ data }) => {
        if (annule) return;
        const carte = {};
        (data || []).forEach((l) => { carte[l.couleur] = { median: Number(l.prix_median), nb: Number(l.nb_soumissions) }; });
        setCommunaute(carte);
        setChargementCommunaute(false);
      });
    return () => { annule = true; };
  }, [sourcePrix, serveurNormalise, creature]);

  const [saisieCommunaute, setSaisieCommunaute] = useState({});
  const proposerPrixCommunaute = async (couleur) => {
    const valeur = Number(saisieCommunaute[couleur]);
    if (!supabase || !userId || !serveurNormalise || !Number.isFinite(valeur) || valeur < 0) return;
    await supabase.from("prix_communautaires").upsert(
      { creature, couleur, serveur: serveurNormalise, prix: valeur, auteur: userId },
      { onConflict: "creature,couleur,serveur,auteur" }
    );
    setSaisieCommunaute((prev) => ({ ...prev, [couleur]: "" }));
    setCommunaute((prev) => ({ ...prev, [couleur]: { median: valeur, nb: (prev[couleur]?.nb || 0) + (prev[couleur] ? 0 : 1) } }));
  };

  const [config, setConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved === "object") {
        return {
          prix: saved.prix || {},
          decoteSterile: Number.isFinite(saved.decoteSterile) ? saved.decoteSterile : 20,
          prixAmbre: Number.isFinite(saved.prixAmbre) ? saved.prixAmbre : 20000,
        };
      }
    } catch (e) {
      console.error("Grille de prix illisible", e);
    }
    return { prix: {}, decoteSterile: 20, prixAmbre: 20000 };
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  }, [config, storageKey]);

  const lignes = useMemo(() => {
    const parCouleur = new Map();
    (cheptel || []).forEach((m) => {
      const c = m.couleur;
      if (!parCouleur.has(c)) parCouleur.set(c, { couleur: c, fertiles: 0, steriles: 0, seniles: 0 });
      const ligne = parCouleur.get(c);
      if (m.senile) ligne.seniles += 1;
      else if (m.sterile) ligne.steriles += 1;
      else ligne.fertiles += 1;
    });
    return [...parCouleur.values()]
      .map((l) => {
        const prixPerso = Number(config.prix[l.couleur]) || 0;
        const prixCommunaute = communaute[l.couleur]?.median;
        // Communauté choisie mais aucune soumission pour cette couleur/serveur
        // encore : repli automatique sur le prix personnel.
        const prixUnitaire = sourcePrix === "communaute" && Number.isFinite(prixCommunaute) ? prixCommunaute : prixPerso;
        const sousTotal = l.fertiles * prixUnitaire
          + (l.steriles + l.seniles) * prixUnitaire * (config.decoteSterile / 100);
        const generation = generationDeCouleurFn(l.couleur);
        // Extraction : rendement = numéro de génération en ressources (dès la gen 2).
        // Exception : un individu SÉNILE ne rend qu'une seule ressource.
        const valeurExtraction = generation >= 2
          ? ((l.fertiles + l.steriles) * generation + l.seniles * 1) * (Number(config.prixAmbre) || 0)
          : 0;
        return { ...l, prixPerso, prixUnitaire, sousTotal, generation, valeurExtraction };
      })
      .sort((a, b) => (a.generation - b.generation) || a.couleur.localeCompare(b.couleur, "fr"));
  }, [cheptel, config, generationDeCouleurFn, sourcePrix, communaute]);

  const total = lignes.reduce((n, l) => n + l.sousTotal, 0);
  const totalExtraction = lignes.reduce((n, l) => n + l.valeurExtraction, 0);
  const totalOptimal = lignes.reduce((n, l) => n + Math.max(l.sousTotal, l.valeurExtraction), 0);
  const sansPrix = lignes.filter((l) => !l.prixUnitaire).length;

  // Clic sur une couleur → copie "<Créature> <Couleur>" (nom exact à l'HDV créatures).
  const [copie, setCopie] = useState(null);
  const copierNomHdv = async (couleur) => {
    if (await copierPressePapiers(`${nomHdv} ${couleur}`)) {
      setCopie(couleur);
      setTimeout(() => setCopie((c) => (c === couleur ? null : c)), 1500);
    }
  };

  const setPrixCouleur = (couleur, valeur) => {
    setConfig((prev) => ({
      ...prev,
      prix: { ...prev.prix, [couleur]: valeur === "" ? "" : Math.max(0, Number(valeur) || 0) },
    }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{icone} Valeur estimée — {nomHdv}</h2>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--gold)", fontSize: 22, fontWeight: 900 }}>{formatKamas(total)}</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>
            extraction : {formatKamas(totalExtraction)} · optimum (meilleur des deux par ligne) : {formatKamas(totalOptimal)}
          </div>
        </div>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
        Saisis le prix HDV unitaire par couleur (persisté sur ce navigateur) — pas d'API officielle, donc
        mise à jour manuelle. Clique sur une couleur pour copier son nom complet et le coller dans la
        recherche de l'HDV créatures.{" "}
        {sansPrix > 0 && <span style={{ color: "#e8896a" }}>{sansPrix} couleur(s) sans prix : elles comptent pour 0.</span>}
      </div>

      {supabase && creature && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
          <span>Source des prix :</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className={`btn ${sourcePrix === "perso" ? "btn-coral" : "btn-ghost"}`} style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setSourcePrix("perso")}>Personnel</button>
            <button type="button" className={`btn ${sourcePrix === "communaute" ? "btn-coral" : "btn-ghost"}`} style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setSourcePrix("communaute")}>Communauté (médiane serveur)</button>
          </div>
          {sourcePrix === "communaute" && (
            <>
              <input
                className="field"
                placeholder="Ton serveur (ex. Dodge)"
                value={serveur}
                onChange={(e) => setServeur(e.target.value)}
                style={{ width: 160, padding: "5px 10px" }}
              />
              {!serveurNormalise && <span>Renseigne un serveur pour voir les prix communautaires.</span>}
              {chargementCommunaute && <span>chargement…</span>}
            </>
          )}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
        Valeur d'un stérile :
        <input
          type="number"
          className="field"
          min={0}
          max={100}
          value={config.decoteSterile}
          onChange={(e) => setConfig((prev) => ({ ...prev, decoteSterile: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
          style={{ width: 70 }}
        />
        % du prix d'un fertile
        <span style={{ margin: "0 6px", color: "var(--text-faint, var(--muted))" }}>·</span>
        Prix de « {labelExtraction} » :
        <input
          type="number"
          className="field"
          min={0}
          value={config.prixAmbre}
          onChange={(e) => setConfig((prev) => ({ ...prev, prixAmbre: Math.max(0, Number(e.target.value) || 0) }))}
          style={{ width: 90 }}
        />
        k (extraction : génération × quantité, dès la gen 2)
      </label>

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <div style={{ minWidth: 640, display: "grid", gridTemplateColumns: "minmax(150px, 1fr) 60px 60px 130px 120px 120px", gap: 8, fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <span>Couleur</span><span>Fert.</span><span>Stér.</span><span>Prix unitaire</span><span style={{ textAlign: "right" }}>Sous-total HDV</span><span style={{ textAlign: "right" }}>Extraction</span>
        </div>
        {lignes.map((l) => (
          <div key={l.couleur} style={{ minWidth: 640, display: "grid", gridTemplateColumns: "minmax(150px, 1fr) 60px 60px 130px 120px 120px", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
            <span>
              <button
                type="button"
                onClick={() => copierNomHdv(l.couleur)}
                title={`Copier « ${nomHdv} ${l.couleur} » pour la recherche HDV`}
                style={{ background: "none", border: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
              >
                {Badge ? <Badge couleur={l.couleur} taille={18} /> : icone}{" "}{l.couleur}
              </button>{" "}
              <span style={{ color: "var(--muted)", fontSize: 11 }}>G{l.generation}</span>
              {copie === l.couleur && (
                <span style={{ color: "var(--gold)", fontSize: 11, marginLeft: 6 }}>✓ copié</span>
              )}
            </span>
            <span>{l.fertiles}</span>
            <span style={{ color: "var(--muted)" }}>{l.steriles}</span>
            {sourcePrix === "perso" || !serveurNormalise ? (
              <input
                type="number"
                className="field"
                min={0}
                placeholder="prix en k"
                value={config.prix[l.couleur] ?? ""}
                onChange={(e) => setPrixCouleur(l.couleur, e.target.value)}
                style={{ width: "100%", padding: "4px 8px" }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 12, color: communaute[l.couleur] ? "var(--text)" : "var(--muted)" }}>
                  {communaute[l.couleur]
                    ? `${formatKamas(communaute[l.couleur].median)} (${communaute[l.couleur].nb} avis)`
                    : `perso : ${formatKamas(l.prixPerso)}`}
                </span>
                {userId && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      className="field"
                      min={0}
                      placeholder="proposer"
                      value={saisieCommunaute[l.couleur] ?? ""}
                      onChange={(e) => setSaisieCommunaute((prev) => ({ ...prev, [l.couleur]: e.target.value }))}
                      style={{ width: 70, padding: "3px 6px", fontSize: 11 }}
                    />
                    <button type="button" className="btn btn-ghost" style={{ padding: "3px 6px", fontSize: 11 }} onClick={() => proposerPrixCommunaute(l.couleur)}>OK</button>
                  </div>
                )}
              </div>
            )}
            <span style={{ textAlign: "right", color: l.sousTotal ? "var(--text)" : "var(--muted)" }}>{formatKamas(l.sousTotal)}</span>
            <span
              title={l.generation >= 2
                ? `${l.fertiles + l.steriles} individu(s) × ${l.generation} ${labelExtraction}(s) × ${formatKamas(config.prixAmbre)}${l.valeurExtraction > l.sousTotal ? " — l'extraction rapporte plus que la vente HDV" : ""}`
                : "Génération 1 : extraction impossible"}
              style={{
                textAlign: "right",
                color: l.valeurExtraction > l.sousTotal && l.valeurExtraction > 0 ? "var(--gold)" : "var(--muted)",
                fontWeight: l.valeurExtraction > l.sousTotal && l.valeurExtraction > 0 ? 700 : 400,
              }}
            >
              {l.generation >= 2 ? formatKamas(l.valeurExtraction) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
