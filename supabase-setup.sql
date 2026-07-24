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
