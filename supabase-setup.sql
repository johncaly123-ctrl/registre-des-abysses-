-- ============================================================
-- Registre des Abysses — installation de la base (v3 : forum)
-- Ré-exécutable sans risque par-dessus les versions précédentes.
-- ============================================================

create table if not exists profils (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text unique not null check (char_length(pseudo) between 2 and 20),
  style_ailes text not null default 'or' check (style_ailes in ('or', 'abysses')),
  niveau_ailes int not null default 0 check (niveau_ailes between 0 and 10),
  cree_le timestamptz not null default now()
);
alter table profils enable row level security;
drop policy if exists "profils visibles par tous" on profils;
create policy "profils visibles par tous" on profils for select using (true);
drop policy if exists "creer son profil" on profils;
create policy "creer son profil" on profils for insert with check (auth.uid() = id);
drop policy if exists "modifier son profil" on profils;
create policy "modifier son profil" on profils for update using (auth.uid() = id);

create or replace function protege_niveau_ailes() returns trigger as $$
begin
  -- Bloque le changement de niveau UNIQUEMENT pour les utilisateurs de l'app
  -- (rôles authenticated / anon). Les accès administrateur (SQL Editor, Table
  -- Editor, service_role) passent librement pour attribuer les ailes.
  if new.niveau_ailes is distinct from old.niveau_ailes
     and coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    new.niveau_ailes := old.niveau_ailes;
  end if;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists trg_protege_niveau on profils;
create trigger trg_protege_niveau before update on profils
  for each row execute function protege_niveau_ailes();

create or replace function creer_profil_inscription() returns trigger as $$
begin
  insert into public.profils (id, pseudo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'pseudo'), ''), 'Eleveur-' || left(new.id::text, 6))
  );
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists trg_creer_profil on auth.users;
create trigger trg_creer_profil after insert on auth.users
  for each row execute function creer_profil_inscription();

create or replace function email_pour_pseudo(p text) returns text as $$
  select u.email
  from auth.users u
  join public.profils pr on pr.id = u.id
  where lower(pr.pseudo) = lower(trim(p))
  limit 1;
$$ language sql security definer;
grant execute on function email_pour_pseudo(text) to anon, authenticated;


-- v4 : description publique du profil (300 caractères max)
alter table profils add column if not exists description text not null default '' ;
do $$ begin
  alter table profils add constraint description_longueur check (char_length(description) <= 300);
exception when duplicate_object then null; end $$;

-- Sujets du forum de la Taverne
create table if not exists sujets (
  id bigint generated always as identity primary key,
  auteur uuid references profils(id) on delete set null,
  titre text not null check (char_length(titre) between 3 and 80),
  cree_le timestamptz not null default now()
);
alter table sujets enable row level security;
drop policy if exists "sujets visibles par tous" on sujets;
create policy "sujets visibles par tous" on sujets for select using (true);
drop policy if exists "creer un sujet connecte" on sujets;
create policy "creer un sujet connecte" on sujets for insert with check (auth.uid() = auteur);

-- Messages : rattachés à un sujet (null = Comptoir général)
create table if not exists messages (
  id bigint generated always as identity primary key,
  auteur uuid not null references profils(id) on delete cascade,
  contenu text not null check (char_length(contenu) between 1 and 2000),
  cree_le timestamptz not null default now()
);
alter table messages add column if not exists sujet_id bigint references sujets(id) on delete cascade;
alter table messages enable row level security;
drop policy if exists "messages visibles par tous" on messages;
create policy "messages visibles par tous" on messages for select using (true);
drop policy if exists "poster quand connecte" on messages;
create policy "poster quand connecte" on messages for insert with check (auth.uid() = auteur);

do $$ begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table sujets;
exception when duplicate_object then null; end $$;

-- v5 : changement de test (accès SQL direct via l'API de gestion Supabase)
comment on table profils is 'Profils publics des éleveurs — pseudo, ailes de soutien, description.';

-- v6 : ailes "muldo" débloquées par succès de génération (en plus du don)
-- Auto-déclaratif comme historiqueCouleurs aujourd'hui : pas de trigger de
-- protection, la policy d'update existante (auth.uid() = id) suffit — ce
-- champ reflète une progression calculée côté client à partir de données
-- déjà locales, le tricher ne rapporte rien puisqu'il ne reflète plus la
-- vraie progression du joueur.
alter table profils add column if not exists succes_generation_muldo int not null default 0;
do $$ begin
  alter table profils add constraint succes_generation_muldo_bornes check (succes_generation_muldo between 0 and 10);
exception when duplicate_object then null; end $$;

alter table profils drop constraint if exists profils_style_ailes_check;
alter table profils add constraint profils_style_ailes_check check (style_ailes in ('or', 'abysses', 'muldo'));

-- v7 : seulement 3 styles d'ailes (dragodinde, muldo, volkorne) — or/abysses retirés
update profils set style_ailes = 'muldo' where style_ailes in ('or', 'abysses');
alter table profils drop constraint if exists profils_style_ailes_check;
alter table profils add constraint profils_style_ailes_check check (style_ailes in ('dragodinde', 'muldo', 'volkorne'));
alter table profils alter column style_ailes set default 'muldo';

-- v8 : suppression de ses propres sujets/messages, messages privés
drop policy if exists "supprimer son sujet" on sujets;
create policy "supprimer son sujet" on sujets for delete using (auth.uid() = auteur);

drop policy if exists "supprimer son message" on messages;
create policy "supprimer son message" on messages for delete using (auth.uid() = auteur);

create table if not exists messages_prives (
  id bigint generated always as identity primary key,
  expediteur uuid not null references profils(id) on delete cascade,
  destinataire uuid not null references profils(id) on delete cascade,
  contenu text not null check (char_length(contenu) between 1 and 2000),
  lu boolean not null default false,
  cree_le timestamptz not null default now()
);
alter table messages_prives enable row level security;
drop policy if exists "voir ses messages prives" on messages_prives;
create policy "voir ses messages prives" on messages_prives for select using (auth.uid() = expediteur or auth.uid() = destinataire);
drop policy if exists "envoyer un message prive" on messages_prives;
create policy "envoyer un message prive" on messages_prives for insert with check (auth.uid() = expediteur and expediteur <> destinataire);
drop policy if exists "marquer ses messages recus comme lus" on messages_prives;
create policy "marquer ses messages recus comme lus" on messages_prives for update using (auth.uid() = destinataire) with check (auth.uid() = destinataire);

do $$ begin
  alter publication supabase_realtime add table messages_prives;
exception when duplicate_object then null; end $$;

-- v9 : classement des éleveurs — nombre de couleurs muldo découvertes,
-- auto-déclaratif comme succes_generation_muldo (v6), même justification.
alter table profils add column if not exists couleurs_decouvertes_muldo int not null default 0;
do $$ begin
  alter table profils add constraint couleurs_decouvertes_muldo_bornes check (couleurs_decouvertes_muldo between 0 and 999);
exception when duplicate_object then null; end $$;

-- v10 : abonnements aux notifications push (nouveaux messages privés).
-- Stocke uniquement l'objet PushSubscription du navigateur ; l'envoi effectif
-- côté serveur (clé VAPID privée + Edge Function/webhook) reste à mettre en
-- place manuellement, voir README ou la conversation d'implémentation.
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  utilisateur uuid not null references profils(id) on delete cascade,
  endpoint text not null,
  souscription jsonb not null,
  cree_le timestamptz not null default now(),
  unique (utilisateur, endpoint)
);
alter table push_subscriptions enable row level security;
drop policy if exists "voir ses abonnements push" on push_subscriptions;
create policy "voir ses abonnements push" on push_subscriptions for select using (auth.uid() = utilisateur);
drop policy if exists "creer son abonnement push" on push_subscriptions;
create policy "creer son abonnement push" on push_subscriptions for insert with check (auth.uid() = utilisateur);
drop policy if exists "supprimer son abonnement push" on push_subscriptions;
create policy "supprimer son abonnement push" on push_subscriptions for delete using (auth.uid() = utilisateur);

-- v11 : déclenche l'Edge Function "rapid-function" (voir
-- supabase/functions/envoyer-push/index.ts) à chaque nouveau message privé,
-- pour l'envoi effectif des notifications push. verify_jwt est désactivé sur
-- la fonction, donc aucun header d'authentification n'est nécessaire ici.
create extension if not exists pg_net;

create or replace function public.notifier_nouveau_message_prive()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://fcdculpkrcuhtexmqojz.supabase.co/functions/v1/rapid-function',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_nouveau_message_prive on messages_prives;
create trigger on_nouveau_message_prive
after insert on messages_prives
for each row execute function public.notifier_nouveau_message_prive();

-- v12 : classement des éleveurs étendu aux 3 créatures (dragodinde, volkorne)
-- — mêmes colonnes auto-déclaratives que succes_generation_muldo (v6) et
-- couleurs_decouvertes_muldo (v9), même justification.
alter table profils add column if not exists succes_generation_dragodinde int not null default 0;
do $$ begin
  alter table profils add constraint succes_generation_dragodinde_bornes check (succes_generation_dragodinde between 0 and 10);
exception when duplicate_object then null; end $$;
alter table profils add column if not exists couleurs_decouvertes_dragodinde int not null default 0;
do $$ begin
  alter table profils add constraint couleurs_decouvertes_dragodinde_bornes check (couleurs_decouvertes_dragodinde between 0 and 999);
exception when duplicate_object then null; end $$;

alter table profils add column if not exists succes_generation_volkorne int not null default 0;
do $$ begin
  alter table profils add constraint succes_generation_volkorne_bornes check (succes_generation_volkorne between 0 and 10);
exception when duplicate_object then null; end $$;
alter table profils add column if not exists couleurs_decouvertes_volkorne int not null default 0;
do $$ begin
  alter table profils add constraint couleurs_decouvertes_volkorne_bornes check (couleurs_decouvertes_volkorne between 0 and 999);
exception when duplicate_object then null; end $$;

-- v13 : prix communautaires par serveur, pour l'estimation de la valeur du
-- cheptel (page Dashboard). Chaque soumission est individuelle ; l'app agrège
-- côté SQL par médiane (résiste mieux qu'une moyenne à une soumission
-- aberrante/troll) via la vue prix_communautaires_medianes.
create table if not exists prix_communautaires (
  id bigint generated always as identity primary key,
  creature text not null check (creature in ('muldo','dragodinde','volkorne')),
  couleur text not null check (char_length(couleur) between 1 and 60),
  serveur text not null check (char_length(serveur) between 1 and 40),
  prix numeric not null check (prix >= 0 and prix <= 1000000),
  auteur uuid not null references profils(id) on delete cascade,
  cree_le timestamptz not null default now()
);
alter table prix_communautaires enable row level security;
drop policy if exists "prix communautaires visibles par tous" on prix_communautaires;
create policy "prix communautaires visibles par tous" on prix_communautaires for select using (true);
drop policy if exists "soumettre un prix connecte" on prix_communautaires;
create policy "soumettre un prix connecte" on prix_communautaires for insert with check (auth.uid() = auteur);
drop policy if exists "modifier son propre prix" on prix_communautaires;
create policy "modifier son propre prix" on prix_communautaires for update using (auth.uid() = auteur) with check (auth.uid() = auteur);
drop policy if exists "supprimer son propre prix" on prix_communautaires;
create policy "supprimer son propre prix" on prix_communautaires for delete using (auth.uid() = auteur);
-- Une seule soumission active par éleveur/couleur/serveur : une nouvelle
-- soumission remplace la précédente plutôt que de s'accumuler.
do $$ begin
  alter table prix_communautaires add constraint prix_communautaires_unique unique (creature, couleur, serveur, auteur);
exception when duplicate_object then null; end $$;

create or replace view prix_communautaires_medianes as
select
  creature,
  couleur,
  serveur,
  percentile_cont(0.5) within group (order by prix) as prix_median,
  count(*) as nb_soumissions
from prix_communautaires
group by creature, couleur, serveur;

-- v14 : cheptel public partageable (instantané publié volontairement, pas de
-- miroir continu — le joueur choisit explicitement quand publier). contenu
-- est un sous-ensemble volontairement restreint (couleur/sexe/génération/
-- statut) : pas de notes privées, pas de dates, pas de jauges.
create table if not exists cheptels_publics (
  utilisateur uuid not null references profils(id) on delete cascade,
  creature text not null check (creature in ('muldo','dragodinde','volkorne')),
  contenu jsonb not null,
  maj_le timestamptz not null default now(),
  primary key (utilisateur, creature)
);
alter table cheptels_publics enable row level security;
drop policy if exists "cheptels publics visibles par tous" on cheptels_publics;
create policy "cheptels publics visibles par tous" on cheptels_publics for select using (true);
drop policy if exists "publier son propre cheptel" on cheptels_publics;
create policy "publier son propre cheptel" on cheptels_publics for insert with check (auth.uid() = utilisateur);
drop policy if exists "mettre a jour son propre cheptel publie" on cheptels_publics;
create policy "mettre a jour son propre cheptel publie" on cheptels_publics for update using (auth.uid() = utilisateur) with check (auth.uid() = utilisateur);
drop policy if exists "depublier son propre cheptel" on cheptels_publics;
create policy "depublier son propre cheptel" on cheptels_publics for delete using (auth.uid() = utilisateur);

-- v15 : programme de parrainage leger. parrain_id capture, au moment de
-- l'inscription, le pseudo transmis via le lien ?parrain=<pseudo> (metadata
-- signUp) -- volontairement independant du systeme d'ailes payant : aucune
-- recompense automatique n'est attribuee ici, juste un compteur cote client
-- (filleuls inscrits / actifs) affiche sur le profil.
alter table profils add column if not exists parrain_id uuid references profils(id) on delete set null;
create index if not exists idx_profils_parrain on profils(parrain_id);

create or replace function creer_profil_inscription() returns trigger as $$
declare
  parrain_pseudo text := nullif(trim(new.raw_user_meta_data ->> 'parrain'), '');
  parrain_uuid uuid;
begin
  if parrain_pseudo is not null then
    select id into parrain_uuid from public.profils where lower(pseudo) = lower(parrain_pseudo) limit 1;
  end if;
  insert into public.profils (id, pseudo, parrain_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'pseudo'), ''), 'Eleveur-' || left(new.id::text, 6)),
    parrain_uuid
  );
  return new;
end;
$$ language plpgsql security definer;

-- v16 : serveur Dofus choisi tout en haut de page (en-tête), lié au compte
-- pour suivre l'éleveur d'un appareil à l'autre. Simple étiquette texte (la
-- liste figée proposée côté client peut évoluer sans migration) ; sert aussi
-- de source pour les prix communautaires par serveur (v13).
alter table profils add column if not exists serveur text;

-- v17 : prix communautaires des ingrédients de mangeoire d'enclos, par
-- serveur (page Mangeoire) -- même principe que prix_communautaires (v13)
-- mais indexé par nom d'ingrédient plutôt que par couleur/créature, un
-- ingrédient donné (ex. "Or") ayant le même prix quelle que soit la
-- recette qui l'utilise. Table séparée plutôt que de réutiliser
-- prix_communautaires : domaine différent (ingrédients, pas couleurs).
create table if not exists prix_communautaires_ingredients (
  id bigint generated always as identity primary key,
  ingredient text not null check (char_length(ingredient) between 1 and 80),
  serveur text not null check (char_length(serveur) between 1 and 40),
  prix numeric not null check (prix >= 0 and prix <= 1000000),
  auteur uuid not null references profils(id) on delete cascade,
  cree_le timestamptz not null default now()
);
alter table prix_communautaires_ingredients enable row level security;
drop policy if exists "prix ingredients visibles par tous" on prix_communautaires_ingredients;
create policy "prix ingredients visibles par tous" on prix_communautaires_ingredients for select using (true);
drop policy if exists "soumettre un prix ingredient connecte" on prix_communautaires_ingredients;
create policy "soumettre un prix ingredient connecte" on prix_communautaires_ingredients for insert with check (auth.uid() = auteur);
drop policy if exists "modifier son propre prix ingredient" on prix_communautaires_ingredients;
create policy "modifier son propre prix ingredient" on prix_communautaires_ingredients for update using (auth.uid() = auteur) with check (auth.uid() = auteur);
drop policy if exists "supprimer son propre prix ingredient" on prix_communautaires_ingredients;
create policy "supprimer son propre prix ingredient" on prix_communautaires_ingredients for delete using (auth.uid() = auteur);
do $$ begin
  alter table prix_communautaires_ingredients add constraint prix_communautaires_ingredients_unique unique (ingredient, serveur, auteur);
exception when duplicate_object then null; end $$;

create or replace view prix_communautaires_ingredients_medianes as
select
  ingredient,
  serveur,
  percentile_cont(0.5) within group (order by prix) as prix_median,
  count(*) as nb_soumissions
from prix_communautaires_ingredients
group by ingredient, serveur;

-- v18 : cumul reel des dons (au lieu du seul montant de la derniere
-- transaction) pour permettre de monter de palier en ne payant que la
-- difference. Table separee de profils (comme prix_communautaires_*) :
-- historique auditable, insertion idempotente via stripe_session_id unique.
create table if not exists dons (
  id bigint generated always as identity primary key,
  profil_id uuid not null references profils(id) on delete cascade,
  montant_euros numeric not null check (montant_euros > 0),
  stripe_session_id text not null unique,
  cree_le timestamptz not null default now()
);
alter table dons enable row level security;
drop policy if exists "dons visibles par leur auteur" on dons;
create policy "dons visibles par leur auteur" on dons for select using (auth.uid() = profil_id);
-- Pas de policy insert/update/delete pour authenticated/anon : seul le
-- service_role (webhook) ecrit ici, meme logique que niveau_ailes.

-- Reconciliation retroactive : les dons faits AVANT cette migration (test
-- Stripe du 2026-07-24 inclus) n'ont pas de ligne dans `dons`. Sans ca, le
-- cumul recalcule a partir de `dons` sous-estimerait ce qu'ils ont deja
-- donne et leur redemanderait de payer plus que necessaire pour monter de
-- palier. On seme une ligne de reconciliation au montant plancher de leur
-- palier actuel (minoration volontaire : jamais plus que ce qu'ils ont
-- reellement paye, jamais moins que le seuil de leur palier deja acquis).
insert into dons (profil_id, montant_euros, stripe_session_id, cree_le)
select id, case niveau_ailes when 1 then 5 when 2 then 8 when 3 then 12 when 4 then 16 when 5 then 20 end,
       'legacy-' || id, now()
from profils
where niveau_ailes between 1 and 5
on conflict (stripe_session_id) do nothing;

-- v19 : source unique de verite pour les donnees d'elevage d'un compte
-- (cheptels, naissances, journal, corbeille, session GPS, instantanes, prix
-- personnels, preferences UI...) -- remplace les ~30 cles localStorage
-- dispersees par un seul blob JSON par compte. Contrairement a
-- cheptels_publics (v14), qui est un instantane PUBLIC restreint publie a la
-- main, ceci est prive et continu (une ligne = l'etat courant complet).
create table if not exists sauvegardes_elevage (
  utilisateur uuid primary key references profils(id) on delete cascade,
  donnees jsonb not null default '{}'::jsonb,
  maj_le timestamptz not null default now()
);
alter table sauvegardes_elevage enable row level security;
drop policy if exists "voir sa propre sauvegarde" on sauvegardes_elevage;
create policy "voir sa propre sauvegarde" on sauvegardes_elevage for select using (auth.uid() = utilisateur);
drop policy if exists "creer sa propre sauvegarde" on sauvegardes_elevage;
create policy "creer sa propre sauvegarde" on sauvegardes_elevage for insert with check (auth.uid() = utilisateur);
drop policy if exists "modifier sa propre sauvegarde" on sauvegardes_elevage;
create policy "modifier sa propre sauvegarde" on sauvegardes_elevage for update using (auth.uid() = utilisateur) with check (auth.uid() = utilisateur);
-- Pas de policy delete cote client : la suppression du compte (cascade
-- depuis profils/auth.users) suffit.

create or replace function toucher_maj_sauvegarde_elevage() returns trigger as $$
begin
  new.maj_le := now();
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_maj_sauvegarde_elevage on sauvegardes_elevage;
create trigger trg_maj_sauvegarde_elevage before update on sauvegardes_elevage
  for each row execute function toucher_maj_sauvegarde_elevage();

-- v20 : citation d'un message dans une reponse (Taverne). on delete set null
-- pour que la suppression du message cite ne casse jamais l'affichage de la
-- citation -- pas de policy a toucher, l'insert existant
-- (auth.uid() = auteur) ne restreint aucune autre colonne.
alter table messages add column if not exists cite_message_id bigint references messages(id) on delete set null;

-- v21 : abonnement par sujet aux notifications push, en plus des messages
-- prives (v10/v11). Volontairement limite aux vrais sujets (sujet_id
-- bigint, jamais null) -- le Comptoir general (sujet_id null) est hors
-- perimetre.
create table if not exists abonnements_sujets (
  utilisateur uuid not null references profils(id) on delete cascade,
  sujet_id bigint not null references sujets(id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (utilisateur, sujet_id)
);
alter table abonnements_sujets enable row level security;
drop policy if exists "voir ses abonnements de sujet" on abonnements_sujets;
create policy "voir ses abonnements de sujet" on abonnements_sujets for select using (auth.uid() = utilisateur);
drop policy if exists "creer son abonnement de sujet" on abonnements_sujets;
create policy "creer son abonnement de sujet" on abonnements_sujets for insert with check (auth.uid() = utilisateur);
drop policy if exists "supprimer son abonnement de sujet" on abonnements_sujets;
create policy "supprimer son abonnement de sujet" on abonnements_sujets for delete using (auth.uid() = utilisateur);

-- Declenche la meme Edge Function "rapid-function" que v11 (voir
-- supabase/functions/envoyer-push/index.ts) a chaque nouveau message poste
-- dans un vrai sujet.
create or replace function public.notifier_nouveau_message_sujet()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://fcdculpkrcuhtexmqojz.supabase.co/functions/v1/rapid-function',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_nouveau_message_sujet on messages;
create trigger on_nouveau_message_sujet
after insert on messages
for each row when (new.sujet_id is not null)
execute function public.notifier_nouveau_message_sujet();

-- v22 : changement de pseudo limite a une fois tous les 30 jours. A la
-- difference de protege_niveau_ailes (v3), qui revert silencieusement une
-- modif interdite, ici l'utilisateur EST legitime a tenter le changement et
-- merite une vraie erreur (avec date de reeligibilite). Colonne nullable :
-- null = jamais change = eligible immediatement (comptes existants non
-- bloques retroactivement).
alter table profils add column if not exists pseudo_change_le timestamptz;

create or replace function public.limiter_changement_pseudo() returns trigger as $$
begin
  if new.pseudo is distinct from old.pseudo
     and coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    if old.pseudo_change_le is not null and now() - old.pseudo_change_le < interval '30 days' then
      raise exception 'pseudo_cooldown:%', to_char((old.pseudo_change_le + interval '30 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    end if;
    new.pseudo_change_le := now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_limiter_changement_pseudo on profils;
create trigger trg_limiter_changement_pseudo before update on profils
  for each row execute function public.limiter_changement_pseudo();

-- v23 : authentification email uniquement (fin de la connexion par pseudo)
-- -- AuthPanel n'appelle plus resoudreEmail/email_pour_pseudo ; cette RPC
-- security definer, grantee a `anon`, servait exclusivement a ca et
-- constituait une legere surface de sondage d'existence de pseudo.
drop function if exists email_pour_pseudo(text);

-- v24 : pseudo limite a 10 caracteres (au lieu de 20). Le filtre anti-injure
-- reste volontairement cote client (AuthPanel/ProfilModal dans App.jsx) --
-- une liste de mots interdits a besoin d'etre facile a completer sans
-- migration SQL a chaque ajout, contrairement a la longueur qui est une
-- regle stable et merite d'etre imposee cote base.
alter table profils drop constraint if exists profils_pseudo_check;
alter table profils add constraint profils_pseudo_check check (char_length(pseudo) between 2 and 10);

-- v25 : secret partage entre les triggers push (v11/v21) et la fonction Edge
-- envoyer-push (verify_jwt desactive dessus, voir son en-tete de fichier) --
-- sans ca, n'importe qui connaissant l'URL publique de la fonction pouvait
-- forger une notification push vers n'importe quel utilisateur. Le secret
-- est genere une seule fois et vit chiffre dans Supabase Vault, jamais en
-- clair dans ce fichier committe.
create extension if not exists pgcrypto;
create extension if not exists supabase_vault;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_webhook_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'push_webhook_secret');
  end if;
end $$;

create or replace function public.notifier_nouveau_message_prive()
returns trigger as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  perform net.http_post(
    url := 'https://fcdculpkrcuhtexmqojz.supabase.co/functions/v1/rapid-function',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.notifier_nouveau_message_sujet()
returns trigger as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  perform net.http_post(
    url := 'https://fcdculpkrcuhtexmqojz.supabase.co/functions/v1/rapid-function',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Recupere la valeur a coller dans Dashboard Supabase -> Edge Functions ->
-- envoyer-push -> Secrets -> PUSH_WEBHOOK_SECRET (a executer une seule fois,
-- de preference directement dans l'editeur SQL du dashboard plutot que de
-- faire transiter la valeur ailleurs) :
--   select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret';

-- v26 : petites failles trouvees en revue de securite (2026-08-03).
--
-- 1) La policy update de messages_prives (v8) n'autorisait que le destinataire
--    a modifier la ligne, mais sans restreindre QUELLES colonnes -- un appel
--    direct a l'API REST (JWT valide, hors UI) aurait pu reecrire "contenu"
--    ou "expediteur" d'un message recu, pas seulement "lu". Meme principe que
--    protege_niveau_ailes (v3) : revert silencieusement tout sauf "lu" pour
--    les roles authenticated/anon, laisse passer service_role.
create or replace function public.proteger_message_prive_lu() returns trigger as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    new.expediteur := old.expediteur;
    new.destinataire := old.destinataire;
    new.contenu := old.contenu;
    new.cree_le := old.cree_le;
  end if;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists trg_proteger_message_prive_lu on messages_prives;
create trigger trg_proteger_message_prive_lu before update on messages_prives
  for each row execute function public.proteger_message_prive_lu();

-- 2) Le pseudo etait verifie insensible a la casse cote client (ilike) mais
--    la contrainte unique en base est sensible a la casse -- un appel direct
--    a l'API (hors formulaire d'inscription) pouvait creer "Muldo_Roi" et
--    "muldo_roi" comme deux comptes distincts. Index unique sur la forme en
--    minuscules pour l'imposer aussi cote base.
create unique index if not exists profils_pseudo_lower_unique on profils (lower(pseudo));

-- 3) profils.serveur (v16) n'avait aucune contrainte de longueur, contrairement
--    a toutes les autres colonnes texte editables par l'utilisateur.
alter table profils drop constraint if exists profils_serveur_check;
alter table profils add constraint profils_serveur_check check (serveur is null or char_length(serveur) <= 40);

-- v27 : role moderateur -- console "qui est en ligne" (presence Realtime,
-- cote client uniquement, rien a migrer ici) + fiche detaillee d'un eleveur
-- cliquable depuis un pseudo. Perimetre volontairement limite a l'activite
-- PUBLIQUE + au cheptel/genealogie : PAS d'acces aux messages_prives d'autrui
-- (decision explicite, voir conversation d'implementation 2026-08-03).
alter table profils add column if not exists est_modo boolean not null default false;

create or replace function protege_est_modo() returns trigger as $$
begin
  -- Meme principe que protege_niveau_ailes (v3) : seul un acces admin
  -- (SQL Editor / Table Editor / service_role) peut promouvoir un moderateur.
  if new.est_modo is distinct from old.est_modo
     and coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    new.est_modo := old.est_modo;
  end if;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists trg_protege_est_modo on profils;
create trigger trg_protege_est_modo before update on profils
  for each row execute function protege_est_modo();

-- Pour promouvoir un compte moderateur (a executer une seule fois, dans
-- l'editeur SQL du dashboard, avec l'email exact du compte) :
--   update profils set est_modo = true
--   where id = (select id from auth.users where email = 'ADRESSE_EMAIL_ICI');

-- Fonction appelee par le client (ProfilPublicModal) quand un moderateur
-- clique sur un pseudo : verifie elle-meme l'habilitation (auth.uid()
-- courant), donc aucune policy RLS supplementaire n'est necessaire sur les
-- tables qu'elle lit. N'expose ni messages_prives ni aucune donnee d'un
-- autre compte que celles listees ci-dessous. v28 : ajoute les reglages GPS
-- (objectif/mode par creature) pour que la "vue compte complet" cote client
-- (VueCompteModeration) puisse afficher, en plus du cheptel, sur quoi le GPS
-- de l'eleveur est regle -- toujours en lecture seule, aucune ecriture ici.
create or replace function public.admin_fiche_utilisateur(cible uuid)
returns jsonb as $$
declare
  derniere_connexion timestamptz;
  total_dons numeric;
  cheptel jsonb;
  gps jsonb;
  messages_recents jsonb;
  resultat jsonb;
begin
  if not exists (select 1 from profils where id = auth.uid() and est_modo) then
    raise exception 'reserve aux moderateurs';
  end if;

  begin
    select last_sign_in_at into derniere_connexion from auth.users where id = cible;
  exception when others then
    derniere_connexion := null;
  end;

  select coalesce(sum(montant_euros), 0) into total_dons from dons where profil_id = cible;

  select
    jsonb_build_object(
      'muldos', coalesce(donnees -> 'cheptel-muldos-v1', '[]'::jsonb),
      'dragodindes', coalesce(donnees -> 'cheptel-dragodindes-v1', '[]'::jsonb),
      'volkornes', coalesce(donnees -> 'cheptel-volkornes-v1', '[]'::jsonb)
    ),
    jsonb_build_object(
      'muldo', donnees -> 'gps-parametres-v1',
      'dragodinde', donnees -> 'dragodinde-gps-parametres-v1',
      'volkorne', donnees -> 'volkorne-gps-parametres-v1'
    )
  into cheptel, gps
  from sauvegardes_elevage where utilisateur = cible;

  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'sujet_id', m.sujet_id, 'contenu', m.contenu, 'cree_le', m.cree_le) order by m.cree_le desc), '[]'::jsonb)
  into messages_recents
  from (select * from messages where auteur = cible order by cree_le desc limit 20) m;

  select jsonb_build_object(
    'profil', jsonb_build_object(
      'pseudo', p.pseudo, 'cree_le', p.cree_le, 'style_ailes', p.style_ailes,
      'niveau_ailes', p.niveau_ailes, 'description', p.description, 'serveur', p.serveur
    ),
    'derniere_connexion', derniere_connexion,
    'dons_cumules_euros', total_dons,
    'cheptel', coalesce(cheptel, jsonb_build_object('muldos', '[]'::jsonb, 'dragodindes', '[]'::jsonb, 'volkornes', '[]'::jsonb)),
    'gps', coalesce(gps, '{}'::jsonb),
    'messages_recents', messages_recents
  ) into resultat
  from profils p where p.id = cible;

  return resultat;
end;
$$ language plpgsql security definer;
grant execute on function public.admin_fiche_utilisateur(uuid) to authenticated;

-- v29 : sauvegardes manuelles nommees (bouton "Sauvegarder" / "Charger" dans
-- l'en-tete du site) -- des instantanes complets pris a la demande, distincts
-- du blob live sauvegardes_elevage (v19) qui suit en continu. Cote client, on
-- garde au plus 3 lignes par utilisateur (la plus ancienne est supprimee
-- avant d'inserer une nouvelle sauvegarde une fois le plafond atteint) --
-- aucune contrainte cote base pour ca, juste la logique applicative.
create table if not exists public.sauvegardes_manuelles (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  cree_le timestamptz not null default now(),
  donnees jsonb not null
);

alter table public.sauvegardes_manuelles enable row level security;

drop policy if exists "sauvegardes_manuelles_select_own" on public.sauvegardes_manuelles;
create policy "sauvegardes_manuelles_select_own" on public.sauvegardes_manuelles
  for select using (auth.uid() = utilisateur_id);

drop policy if exists "sauvegardes_manuelles_insert_own" on public.sauvegardes_manuelles;
create policy "sauvegardes_manuelles_insert_own" on public.sauvegardes_manuelles
  for insert with check (auth.uid() = utilisateur_id);

drop policy if exists "sauvegardes_manuelles_delete_own" on public.sauvegardes_manuelles;
create policy "sauvegardes_manuelles_delete_own" on public.sauvegardes_manuelles
  for delete using (auth.uid() = utilisateur_id);

create index if not exists idx_sauvegardes_manuelles_utilisateur
  on public.sauvegardes_manuelles(utilisateur_id, cree_le desc);

-- v30 : un moderateur (est_modo) peut supprimer le message de n'importe quel
-- membre dans la Taverne, pas seulement le sien -- la policy "supprimer son
-- message" (v1, auth.uid() = auteur) reste en place pour les membres normaux ;
-- les policies RLS s'additionnent (OR), celle-ci ne fait qu'elargir le droit
-- de suppression, jamais le restreindre. Cote client : bouton Trash2 visible
-- si (auteur du message OU compte.estModo), voir TavernePage dans App.jsx.
drop policy if exists "moderateur supprime tout message" on messages;
create policy "moderateur supprime tout message" on messages for delete using (
  exists (select 1 from profils where id = auth.uid() and est_modo)
);

-- v31 : bouton "Signaler un bug" (en-tete, tous comptes connectes -- pas en
-- mode invite, il faut pouvoir recontacter l'auteur). Ecriture par n'importe
-- quel utilisateur connecte pour son propre signalement, lecture/traitement
-- reserves aux moderateurs -- meme pattern que messages_prives (v26) : la
-- policy update ne s'applique qu'aux moderateurs, donc seul le champ
-- `traite` peut changer, et seulement par eux (ModerationPage/App.jsx).
create table if not exists public.signalements_bugs (
  id bigint generated always as identity primary key,
  auteur uuid references auth.users(id) on delete set null,
  contenu text not null check (char_length(contenu) between 5 and 1000),
  page text,
  traite boolean not null default false,
  cree_le timestamptz not null default now()
);

alter table public.signalements_bugs enable row level security;

drop policy if exists "signaler un bug" on public.signalements_bugs;
create policy "signaler un bug" on public.signalements_bugs
  for insert with check (auth.uid() = auteur);

drop policy if exists "moderateur lit les signalements" on public.signalements_bugs;
create policy "moderateur lit les signalements" on public.signalements_bugs
  for select using (exists (select 1 from profils where id = auth.uid() and est_modo));

drop policy if exists "moderateur traite les signalements" on public.signalements_bugs;
create policy "moderateur traite les signalements" on public.signalements_bugs
  for update using (exists (select 1 from profils where id = auth.uid() and est_modo))
  with check (exists (select 1 from profils where id = auth.uid() and est_modo));

create index if not exists idx_signalements_bugs_cree_le
  on public.signalements_bugs(cree_le desc);

-- v32 : compteur anonyme des essais "mode invite" (bouton "Essayer sans
-- compte" du portail de connexion), pour mesurer combien de visiteurs
-- testent le site sans jamais creer de compte -- affiche dans ModerationPage
-- (App.jsx) a cote du nombre total de comptes crees (table profils). Aucune
-- donnee personnelle : une ligne = un clic, rien d'autre. L'insertion doit
-- fonctionner sans session (le mode invite n'authentifie jamais l'appelant,
-- voir le commentaire sur modeInvite dans App()) -- role "anon" autorise en
-- ecriture seule ; la lecture reste reservee aux moderateurs, meme pattern
-- que signalements_bugs ci-dessus.
create table if not exists public.essais_invite (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now()
);

alter table public.essais_invite enable row level security;

drop policy if exists "essai invite anonyme" on public.essais_invite;
create policy "essai invite anonyme" on public.essais_invite
  for insert to anon, authenticated with check (true);

drop policy if exists "moderateur lit les essais invite" on public.essais_invite;
create policy "moderateur lit les essais invite" on public.essais_invite
  for select using (exists (select 1 from profils where id = auth.uid() and est_modo));

-- v33 : corrige l'alerte Supabase Advisor "Security Definer View" (critique)
-- sur les 2 vues de mediane de prix communautaires (v13, v17). Par defaut
-- une vue Postgres s'execute avec les droits de son proprietaire (postgres),
-- ce qui contourne le RLS de l'utilisateur qui interroge -- inoffensif ici
-- puisque les 2 tables sources ont deja une policy select "using (true)"
-- (visibles par tous), mais c'est un piege si cette policy est un jour
-- restreinte sans qu'on pense a la vue. security_invoker fait executer la
-- vue avec les droits de l'appelant, comme une vue normale devrait.
alter view public.prix_communautaires_medianes set (security_invoker = true);
alter view public.prix_communautaires_ingredients_medianes set (security_invoker = true);

-- v34 : détection d'abus du mode invité (repo public -- voir la note sur la
-- séparation stockage/lecture ci-dessous, importante justement parce que ce
-- fichier est lisible par n'importe qui). Capture l'IP d'origine de chaque
-- clic "Essayer sans compte" (via l'en-tête x-forwarded-for que PostgREST
-- expose dans request.headers) pour repérer une même adresse qui relance le
-- mode essai en boucle -- mais l'IP elle-même n'est JAMAIS exposée, y
-- compris aux modérateurs : revoke au niveau colonne pour anon/authenticated
-- (indépendant des policies RLS -- une ligne peut être lisible sans que la
-- colonne `ip` le soit), et la seule façon de l'exploiter est la fonction
-- essais_invite_repetitions() ci-dessous qui ne renvoie que des compteurs
-- agrégés (nombre d'essais + période), jamais l'adresse. La fonction est
-- security definer (propriétaire postgres, donc pas soumise au revoke) et
-- vérifie elle-même est_modo, même pattern que admin_fiche_utilisateur (v27).
alter table public.essais_invite add column if not exists ip inet;

create or replace function public.essais_invite_capturer_ip() returns trigger
language plpgsql security definer as $$
declare
  entete text;
  ip_brute text;
begin
  begin
    entete := current_setting('request.headers', true);
    if entete is not null then
      ip_brute := nullif(trim(split_part(entete::json->>'x-forwarded-for', ',', 1)), '');
      if ip_brute is not null then
        new.ip := ip_brute::inet;
      end if;
    end if;
  exception when others then
    new.ip := null; -- en-tête absent/format inattendu : ne bloque jamais l'insertion pour ça
  end;
  return new;
end;
$$;

drop trigger if exists trig_essais_invite_capturer_ip on public.essais_invite;
create trigger trig_essais_invite_capturer_ip
  before insert on public.essais_invite
  for each row execute function public.essais_invite_capturer_ip();

create index if not exists idx_essais_invite_ip on public.essais_invite(ip) where ip is not null;

-- IMPORTANT : un revoke au niveau colonne seul (`revoke select (ip) on ...`)
-- n'a AUCUN effet tant qu'un grant plus large existe au niveau de la table
-- entière (celui que Supabase pose par défaut sur tout le schéma public) --
-- le grant table-level prime, la colonne resterait lisible. Il faut retirer
-- l'accès à toute la table puis ne redonner que les colonnes voulues.
-- anon n'a jamais eu besoin de lire cette table (insert seul, mode invité) :
-- aucun select accordé du tout.
revoke select on public.essais_invite from anon, authenticated;
grant select (id, cree_le) on public.essais_invite to authenticated;

create or replace function public.essais_invite_repetitions() returns table (
  nb_essais bigint,
  premiere_fois timestamptz,
  derniere_fois timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profils where id = auth.uid() and est_modo) then
    raise exception 'reserve aux moderateurs';
  end if;
  return query
    select count(*)::bigint, min(cree_le), max(cree_le)
    from public.essais_invite
    where ip is not null
    group by ip
    having count(*) > 1
    order by count(*) desc
    limit 50;
end;
$$;

revoke all on function public.essais_invite_repetitions() from public;
grant execute on function public.essais_invite_repetitions() to authenticated;
