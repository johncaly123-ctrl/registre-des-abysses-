import { useState, useEffect } from "react";
import { X } from "lucide-react";

// Modal générique de tour multi-étapes, dismissible — pas de tooltips ancrés
// sur des éléments précis (les pages partagent des mises en page légèrement
// différentes selon le mode/la créature choisie, un ancrage par sélecteur
// serait fragile). Une suite d'écrans centrés, comme les autres modals de
// l'app, est plus robuste. Réutilisé pour la découverte du GPS et pour le
// tuto de première visite du site (voir App.jsx).
export const ETAPES_ONBOARDING_GPS = [
  {
    icone: "🛰️",
    titre: "Bienvenue sur le GPS d'accouplements",
    texte: "Le GPS calcule automatiquement le meilleur enchaînement de croisements pour atteindre un objectif, à partir de votre cheptel actuel.",
  },
  {
    icone: "🎯",
    titre: "Choisissez un objectif",
    texte: "Une couleur précise, une génération, une collection de générations, ou simplement progresser dans les succès — le plan s'adapte à l'objectif choisi.",
  },
  {
    icone: "🧮",
    titre: "Le plan optimal est calculé pour vous",
    texte: "Le GPS associe vos mâles et femelles pour maximiser le nombre de croisements utiles en une seule session, plutôt que de choisir les paires au hasard.",
  },
  {
    icone: "🔄",
    titre: "Le plan se met à jour au fil de la session",
    texte: "Chaque accouplement réalisé recalcule automatiquement la suite du plan — pas besoin de tout relancer à chaque étape.",
  },
];

export const ETAPES_ONBOARDING_SITE = [
  {
    icone: "🌊",
    titre: "Bienvenue sur le Registre des Abysses",
    texte: "Un outil gratuit et communautaire pour l'élevage de muldos, dragodindes et volkornes dans Dofus. Toutes les données de votre cheptel restent dans votre navigateur — rien n'est envoyé nulle part sans votre action.",
  },
  {
    icone: "🐴",
    titre: "Votre cheptel, créature par créature",
    texte: "Muldo, Dragodinde et Volkorne ont chacun leur section dans la barre latérale, avec le même sous-menu : Cheptel, Synchronisation, GPS, Clonage.",
  },
  {
    icone: "📷",
    titre: "Synchronisation : importez votre enclos en un clic",
    texte: "Une capture d'écran de votre enclos en jeu suffit ; la reconnaissance de texte propose une fusion automatique avec votre cheptel existant.",
  },
  {
    icone: "🛰️",
    titre: "GPS : le plan de croisements optimal",
    texte: "Donnez un objectif (une couleur, une génération…) : le GPS calcule le meilleur enchaînement d'accouplements et les meilleurs couples à réaliser.",
  },
  {
    icone: "🧬",
    titre: "Clonage et Carburant d'enclos",
    texte: "Le clonage sécurise une lignée rare sans perdre sa couleur. La page Carburant d'enclos compare le coût réel des jauges de mangeoire (kamas/heure, XP réelle).",
  },
  {
    icone: "🏆",
    titre: "Taverne, Succès et Guide",
    texte: "Rejoignez la communauté dans la Taverne, suivez vos jalons dans Succès, et retrouvez à tout moment un guide texte complet dans l'onglet Guide.",
  },
];

export function OnboardingOverlay({ open, onClose, etapes, titre }) {
  const [etape, setEtape] = useState(0);
  useEffect(() => { if (open) setEtape(0); }, [open]);
  if (!open) return null;
  const derniere = etape === etapes.length - 1;
  const { icone, titre: titreEtape, texte } = etapes[etape];

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
            {titre} · {etape + 1}/{etapes.length}
          </span>
          <X size={16} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={onClose} />
        </div>
        {icone && <div style={{ fontSize: 32, marginBottom: 6 }}>{icone}</div>}
        <h2 style={{ marginTop: 0 }}>{titreEtape}</h2>
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
