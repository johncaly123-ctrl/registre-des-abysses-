# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Registre des Abysses — a French-language companion web app for breeding "muldos" (mounts) in the
game Dofus: colour-genetics GPS/pathfinder for pairings, OCR-based stable sync from screenshots,
births/genealogy tracking, cloning, herd valuation, and a community layer (accounts + forum) with a
cosmetic donation system ("ailes de soutien"). Community tool, not affiliated with Ankama.

A Supabase account is **mandatory** to use the app at all (`App()` renders `<PortailConnexion>` and
nothing else while `!compte.session` — there is no anonymous/offline mode). This is a deliberate
change from the tool's original all-`localStorage` design (see `src/stockage.js` below) — do not
assume "Supabase is optional" from older comments/docs; only the theme preference and the
first-visit-onboarding flag are still read straight from browser `localStorage`
(`STORAGE_THEME`, `STORAGE_ONBOARDING_SITE`), since those must work before a session exists.

## Commands

```
npm install        # install dependencies
npm run dev         # Vite dev server
npm run build        # production build -> dist/
npm run preview      # serve the dist/ build locally
npm run lint         # eslint . (react-hooks/exhaustive-deps etc. — currently warnings only, 0 errors)
npm run test         # vitest run — unit tests for the genetics/OCR engine (muldoGenetique.js, muldoOCR.js, geneticsUtils.js)
npm run test:e2e     # playwright test — browser specs in e2e/ (GPS, naissance, corbeille, clonage, synchro)
npm run test:e2e:ui  # playwright test --ui
```

`.github/workflows/ci.yml` runs lint + test + build on every push/PR to `main` (plus a separate e2e
job running Playwright against Chromium) — but it's still worth running these by hand before a
non-trivial change lands, rather than finding out from a red CI run. Test coverage is currently
concentrated on the shared genetics core and the Muldo module; Dragodinde.jsx/Volkorne.jsx's own
scoring/GPS logic has no dedicated unit tests yet.

## Architecture

### Multi-file app, one hook+pages module per creature

The app was originally a single ~7,200-line `App.jsx`; it has since been split so each of the three
breedable creatures (muldo, dragodinde, volkorne) owns its own module, mirroring the same shape:

- **`src/Muldo.jsx`** (~3,200 lines), **`src/Dragodinde.jsx`**, **`src/Volkorne.jsx`** (~2,000 lines
  each): each exports a `use<Creature>Elevage()` hook (owns that creature's herd state + all
  `localStorage` persistence for it) and every page/panel specific to that creature — cheptel
  overview/cards, detail panel, creation modal, synchro/OCR import, GPS page wiring, clonage page,
  succès page. **This is deliberate duplication, not an oversight**: the colour/generation genetics
  engine (recipes, pathfinding, GPS scoring) is a full copy per creature rather than one shared
  parametrised engine — see the comment at the top of `Dragodinde.jsx`/`Volkorne.jsx`. When fixing a
  bug or adding a feature in one creature's file, check whether the same fix is needed in the other
  two; nothing enforces parity automatically, and drift between the three is an easy way to
  reintroduce the "why does Muldo have X but not Dragodinde" class of bug.
- **`src/muldoGenetique.js`** / **`src/geneticsUtils.js`**: `geneticsUtils.js` holds the handful of
  genuinely creature-agnostic helpers (Hungarian-algorithm `affectationMaximale`, Levenshtein
  `distanceLevenshtein`, `nomEnDoublon`, `couleursAncetres`, generic GPS-objective-picking) reused by
  all three `use<Creature>Elevage()` hooks; `muldoGenetique.js` is Muldo's own colour/generation/recipe
  engine plus OCR canonicalisation helpers, and re-exports the shared `geneticsUtils.js` functions it
  needs so Muldo.jsx only imports from one place.
- **`src/panneauxElevage.jsx`**: components genuinely shared across the three creatures where the
  UI/behaviour really is identical — `GpsDofusPage` (the whole GPS session UI, driven entirely by
  props/callbacks passed in per creature), `NomCopiable`/`CouleurCopiable`, `BebesARenommerPanel`,
  `ArbreGenealogiquePanel`, `CorbeillePanel`, `StatsCroisementsPanel`, `EstimationKamasTable`, the
  server selector. Each shared component takes the creature-specific bits as props
  (`BadgeComponent`, `generationDeCouleurFn`, `plierCouleurFn`, `couleursToutes`, …) rather than
  importing a specific creature's module.
- **`src/muldoOCR.js`**: `canonicaliserCouleur`, `correspondanceFloue` (Levenshtein-based fuzzy
  matching), `analyserTexteCaptureMuldo` reassemble the raw text Tesseract.js extracts from in-game
  screenshots into structured herd rows for Muldo — handling OCR quirks (misread digits, wrapped
  names, two-column layouts). Dragodinde/Volkorne's synchro pages currently do a much simpler
  "append everything pasted" import with no equivalent reconciliation/canonicalisation pass.
- **`src/Mangeoire.jsx`**: enclosure-feed recipe cost/profitability calculator, independent page.
- **`src/GuidePage.jsx`**, **`src/OnboardingOverlay.jsx`**: static help content and the first-visit /
  first-GPS-session guided tour overlays.
- **`src/stockage.js`**: despite the name of its API (`chargerJSON`/`sauvegarderJSON`, kept
  unchanged so callers didn't need touching), this is **not** `localStorage` — it's an in-memory
  cache (`{ [cle]: valeur }`) hydrated once per session from a single Supabase row
  (`sauvegardes_elevage`, one JSON blob per user, see `hydraterStockage(utilisateurId)`) and pushed
  back with a debounced, coalesced, auto-retrying network write (`marquerSale`/`pousserMaintenant`,
  800ms debounce / 1.6s retry). `sauvegarderJSON` itself can't fail (it only touches the in-memory
  cache and schedules a push) — write failures surface later, asynchronously, via
  `etatSauvegarde()` (`{ enAttente, dernierEchec }`, shown as the "sauvegarde…" / "échec, nouvel
  essai…" indicator in `App.jsx`'s header) rather than by throwing where `sauvegarderJSON` was
  called. `creerEcritureDebattue` adds a *second*, shorter local debounce (400ms) in front of this
  for rapid-fire UI events (slider drag, keystrokes) before a value even reaches the cache.
- **`src/pushNotifications.js`**, **`src/ErrorBoundary.jsx`**: web push subscription helpers and a
  top-level React error boundary.
- **`src/App.jsx`** (~3,250 lines): the shell — login/connected gate, top nav/sidebar, shared CSS
  design tokens (`<style>` block with `--gold`, `--gold2`, `--cyan`, `--muted`, `--font-display`
  custom properties; no router, page switching is a plain `useState("page")`), account/Supabase auth
  (`useCompte`), the Taverne (forum) page, `SauvegardePanel` (manual export/import backup —
  `CLES_SAUVEGARDE` is the full list of keys it covers), `SoutienPanel` (ailes de soutien), and the
  top-level wiring that instantiates all three `use<Creature>Elevage()` hooks and threads their props
  into each creature's pages. `src/main.jsx` just mounts `<App />` into `#root`; `src/index.css` is a
  4-line reset (do not reintroduce Vite's default template CSS — it breaks the sticky layout).

### Conventions

- Identifiers, comments, and all user-facing text are in French; keep new code consistent with that.
- Functional components + hooks only; no class components, no external state library (plain
  `useState`/`useMemo`/`useCallback`; each creature's state lives in its own `use<Creature>Elevage()`
  hook and is threaded to that creature's pages via props — see Architecture above).
- No CSS modules/Tailwind/styled-components — styling is the single embedded `<style>` block plus
  inline `style` objects using the CSS variables it defines.
- Persistence is `localStorage`, read/written directly with versioned key constants (`...-v1`,
  `...-v3`) — bump the suffix rather than silently changing a stored shape.

### OCR sync

`ImportCapturePanel` feeds a screenshot into `Tesseract.js` (`tesseract.js` package); the resulting
text goes through `normaliserTexteOCR` → `analyserTexteCaptureMuldo` → `canonicaliserCouleur` /
`correspondanceFloue` to reconcile fuzzy OCR'd colour names against the canonical `COULEURS_MULDO`
list before merging into the herd (`SynchronisationFiltresPage`).

### Ailes de soutien (support wings)

A cosmetic tier system rewarding donations, independent of gameplay data:
- 3 tiers (`NIVEAU_MAX_AILES` in `src/App.jsx`) mapped 1:1 to donation amounts in
  `MONTANTS_NIVEAUX = [5, 12, 20]` (€), each with a French title per style in `NOMS_NIVEAUX_AILES`
  (`dragodinde`: Envol Naissant → Majesté Solaire; `muldo`: Sang Neuf → Légende Vivante; `volkorne`:
  Braise Naissante → Apocalypse Vivante).
- 3 visual styles — `dragodinde`, `muldo`, `volkorne` — each themed on one of the app's creatures,
  selectable independently of tier, gated only by donation tier (the earlier `muldo`-only
  generation-success gate, `tierAilesMuldo`, was dropped 2026-08-01 for consistency across all three).
- The SVG/image assets and their progressive detail levels were designed for 5 tiers before the
  donation tiers were trimmed to 3; rather than redraw art, `VISUEL_PAR_NIVEAU = [1, 3, 5]` maps
  official tier 1/2/3 onto the original visual levels 1/3/5, so tiers 2 and 4's assets stay on disk
  unused. Keep this in mind before assuming a `{style}-N.png` file (N 1-5) is reachable from the UI.
- Rendering cascades: `AileNiveau` / `DemiAile` first try a static image at
  `public/ailes/{style}-{visualTier}.png` (and `-gauche`/`-droite` half-wing variants for framing a
  pseudo), falling back to `AileSvg`, a hand-drawn SVG that adds more detail/glow per visual level (2:
  veins/extra feathers, 3: bone structure/gilding, 4: spikes/halo + shimmer animation, 5: full
  apotheosis) — since only 1/3/5 are ever requested, tiers 2 and 4 of the SVG cascade are dead code
  paths too. Drop artwork into `public/ailes/` (see `public/ailes/LISEZMOI.txt`) to replace the SVGs;
  do not use extracted in-game assets in anything published (they're Ankama property).
- `PseudoAvecAiles` wraps a username with `DemiAile`s and a gradient-text ornament when the user has
  `soutien` — used throughout the Taverne (forum) to show off supporter status.
- Two parallel sources of truth: a per-account, non-authoritative preview (`profil.soutien` /
  `profil.niveauAiles` / `profil.styleAiles` in `SoutienPanel`, persisted like everything else
  through `chargerJSON`/`sauvegarderJSON` under `STORAGE_PROFIL` — see `src/stockage.js` above,
  it is **not** raw browser `localStorage`) purely for trying out the look before donating, versus
  the authoritative Supabase columns `profils.style_ailes` / `profils.niveau_ailes` shown once
  logged in (`ProfilModal`, `TavernePage`). `style_ailes` is user-editable via the app; `niveau_ailes`
  is **not** — see Supabase section below. Donations go through Stripe Checkout (live since
  2026-08-06 — see `supabase/functions/creer-session-don/` and `stripe-webhook/` below); tier
  assignment on payment is automatic via the webhook, not manual.

### Supabase (mandatory backend)

- `src/configSupabase.js` hardcodes the project URL and the **publishable** (browser-safe) key —
  this is intentional per the file's own comment; the secret/service key must never be added here.
- `src/supabaseClient.js` exports `supabase`, a client created only if `supabaseEstConfigure()`
  passes (URL starts with `https://`); code elsewhere must handle `supabase === null` for the
  fully-offline/no-backend case (all Supabase-backed features render a "needs configuration"
  fallback).
- `useCompte()` wraps `supabase.auth` (session, sign-in/up/out, password reset) and loads the
  matching row from `profils`.
- Schema/RLS: **`supabase-setup.sql`** is the single source of truth for the DB — it's an idempotent
  script (safe to re-run) meant to be pasted into the Supabase SQL editor, not a migrations folder.
  It defines:
  - `profils` (1:1 with `auth.users`): `pseudo` (unique — case-sensitively via a plain column
    constraint AND case-insensitively via a `lower(pseudo)` unique index, v26 — 2-10 chars, v24),
    `style_ailes`, `niveau_ailes` (0-10, only 1-5 used by the UI), `description` (≤300 chars),
    `serveur` (≤40 chars, v27), `est_modo` (moderator flag, v27, see below). RLS: readable by
    everyone, insertable/updatable only by the owning `auth.uid()`.
  - Trigger `protege_niveau_ailes`: silently reverts any client-side (`authenticated`/`anon` role)
    change to `niveau_ailes`, so wing tiers can only be granted via the Supabase SQL editor / Table
    editor / service role — i.e. manually, after verifying a real donation. `protege_est_modo` (v27)
    does the same for the moderator flag. `proteger_message_prive_lu` (v26) is the same pattern
    applied to a whole table instead of one column: the `messages_prives` `update` RLS policy only
    scopes by row ownership, not by column, so this trigger reverts every column except `lu` for
    client roles.
  - Trigger `creer_profil_inscription` (on `auth.users` insert): auto-creates the matching `profils`
    row, defaulting the pseudo from signup metadata or a generated `Eleveur-XXXXXX`.
  - **Moderator role (`est_modo`, v27-v28, v30)**: one account (`caly`) is flagged `est_modo = true`
    (granted manually via SQL, same access tier as `niveau_ailes`/`protege_est_modo` above — never
    settable by the client). `admin_fiche_utilisateur(cible uuid)` is a `security definer` RPC that
    checks the *caller's own* `est_modo` via `auth.uid()` before returning anything — so there's no
    additional RLS policy needed on the tables it reads. It returns, for any target profil: profil
    fields, `last_sign_in_at` (read from `auth.users`), cumulative donations, the full cheptel arrays
    for all 3 creatures and their GPS objective settings (from `sauvegardes_elevage`), and the last 20
    Taverne messages — **deliberately not** `messages_prives` (private DMs with other users), a line
    the user drew explicitly. Client side: `useCompte().estModo`, `ProfilPublicModal`'s
    `FicheAdminSection` (shown wherever a pseudo is clickable — Taverne, classement — when the viewer
    is a moderator), and a `est_modo`-gated "Modération" sidebar page (`ModerationPage`) with a
    Realtime Presence-based "who's online" list (channel `presence-eleveurs`, tracked by *every*
    logged-in client in `AppConnecte` regardless of role — low-sensitivity payload, no RLS/auth
    applies to the channel itself) plus a pseudo search. `FicheAdminSection`'s "voir le compte en
    entier" button opens `VueCompteModeration`, a full-screen read-only mirror of the target's
    cheptel + GPS settings — it reuses the real `CheptelCards`/`DragodindeCheptelCards`/
    `VolkorneCheptelCards` (pure/presentational, safe) but deliberately does **not** reuse
    `MuldoDetail`/`DragodindeDetail`/`VolkorneDetail` for the detail panel, since those are wired to
    `onPatch`/`onDelete` for real editing — it has its own hand-written read-only detail view instead,
    to guarantee zero write path onto another account. `v30` adds one real write path though: an
    extra RLS policy lets `est_modo` delete *any* Taverne message (`messages` table, RLS policies
    OR together — the original "supprimer son message"/`auth.uid() = auteur` policy from Muldo's
    first version still covers normal members). Client side, the existing per-message delete button
    (`TavernePage`, `Trash2` icon) is just gated on `session.user.id === m.auteur || compte.estModo`
    instead of author-only — no separate moderation-only UI needed.
  - `signalements_bugs` (v31): free-text bug reports, submitted via the "Signaler un bug" header
    button (`SignalerBugModal` in `App.jsx`) — requires a session (not available in guest mode,
    since there'd be no way to follow up with the reporter). RLS: insert only as yourself, select/
    update (the `traite` flag) restricted to `est_modo`. Read in `ModerationPage`'s new
    "🐛 Signalements de bugs" panel, which also resolves each `auteur` id to a pseudo via a
    `profils` lookup (moderators can already read all profils, no extra RLS needed there).
  - `sujets` (forum topics) and `messages` (forum posts, optionally scoped to a `sujet_id`, null =
    general chat) — both RLS: readable by everyone, insertable only as yourself. Both are added to
    the `supabase_realtime` publication; `TavernePage` subscribes to `postgres_changes` on them to
    live-update the forum.
  - When changing the schema, edit `supabase-setup.sql` in place (append a new idempotent block,
    e.g. following the existing `-- v4 : ...` comment convention) and re-run it in Supabase — there
    is no CLI/migration tooling wired up in this repo. Current up to `-- v35`.
  - `sauvegardes_manuelles` (v29): up-to-3 named full-account snapshots per user, distinct from the
    live `sauvegardes_elevage` blob — taken on demand via the "Sauvegarder" header button
    (`creerSauvegardeManuelle` in `src/stockage.js`), oldest dropped client-side once the cap is hit.
    RLS: owner-only select/insert/delete, no update policy (snapshots are immutable once written).
  - `essais_invite` (v32, v34, v35): one row per click on "Essayer sans compte" (`App()`'s
    `onEssayerSansCompte`) — a timestamp, used to show a guest-trial → real account conversion
    estimate in `ModerationPage`. The only table in the schema insertable by the `anon` role (every
    other insert policy requires `auth.uid()` ownership) since guest mode never authenticates the
    caller by design; read restricted to `est_modo` like `signalements_bugs`. v34 adds an `ip inet`
    column (captured server-side from the `x-forwarded-for` header via a `before insert` trigger,
    `essais_invite_capturer_ip()`) to spot the same address repeatedly restarting guest mode — but
    the column is never readable through the client API: `revoke select on ... from anon,
    authenticated` + `grant select (id, cree_le)` (a column-level revoke alone does **not** override
    a pre-existing table-level grant, which is why the table-wide revoke-then-re-grant pattern is
    needed here — this repo is public, so this distinction genuinely matters). The only way to use
    the IP is `essais_invite_repetitions()`, a `security definer` RPC (owner `postgres`, so
    unaffected by the revoke above) that internally checks `est_modo` and returns only aggregated
    counts (`nb_essais`, `premiere_fois`, `derniere_fois`) grouped by IP — the address itself is
    never returned to any client, moderators included. v35 adds two more of the same shape:
    `essais_invite_stats()` (total essais vs distinct IPs, i.e. attempts vs actual unique visitors)
    and `essais_invite_serie(granularite)` (day/week/month time-bucketed counts via `date_trunc`,
    validated against an allow-list before use) — `ModerationPage`'s Jour/Semaine/Mois toggle.

## Build & deploy

`npm run build` produces a fully static `dist/` (Vite + `@vitejs/plugin-react`, no SSR, no API
routes) — the app itself needs no server to run (the built assets are pure static files), but a
Supabase account is mandatory at runtime (see top of this file); the only external calls are to
Supabase and Google Fonts (preconnected in `index.html`).

**Cloudflare Pages is the official host** (https://registre-des-abysses.pages.dev, project
`registre-des-abysses` under Cloudflare account `801e66495c924dc14113e512d8ec3545`). Deployment is
automatic on every push to `main` via `.github/workflows/deploy-cloudflare.yml` (builds, then
`wrangler pages deploy dist`) — the workflow needs two repo secrets, `CLOUDFLARE_API_TOKEN`
(custom token, `Account > Cloudflare Pages > Edit` permission) and `CLOUDFLARE_ACCOUNT_ID`, set
under the GitHub repo's Settings → Secrets and variables → Actions. To deploy by hand instead:
`npm run build && npx wrangler pages deploy dist --project-name=registre-des-abysses` (needs the
same two values as env vars `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`).
- `functions/index.js` is a Cloudflare Pages Function (root-level, handles `/`): rewrites Open
  Graph/Twitter meta tags per-pseudo for `?voir=` cheptel-share links by fetching the profil's
  description from Supabase, HTML-escaping everything it interpolates. Falls through via
  `context.next()` for every other request.
- `public/_headers` applies baseline security headers site-wide (`X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and a deliberately
  minimal CSP — `frame-ancestors`/`object-src`/`base-uri` only, no `script-src`/`style-src`
  restriction since the app loads Google Fonts via a CSS `@import` and there's no HTML/script-
  injection sink to defend against) — Cloudflare Pages picks this file up automatically from
  `public/` (copied as-is into `dist/`, see below).
- Because routing is a single `App()` with in-memory `page` state (no client-side router/history
  changes), no SPA redirect rule is required, but add a `public/_redirects` if that ever changes.
- `public/` is copied as-is into `dist/` (see `public/ailes/` and `public/muldos/` for the
  drop-in-your-own-art asset folders, each documented by its `LISEZMOI.txt`).
- Netlify was the original host (`netlify.toml` + `netlify/edge-functions/og-partage.js`, the same
  OG-rewrite logic as `functions/index.js` above but in Netlify's edge function API) — dropped in
  favour of Cloudflare Pages; the config files were removed from the repo. `README.md` still lists
  Vercel as an alternative free option if ever needed (no config committed for it).

## Licence

`LICENSE` (all rights reserved, signed `caly191`) + `package.json`'s `"license": "UNLICENSED"` — this
is **not** an open-source project; don't add an OSI license header to new files, and don't assume
third-party reuse of this code is permitted.
