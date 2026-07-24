# Registre des Abysses

Compagnon d'élevage de muldos : GPS d'accouplements, synchronisation par
capture (OCR), naissances et généalogies, clonage, valeur du cheptel, sauvegarde.
Outil communautaire non affilié à Ankama.

## Développement local
    npm install
    npm run dev

## Compilation
    npm run build     # produit le dossier dist/

## Déploiement (gratuit)
- **Netlify** : https://app.netlify.com/drop → glisser-déposer le dossier `dist/`.
- **Vercel** : importer le dépôt GitHub, framework "Vite", aucun réglage nécessaire.
- Toutes les données restent dans le navigateur du visiteur (localStorage) :
  aucun serveur, aucune base de données à gérer.

## Communauté
Rejoins la communauté sur Discord pour échanger sur l'élevage, signaler un bug ou
proposer une idée : lien à venir (voir `LIEN_DISCORD` dans `src/configSupabase.js`).
