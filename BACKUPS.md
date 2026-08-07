# Sauvegardes de la base de données

Supabase (plan gratuit) ne fournit aucun backup automatique ni PITR
(vérifié via l'API Management le 2026-08-07 : `pitr_enabled: false`,
`backups: []`). `.github/workflows/backup-db.yml` comble ce trou : un dump
Postgres complet (schémas `public` **et** `auth` — comptes, emails, cheptels,
forum, dons) chaque nuit, chiffré, envoyé vers un bucket Cloudflare R2.

## Mise en place (une seule fois)

### 1. Bucket R2 + règle de rétention

1. Dashboard Cloudflare → **R2** → **Create bucket** → nom au choix, ex.
   `registre-des-abysses-backups`.
2. Dans le bucket → **Settings** → **Object lifecycle rules** → ajoute une
   règle *"Delete objects older than 30 days"* (s'applique à tous les
   objets). C'est ce qui gère la rétention glissante — rien à coder côté
   workflow.
3. Dashboard Cloudflare → **R2** → **Manage R2 API Tokens** → **Create API
   Token** → permissions **Object Read & Write**, scope limité à ce bucket.
   Note l'Access Key ID et la Secret Access Key (affichées une seule fois).

### 2. Mot de passe de la base Supabase

Dashboard Supabase → **Project Settings** → **Database** → **Database
password** (le réinitialiser si tu ne l'as plus — ça ne casse rien d'autre,
c'est un mot de passe différent de la clé publishable utilisée par
l'appli). Construis la chaîne de connexion **Session Pooler** (port 5432,
compatible IPv4 — nécessaire pour GitHub Actions) :

```
postgresql://postgres.fcdculpkrcuhtexmqojz:LE_MOT_DE_PASSE@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
```

### 3. Passphrase de chiffrement

Choisis une passphrase forte, note-la ailleurs (gestionnaire de mots de
passe) — **si elle est perdue, les sauvegardes existantes deviennent
illisibles**, aucun moyen de la récupérer.

### 4. Secrets GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**, un par ligne :

| Secret | Valeur |
|---|---|
| `SUPABASE_DB_URL` | la chaîne de connexion de l'étape 2 |
| `BACKUP_GPG_PASSPHRASE` | la passphrase de l'étape 3 |
| `R2_ACCESS_KEY_ID` | de l'étape 1 |
| `R2_SECRET_ACCESS_KEY` | de l'étape 1 |
| `R2_BUCKET_NAME` | le nom du bucket de l'étape 1 |

`CLOUDFLARE_ACCOUNT_ID` existe déjà (utilisé par le déploiement Pages) —
réutilisé tel quel pour l'endpoint R2.

### 5. Test

Onglet **Actions** → **Sauvegarde quotidienne de la base** → **Run
workflow** (bouton manuel, pas besoin d'attendre 3h17 UTC). Vérifie
ensuite dans le dashboard R2 qu'un fichier `backup-AAAA-MM-JJ.sql.gz.gpg`
est bien apparu.

## Restaurer une sauvegarde

**Un restore écrase des données existantes — ne l'exécute jamais sur la
base de prod sans être certain de vouloir ça.** Prévu pour reconstruire
depuis zéro (nouveau projet Supabase) après une attaque/suppression, pas
pour fusionner avec des données déjà en place.

```bash
# 1. Télécharger le fichier depuis le dashboard R2 (ou aws s3 cp avec les
#    mêmes identifiants que le workflow)

# 2. Déchiffrer + décompresser
gpg --decrypt --batch --passphrase "LA_PASSPHRASE" backup-2026-08-07.sql.gz.gpg \
  | gunzip > backup.sql

# 3. Restaurer sur la base cible (idéalement un projet Supabase neuf/vide)
psql "postgresql://postgres.PROJET:MOT_DE_PASSE@aws-0-eu-west-3.pooler.supabase.com:5432/postgres" \
  -f backup.sql
```
