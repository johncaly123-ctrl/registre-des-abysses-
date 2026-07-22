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
