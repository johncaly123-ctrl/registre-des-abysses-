import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, infos) {
    console.error("Erreur non interceptée dans l'application :", erreur, infos);
  }

  render() {
    if (this.state.erreur) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            textAlign: "center",
            background: "#0b0b12",
            color: "#e8e2d0",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 48 }}>💥</div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Une erreur inattendue est survenue</h1>
          <p style={{ maxWidth: 480, opacity: 0.8, margin: 0 }}>
            Rassure-toi, tes données restent dans le stockage local de ton navigateur — rien n'a
            été perdu. Essaie de recharger la page ; si le problème persiste, exporte ta
            sauvegarde depuis un autre onglet avant de continuer.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #d4af37",
              background: "transparent",
              color: "#d4af37",
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Recharger la page
          </button>
          {import.meta.env.DEV && this.state.erreur?.message && (
            <details style={{ marginTop: 16, opacity: 0.5, fontSize: 12, maxWidth: 480 }}>
              <summary style={{ cursor: "pointer" }}>Détails techniques (visible en dev uniquement)</summary>
              <pre style={{ whiteSpace: "pre-wrap", textAlign: "left" }}>
                {String(this.state.erreur.stack || this.state.erreur.message)}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
