# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Registre des Abysses — a French-language companion web app for breeding "muldos" (mounts) in the
game Dofus: colour-genetics GPS/pathfinder for pairings, OCR-based stable sync from screenshots,
births/genealogy tracking, cloning, herd valuation, and a community layer (accounts + forum) with a
cosmetic donation system ("ailes de soutien"). Community tool, not affiliated with Ankama. All
breeding/herd data lives client-side in `localStorage`; Supabase is optional and only backs accounts,
public profiles, and the forum.

## Commands

```
npm install        # install dependencies
npm run dev         # Vite dev server
npm run build        # production build -> dist/
npm run preview      # serve the dist/ build locally
```

There is no lint script and no test suite configured in this repo.

## Architecture

### Single-file app

Almost the entire application lives in `src/App.jsx` (~7,200 lines). `src/main.jsx` just mounts
`<App />` into `#root`; `src/index.css` is a 4-line reset (do not reintroduce Vite's default
template CSS — it breaks the sticky layout). There is no router: page switching is a plain
`useState("page")` in `App()`, driven by `AppSidebar`'s nav list (`dashboard`, `cheptel`,
`synchronisation`, `gps`, `clonage`, `taverne`, `succes`). All design tokens/CSS live in a single
`<style>{`...`}`</style>` block rendered inside `App()` (CSS custom properties like `--gold`,
`--gold2`, `--cyan`, `--muted`, `--font-display`), not in separate stylesheets or a CSS framework.
Components style with inline `style={{}}` objects referencing those CSS variables.

Roughly, `App.jsx` is laid out as:
- **Domain/genetics engine** (top of file, before `export default function App()`): colour list
  (`COULEURS_MULDO`), generation table (`GENERATIONS_MULDO`), breeding recipes
  (`RECETTES_SPECIALES_MULDO`), and the pathfinding/optimisation functions that plan how to reach a
  target colour or generation (`meilleureRecettePourCouleur`, `construirePlanPourCouleur`,
  `optimiserSessionAccouplements` — uses a Hungarian-algorithm-style `affectationMaximale` for optimal
  male/female pairing, `choisirObjectifGpsAutomatique`, `progressionParGeneration`, etc.).
- **OCR text parsing**: `canonicaliserCouleur`, `correspondanceFloue` (Levenshtein-based fuzzy
  matching), `analyserTexteCaptureMuldo` reassemble the raw text Tesseract.js extracts from in-game
  screenshots into structured herd rows — handling OCR quirks (misread digits, wrapped names,
  two-column layouts).
- **`export default function App()`** (~line 1448): owns essentially all top-level state (herd,
  filters, GPS session, profile, journal, snapshots…) and persists most of it to `localStorage`
  under versioned keys (`STORAGE_KEY`, `STORAGE_HISTORY_KEY`, `STORAGE_GPS_SESSION`,
  `STORAGE_NAISSANCES`, `STORAGE_JOURNAL`, `STORAGE_INSTANTANES`, `STORAGE_PROFIL`, …). The full list
  used for the manual export/import backup feature (`SauvegardePanel`) is `CLES_SAUVEGARDE`.
- **Page/panel components** below `App()`: one function per page or panel (e.g.
  `CheptelOverviewPage`, `GpsDofusPage`, `SynchronisationFiltresPage`, `ClonagePage`, `TavernePage`,
  `SuccesDofusPage`, `ArbreGenealogiquePanel`, `GraphiquesPanel`, `SauvegardePanel`, `SoutienPanel`).

### Conventions

- Identifiers, comments, and all user-facing text are in French; keep new code consistent with that.
- Functional components + hooks only; no class components, no external state library (plain
  `useState`/`useMemo`/`useCallback`, state is threaded via props from `App()`).
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
- Two parallel sources of truth: a local, unauthenticated preview (`profil.soutien` /
  `profil.niveauAiles` / `profil.styleAiles` in `SoutienPanel`, stored in `localStorage` under
  `STORAGE_PROFIL`) purely for trying out the look before donating, versus the authoritative
  Supabase columns `profils.style_ailes` / `profils.niveau_ailes` shown once logged in
  (`ProfilModal`, `TavernePage`). `style_ailes` is user-editable via the app; `niveau_ailes` is
  **not** — see Supabase section below. There is no payment integration yet: donations (via the
  PayPal link in `LIEN_DON`, `src/configSupabase.js`) are reconciled and tiers assigned manually by
  an admin directly in Supabase.

### Supabase (optional backend)

- `src/configSupabase.js` hardcodes the project URL and the **publishable** (browser-safe) key —
  this is intentional per the file's own comment; the secret/service key must never be added here.
  It also holds `LIEN_DON`, the donation link shown on the profile page (empty string hides it).
- `src/supabaseClient.js` exports `supabase`, a client created only if `supabaseEstConfigure()`
  passes (URL starts with `https://`); code elsewhere must handle `supabase === null` for the
  fully-offline/no-backend case (all Supabase-backed features render a "needs configuration"
  fallback).
- `useCompte()` wraps `supabase.auth` (session, sign-in/up/out, password reset) and loads the
  matching row from `profils`.
- Schema/RLS: **`supabase-setup.sql`** is the single source of truth for the DB — it's an idempotent
  script (safe to re-run) meant to be pasted into the Supabase SQL editor, not a migrations folder.
  It defines:
  - `profils` (1:1 with `auth.users`): `pseudo` (unique, 2-20 chars), `style_ailes`, `niveau_ailes`
    (0-10, only 1-5 used by the UI), `description` (≤300 chars). RLS: readable by everyone,
    insertable/updatable only by the owning `auth.uid()`.
  - Trigger `protege_niveau_ailes`: silently reverts any client-side (`authenticated`/`anon` role)
    change to `niveau_ailes`, so wing tiers can only be granted via the Supabase SQL editor / Table
    editor / service role — i.e. manually, after verifying a real donation.
  - Trigger `creer_profil_inscription` (on `auth.users` insert): auto-creates the matching `profils`
    row, defaulting the pseudo from signup metadata or a generated `Eleveur-XXXXXX`.
  - `email_pour_pseudo(text)` RPC: lets the login form accept a pseudo instead of an email.
  - `sujets` (forum topics) and `messages` (forum posts, optionally scoped to a `sujet_id`, null =
    general chat) — both RLS: readable by everyone, insertable only as yourself. Both are added to
    the `supabase_realtime` publication; `TavernePage` subscribes to `postgres_changes` on them to
    live-update the forum.
  - When changing the schema, edit `supabase-setup.sql` in place (append a new idempotent block,
    e.g. following the existing `-- v4 : ...` comment convention) and re-run it in Supabase — there
    is no CLI/migration tooling wired up in this repo.

## Build & deploy

`npm run build` produces a fully static `dist/` (Vite + `@vitejs/plugin-react`, no SSR, no API
routes) — the app needs no server: all breeding/herd data stays in the visitor's browser, and the
only external calls are to Supabase (if configured) and Google Fonts (preconnected in `index.html`).

There is no `netlify.toml` in the repo yet. To deploy on Netlify:
- **Quick/manual**: `npm run build`, then drag-and-drop the resulting `dist/` folder onto
  https://app.netlify.com/drop (as documented in `README.md`).
- **Continuous deployment from Git**: connect the repository in Netlify and set build command
  `npm run build` and publish directory `dist`; no environment variables are required since Supabase
  credentials are committed in `src/configSupabase.js` rather than injected at build time. Because
  routing is a single `App()` with in-memory `page` state (no client-side router/history changes),
  no SPA redirect rule (`/* -> /index.html`) is strictly required, but add one if that ever changes.
- `public/` is copied as-is into `dist/` (see `public/ailes/` and `public/muldos/` for the
  drop-in-your-own-art asset folders, each documented by its `LISEZMOI.txt`).
