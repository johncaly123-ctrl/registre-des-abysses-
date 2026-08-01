import { RECETTES_SPECIALES_MULDO, generationDeCouleur } from "./muldoGenetique.js";
import { RECETTES_SPECIALES_DRAGODINDE, generationDeCouleurDragodinde } from "./Dragodinde.jsx";
import { RECETTES_SPECIALES_VOLKORNE, generationDeCouleurVolkorne } from "./Volkorne.jsx";

// Page de contenu statique (guide/blog) : pas de CMS, du texte en dur, dans le
// même langage visuel que le reste de l'app (.panel-card + variables CSS).
// Objectif : donner une raison légitime à d'autres sites de faire un lien vers
// le Registre des Abysses, et un contenu indexable par les moteurs de recherche.

function Section({ titre, children }) {
  return (
    <div className="panel-card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, color: "var(--gold)" }}>{titre}</h2>
      <div style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

// Recettes tirées directement des tables qui alimentent le GPS de l'outil
// (pas de contenu inventé) — les couleurs rares/spéciales sont celles que les
// joueurs recherchent le plus quand ils cherchent "comment obtenir [couleur]".
function SectionRecettes({ titre, recettes, generationFn }) {
  const entrees = Object.entries(recettes);
  if (!entrees.length) return null;
  return (
    <Section titre={titre}>
      <p>
        Recettes vérifiées, telles qu'utilisées par le GPS de l'outil pour calculer le chemin le
        plus court vers ces couleurs recherchées.
      </p>
      {entrees.map(([couleur, options]) => (
        <div key={couleur} style={{ marginBottom: 10 }}>
          <b style={{ color: "var(--gold2)" }}>{couleur}</b>{" "}
          <span style={{ color: "var(--muted)", fontSize: 12 }}>(génération {generationFn(couleur)})</span>
          <div style={{ fontSize: 13, marginTop: 3 }}>
            {options.map((o, i) => (
              <span key={i}>{i > 0 && " · "}{o[0]} × {o[1]}</span>
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

export function GuidePage() {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Guide de l'éleveur</h1>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          Les bases pour démarrer un élevage de muldos, dragodindes ou volkornes — et tirer parti
          des outils du Registre des Abysses.
        </div>
      </div>

      <Section titre="Comprendre la génétique des couleurs">
        <p>
          Chaque créature possède une couleur héritée d'un système de générations : croiser deux
          couleurs d'une même branche produit une couleur de génération supérieure selon des
          recettes fixes (parfois plusieurs couples différents mènent à la même couleur cible).
          Certaines couleurs de génération élevée ne s'obtiennent que via des <b>recettes spéciales</b>{" "}
          (combinaisons précises, pas seulement "génération + 1").
        </p>
        <p>
          Le Registre affiche pour chaque couleur la ou les recettes qui y mènent, et calcule le
          chemin le plus court (le moins de croisements) pour atteindre un objectif depuis votre
          cheptel actuel.
        </p>
      </Section>

      <Section titre="Génération cible et généalogie : comment lire vos pourcentages">
        <p>
          À l'écran d'accouplement, le jeu affiche un pourcentage de chance d'obtenir la{" "}
          <b>génération cible</b> — la couleur la plus élevée que ce couple précis peut produire, en
          combinant les deux parents et leurs ancêtres connus dans l'arbre généalogique. Ce pourcentage
          suit une formule fixe : <b>30 % de base</b>, <b>+ 0,15 % par niveau cumulé des deux parents</b>,
          et <b>+ 10 % si une Optimakina/Makina</b> est utilisée. Le reste (100 % moins la cible) se
          répartit entre les couleurs de repli issues des ancêtres.
        </p>
        <p>
          Trois règles qualitatives gouvernent cette répartition de repli : plus la génération d'une
          couleur candidate est élevée, plus ses chances sont faibles ; un <b>parent pèse plus qu'un
          grand-parent</b> dans l'arbre ; et une couleur <b>présente plusieurs fois</b> dans la
          généalogie voit ses chances augmenter en conséquence.
        </p>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Exemple (Dragodinde) : une Pourpre (génération 5, niveau 200, sans ancêtre connu) accouplée à
          une Émeraude (génération 9, niveau 1, ancêtres Ivoire et Turquoise / Ivoire et Pourpre) vise la
          génération 10 (Émeraude et Pourpre). Base 30 % + 0,15 % × (200 + 1) = 30,15 %, puis + 10 % avec
          Optimakina = 70,15 % de chance d'obtenir Émeraude et Pourpre. Le reste (29,85 %) se répartit
          très majoritairement sur les couleurs des parents eux-mêmes (Pourpre, Émeraude) plutôt que sur
          les grands-parents (Ivoire et Turquoise / Ivoire et Pourpre, génération 8), qui restent
          marginaux.
        </p>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Exemple (Muldo) : un Pourpre (ancêtre connu : Corail) accouplé à un Doré et Indigo (ancêtres
          connus : Doré, Indigo) offre deux combinaisons possibles vers la génération 10 — Corail et
          Doré, ou Corail et Indigo — qui se partagent la probabilité cible à parts égales (15,15 %
          chacune sur un total de 30,3 %). Ici, le Pourpre — présent deux fois dans les deux arbres
          combinés — a nettement plus de chances d'apparaître en repli que le Doré ou l'Indigo, qui
          n'apparaissent qu'une seule fois chacun malgré une génération comparable.
        </p>
      </Section>

      <Section titre="Utiliser le GPS d'accouplements">
        <p>
          Le GPS optimise l'organisation d'une session d'accouplements : il propose un objectif de
          couleur ou de génération, puis calcule l'appariement mâle/femelle qui maximise le nombre
          de couples utiles en une seule session (plutôt que de choisir les paires au hasard).
        </p>
        <p>
          Conseil : lancez une synchronisation (capture d'écran de l'enclos) avant une session de
          GPS pour que le plan reflète exactement votre cheptel du moment.
        </p>
      </Section>

      <Section titre="Synchroniser son cheptel par capture d'écran">
        <p>
          La page Synchronisation lit une capture d'écran de votre enclos en jeu (reconnaissance de
          texte) et propose une liste de créatures à fusionner avec votre cheptel existant. Les noms
          de couleurs mal reconnus sont automatiquement rapprochés de la liste officielle — vérifiez
          quand même les correspondances proposées avant de valider, l'OCR n'est jamais parfait à 100 %.
        </p>
      </Section>

      <Section titre="Clonage : sécuriser une lignée">
        <p>
          Le clonage détruit deux créatures de même génération pour en produire une nouvelle,
          fertile, de l'une des deux couleurs (et sexes) d'origine — la généalogie est conservée
          mais les capacités et jauges repartent à zéro. Utile pour dupliquer un pivot rare avant de
          l'extraire, sans perdre la couleur.
        </p>
      </Section>

      <Section titre="Estimer la valeur de son cheptel">
        <p>
          La table d'estimation calcule une valeur totale à partir d'un prix par couleur, que vous
          pouvez renseigner vous-même ou (selon la couleur) comparer à un prix moyen communautaire
          par serveur, quand suffisamment de joueurs l'ont renseigné.
        </p>
      </Section>

      <SectionRecettes titre="Comment obtenir les couleurs rares de muldo" recettes={RECETTES_SPECIALES_MULDO} generationFn={generationDeCouleur} />
      <SectionRecettes titre="Comment obtenir les couleurs rares de dragodinde" recettes={RECETTES_SPECIALES_DRAGODINDE} generationFn={generationDeCouleurDragodinde} />
      <SectionRecettes titre="Comment obtenir les couleurs rares de volkorne" recettes={RECETTES_SPECIALES_VOLKORNE} generationFn={generationDeCouleurVolkorne} />

      <Section titre="Rejoindre la communauté">
        <p>
          La Taverne est un espace de discussion intégré à l'app (comptes, messages, classement des
          éleveurs) — aucune donnée d'élevage n'y est publiée sans action volontaire de votre part.
        </p>
      </Section>
    </div>
  );
}

// ---------- Nouveautés (changelog public) ----------
// Contenu statique tenu à jour manuellement, dans le même esprit que le
// Guide : une raison légitime de revenir régulièrement + du texte indexable.
const NOUVEAUTES = [
  {
    date: "25 juillet 2026",
    items: [
      "Comparateur de cheptels publics : sur un lien partagé, comparez vos couleurs à celles de l'éleveur visité.",
      "Parcours guidé pas-à-pas pour découvrir le GPS en le vivant (au-delà du simple tutoriel explicatif).",
      "Filtre combiné (génération, couleur, sexe, statut) sur la page Cheptel des 3 créatures.",
      "Score de confiance sur les couleurs corrigées automatiquement par l'OCR, pour repérer les corrections douteuses.",
      "Notification à l'écran quand une naissance atteint l'objectif GPS suivi.",
      "Nouveaux jalons (100 naissances, 10 clonages, premier cheptel publié) sur la page Succès.",
      "Section \"comment obtenir les couleurs rares\" dans le Guide, générée depuis les recettes du GPS.",
      "Lien d'invitation Discord de la communauté.",
    ],
  },
  {
    date: "24 juillet 2026",
    items: [
      "Thème clair/sombre, base SEO (sitemap, meta Open Graph) et onboarding GPS pour les nouveaux joueurs.",
      "Prix communautaires par serveur pour l'estimation de la valeur du cheptel.",
      "Cheptel public partageable via un lien, et partage rapide d'un plan GPS ou d'un message vers la Taverne.",
      "Correctif de performance : le GPS ne recalculait plus en continu en arrière-plan (CPU/ventilateur).",
    ],
  },
  {
    date: "Juillet 2026",
    items: [
      "Attribution automatique du palier d'ailes de soutien après un don Stripe.",
      "Parité complète Dragodinde et Volkorne avec Muldo : cheptel, synchronisation, GPS, clonage, succès.",
      "Tests automatisés (unitaires + parcours critiques) pour fiabiliser les évolutions futures.",
    ],
  },
];

export function NouveautesPage() {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Quoi de neuf</h1>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          Les dernières évolutions du Registre des Abysses, dans l'ordre chronologique.
        </div>
      </div>
      {NOUVEAUTES.map((bloc) => (
        <Section titre={bloc.date} key={bloc.date}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {bloc.items.map((texte) => <li key={texte} style={{ marginBottom: 6 }}>{texte}</li>)}
          </ul>
        </Section>
      ))}
    </div>
  );
}
