import React, { useState } from "react";
import { X } from "lucide-react";

// Petit guide dismissible affiché à la première visite du GPS — pas de
// tooltips ancrés sur des éléments précis (le GPS est partagé entre 3
// créatures avec des mises en page légèrement différentes selon le mode
// choisi, un ancrage par sélecteur serait fragile). Une suite d'écrans
// centrés, comme les autres modals de l'app, est plus robuste.
const ETAPES = [
  {
    titre: "Bienvenue sur le GPS d'accouplements",
    texte: "Le GPS calcule automatiquement le meilleur enchaînement de croisements pour atteindre un objectif, à partir de votre cheptel actuel.",
  },
  {
    titre: "Choisissez un objectif",
    texte: "Une couleur précise, une génération, une collection de générations, ou simplement progresser dans les succès — le plan s'adapte à l'objectif choisi.",
  },
  {
    titre: "Le plan optimal est calculé pour vous",
    texte: "Le GPS associe vos mâles et femelles pour maximiser le nombre de croisements utiles en une seule session, plutôt que de choisir les paires au hasard.",
  },
  {
    titre: "Le plan se met à jour au fil de la session",
    texte: "Chaque accouplement réalisé recalcule automatiquement la suite du plan — pas besoin de tout relancer à chaque étape.",
  },
];

export function OnboardingOverlay({ open, onClose }) {
  const [etape, setEtape] = useState(0);
  if (!open) return null;
  const derniere = etape === ETAPES.length - 1;
  const { titre, texte } = ETAPES[etape];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(10,8,6,.65)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        className="panel-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: "100%" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            Découverte du GPS · {etape + 1}/{ETAPES.length}
          </span>
          <X size={16} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={onClose} />
        </div>
        <h2 style={{ marginTop: 0 }}>{titre}</h2>
        <p style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.6 }}>{texte}</p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose}>Passer</button>
          <button
            className="btn btn-coral"
            onClick={() => (derniere ? onClose() : setEtape((e) => e + 1))}
          >
            {derniere ? "Compris !" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
