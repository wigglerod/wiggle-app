-- ============================================================
-- Wiggle Dog Walks — Full Schema
-- Safe to run on a fresh project (drops everything first)
-- ============================================================


-- ============================================================
-- STEP 1 — CLEAN RESET
-- ============================================================

drop policy if exists "walk_logs_admin_all"     on walk_logs;
drop policy if exists "walk_logs_walker_read"    on walk_logs;
drop policy if exists "walk_logs_walker_insert"  on walk_logs;
drop policy if exists "dogs_admin_write"         on dogs;
drop policy if exists "dogs_walker_read"         on dogs;
drop policy if exists "profiles_own"             on profiles;

drop table if exists walk_logs cascade;
drop table if exists dogs      cascade;
drop table if exists profiles  cascade;

drop trigger   if exists on_auth_user_created on auth.users;
drop function  if exists handle_new_user();


-- ============================================================
-- STEP 2 — TABLES
-- ============================================================

create table profiles (
  id           uuid        primary key references auth.users on delete cascade,
  email        text        not null,
  full_name    text,
  role         text        not null default 'walker'
                           check (role in ('admin', 'walker')),
  sector       text        not null default 'both'
                           check (sector in ('Plateau', 'Laurier', 'both')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table dogs (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  last_name    text,
  address      text,
  door_info    text,
  must_know    text,
  extra_info   text,
  email        text,
  sector       text        not null
                           check (sector in ('Plateau', 'Laurier')),
  photo_url    text,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table walk_logs (
  id           uuid        primary key default gen_random_uuid(),
  walker_id    uuid        not null references profiles(id) on delete restrict,
  dog_id       uuid        not null references dogs(id)    on delete restrict,
  walk_date    date        not null default current_date,
  status       text        not null
                           check (status in ('completed', 'skipped', 'incident')),
  notes        text,
  created_at   timestamptz not null default now()
);


-- ============================================================
-- STEP 3 — INDEXES (performance)
-- ============================================================

create index on walk_logs (walker_id);
create index on walk_logs (dog_id);
create index on walk_logs (walk_date desc);
create index on dogs      (sector);
create index on dogs      (active);


-- ============================================================
-- STEP 4 — AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ============================================================
-- STEP 5 — ROW LEVEL SECURITY
-- ============================================================

alter table profiles  enable row level security;
alter table dogs      enable row level security;
alter table walk_logs enable row level security;

-- Profiles: each user reads and updates only their own row
create policy "profiles_own" on profiles
  for all
  using     (auth.uid() = id)
  with check(auth.uid() = id);

-- Dogs: walkers see their sector (or all if sector = 'both'); admins see everything
create policy "dogs_walker_read" on dogs
  for select
  using (
    (select role   from profiles where id = auth.uid()) = 'admin'
    or (select sector from profiles where id = auth.uid()) = 'both'
    or sector = (select sector from profiles where id = auth.uid())
  );

-- Dogs: only admins can insert / update / delete
create policy "dogs_admin_write" on dogs
  for all
  using     ((select role from profiles where id = auth.uid()) = 'admin')
  with check((select role from profiles where id = auth.uid()) = 'admin');

-- Walk logs: walkers insert their own; walkers & admins can read
create policy "walk_logs_walker_insert" on walk_logs
  for insert
  with check (auth.uid() = walker_id);

create policy "walk_logs_read" on walk_logs
  for select
  using (
    auth.uid() = walker_id
    or (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Walk logs: admins can update / delete
create policy "walk_logs_admin_write" on walk_logs
  for all
  using     ((select role from profiles where id = auth.uid()) = 'admin')
  with check((select role from profiles where id = auth.uid()) = 'admin');


-- ============================================================
-- STEP 6 — SEED DATA
-- ============================================================

insert into dogs (name, address, door_info, must_know, extra_info, email, sector) values
  ('Lito',   '3742 Rue Saint-Denis, Montréal, QC',         null,                null,                                          null,                                  'mont0370@mylaurier.ca',    'Laurier'),
  ('Maikan', '4521 Avenue du Parc, Montréal, QC',          'Key under mat',     null,                                          'Feed after walk',                     'christinegueth@gmail.com', 'Plateau'),
  ('Nico',   '2891 Boulevard Saint-Laurent, Montréal, QC', 'Code 4892',         'Reactive to other dogs on leash',             'Very energetic — needs full hour',    'hewon00yang@gmail.com',    'Plateau'),
  ('Cleo',   '1204 Avenue Laurier Est, Montréal, QC',      'Lockbox code 7531', 'Nervous around strangers',                    null,                                  null,                       'Plateau'),
  ('Indie',  '3301 Rue Rachel Est, Montréal, QC',          'Door code 2244',    null,                                          'Loves fetch',                         null,                       'Plateau'),
  ('Cedar',  '987 Rue Gilford, Montréal, QC',              null,                'Pulls hard on leash — use front clip harness','Has a favourite red ball, bring it',  null,                       'Plateau');


-- ============================================================
-- DONE — POST-SETUP STEPS
-- ============================================================
-- After running this:
--
-- 1. Create storage bucket manually:
--    Dashboard → Storage → New Bucket
--    Name: photos  |  Public: ON
--
-- 2. Create your admin user:
--    a) Sign up via the app login page (or Supabase Dashboard → Authentication → Add User)
--    b) Then run this in the SQL Editor (replace with your email):
--       update profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================


-- ============================================================
-- TROUBLESHOOTING — Run in SQL Editor if you hit issues
-- ============================================================

-- 1. Check if the signup trigger exists:
--    select tgname from pg_trigger where tgname = 'on_auth_user_created';
--    (Should return 1 row. If empty, re-run STEP 4 above.)

-- 2. If you signed up but have NO profile row (common if trigger was missing):
--    insert into profiles (id, email, role)
--    select id, email, 'admin'
--    from auth.users
--    where email = 'you@example.com'
--    on conflict (id) do update set role = 'admin';

-- 3. Recreate the trigger if it's missing (safe to re-run):
--    create or replace function handle_new_user()
--    returns trigger language plpgsql security definer
--    set search_path = public as $$
--    begin
--      insert into profiles (id, email)
--      values (new.id, new.email);
--      return new;
--    end;
--    $$;
--
--    drop trigger if exists on_auth_user_created on auth.users;
--    create trigger on_auth_user_created
--      after insert on auth.users
--      for each row execute procedure handle_new_user();
-- ============================================================
