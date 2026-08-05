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
- **Cloudflare Pages** (hébergeur officiel) : https://registre-des-abysses.pages.dev — déploiement
  automatique à chaque push sur `main` via `.github/workflows/deploy-cloudflare.yml`. Pour déployer
  à la main : `npx wrangler pages deploy dist --project-name=registre-des-abysses`.
- **Vercel** : importer le dépôt GitHub, framework "Vite", aucun réglage nécessaire.

## Communauté
Rejoins la communauté sur Discord pour échanger sur l'élevage, signaler un bug ou
proposer une idée : lien à venir (voir `LIEN_DISCORD` dans `src/configSupabase.js`).

## Licence
© 2026 caly191. Tous droits réservés — voir [LICENSE](LICENSE). Ce n'est pas un
projet open source : la réutilisation, la copie ou la redistribution du code ne sont
pas autorisées sans permission écrite.
