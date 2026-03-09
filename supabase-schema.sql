-- ============================================================
-- Wiggle Dog Walks — Full Schema
-- Safe to run on a fresh project (drops everything first)
-- ============================================================


-- ============================================================
-- STEP 1 — CLEAN RESET
-- ============================================================

drop policy if exists "walk_logs_admin_all"      on walk_logs;
drop policy if exists "walk_logs_senior_read"     on walk_logs;
drop policy if exists "walk_logs_senior_insert"   on walk_logs;
drop policy if exists "walk_logs_senior_update"   on walk_logs;
drop policy if exists "walk_logs_junior_read"     on walk_logs;
drop policy if exists "dogs_admin_all"            on dogs;
drop policy if exists "dogs_senior_read"          on dogs;
drop policy if exists "dogs_senior_insert"        on dogs;
drop policy if exists "dogs_senior_update"        on dogs;
drop policy if exists "dogs_junior_read"          on dogs;
drop policy if exists "profiles_own"              on profiles;

drop table if exists walk_logs   cascade;
drop table if exists dogs        cascade;
drop table if exists profiles    cascade;

drop trigger   if exists on_auth_user_created on auth.users;
drop function  if exists handle_new_user();


-- ============================================================
-- STEP 2 — TABLES
-- ============================================================

create table profiles (
  id           uuid        primary key references auth.users on delete cascade,
  email        text        not null,
  full_name    text,
  role         text        not null default 'junior_walker'
                           check (role in ('admin', 'senior_walker', 'junior_walker')),
  sector       text        not null default 'both'
                           check (sector in ('Plateau', 'Laurier', 'both')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table dogs (
  id           uuid        primary key default gen_random_uuid(),
  dog_name     text        not null,
  sector       text        check (sector in ('Plateau', 'Laurier')),
  owner_first  text,
  owner_last   text,
  breed        text,
  address      text,
  door_code    text,
  email        text,
  phone        text,
  notes        text,
  photo_url    text,
  bff          text,
  goals        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
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
create index on dogs      (dog_name);


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
-- STEP 5 — ROW LEVEL SECURITY (3 roles)
-- ============================================================

alter table profiles  enable row level security;
alter table dogs      enable row level security;
alter table walk_logs enable row level security;

-- Profiles: each user reads and updates only their own row
create policy "profiles_own" on profiles
  for all
  using     (auth.uid() = id)
  with check(auth.uid() = id);

-- Dogs: admin — full CRUD
create policy "dogs_admin_all" on dogs
  for all
  using     ((select role from profiles where id = auth.uid()) = 'admin')
  with check((select role from profiles where id = auth.uid()) = 'admin');

-- Dogs: senior_walker — SELECT + INSERT + UPDATE (no DELETE)
create policy "dogs_senior_read" on dogs
  for select
  using ((select role from profiles where id = auth.uid()) = 'senior_walker');

create policy "dogs_senior_insert" on dogs
  for insert
  with check ((select role from profiles where id = auth.uid()) = 'senior_walker');

create policy "dogs_senior_update" on dogs
  for update
  using     ((select role from profiles where id = auth.uid()) = 'senior_walker')
  with check((select role from profiles where id = auth.uid()) = 'senior_walker');

-- Dogs: junior_walker — SELECT only
create policy "dogs_junior_read" on dogs
  for select
  using ((select role from profiles where id = auth.uid()) = 'junior_walker');

-- Walk logs: admin — full CRUD
create policy "walk_logs_admin_all" on walk_logs
  for all
  using     ((select role from profiles where id = auth.uid()) = 'admin')
  with check((select role from profiles where id = auth.uid()) = 'admin');

-- Walk logs: senior_walker — SELECT + INSERT + UPDATE
create policy "walk_logs_senior_read" on walk_logs
  for select
  using ((select role from profiles where id = auth.uid()) = 'senior_walker');

create policy "walk_logs_senior_insert" on walk_logs
  for insert
  with check ((select role from profiles where id = auth.uid()) = 'senior_walker');

create policy "walk_logs_senior_update" on walk_logs
  for update
  using     ((select role from profiles where id = auth.uid()) = 'senior_walker')
  with check((select role from profiles where id = auth.uid()) = 'senior_walker');

-- Walk logs: junior_walker — SELECT only
create policy "walk_logs_junior_read" on walk_logs
  for select
  using ((select role from profiles where id = auth.uid()) = 'junior_walker');


-- ============================================================
-- STEP 6 — SEED DATA
-- ============================================================
-- Use scripts/seed-dogs.mjs to insert all 93 dogs from CSV:
--   node scripts/seed-dogs.mjs


-- ============================================================
-- STEP 7 — WALK GROUPS (drag-and-drop organizer)
-- ============================================================

create table if not exists walk_groups (
  id           uuid        primary key default gen_random_uuid(),
  walk_date    date        not null,
  group_num    int         not null,
  group_name   text,
  dog_ids      text[]      not null default '{}',
  sector       text        not null check (sector in ('Plateau', 'Laurier')),
  updated_by   uuid        references profiles(id),
  updated_at   timestamptz not null default now(),
  unique(walk_date, group_num, sector)
);

alter table walk_groups enable row level security;

-- Everyone authenticated can read walk groups
create policy "walk_groups_read" on walk_groups
  for select using (auth.uid() is not null);

-- Admins and senior walkers can insert/update walk groups
create policy "walk_groups_write" on walk_groups
  for all
  using     ((select role from profiles where id = auth.uid()) in ('admin', 'senior_walker'))
  with check((select role from profiles where id = auth.uid()) in ('admin', 'senior_walker'));

-- Enable realtime for walk_groups
alter publication supabase_realtime add table walk_groups;


-- ============================================================
-- STEP 8 — DAILY NOTES (admin note of the day)
-- ============================================================

create table if not exists daily_notes (
  id          uuid        primary key default gen_random_uuid(),
  note_text   text        not null,
  created_by  uuid        not null references profiles(id),
  note_date   date        not null default current_date,
  created_at  timestamptz not null default now(),
  unique(note_date)
);

alter table daily_notes enable row level security;

-- All authenticated users can read daily notes
create policy "daily_notes_read" on daily_notes
  for select using (auth.uid() is not null);

-- Only admins can create/update/delete daily notes
create policy "daily_notes_admin_write" on daily_notes
  for all
  using     ((select role from profiles where id = auth.uid()) = 'admin')
  with check((select role from profiles where id = auth.uid()) = 'admin');


-- ============================================================
-- STEP 9 — DOG PHOTOS STORAGE
-- ============================================================
-- Storage bucket "dog-photos" created via scripts/setup-features.mjs
-- Policies on storage.objects:
--   dog_photos_read   — public read
--   dog_photos_upload — admin + senior_walker insert
--   dog_photos_update — admin + senior_walker update
--   dog_photos_delete — admin + senior_walker delete

-- Dogs table updated_by column (tracks who last edited a dog profile)
-- ALTER TABLE dogs ADD COLUMN IF NOT EXISTS updated_by text;
-- (run via scripts/setup-features.mjs)


-- ============================================================
-- DONE — POST-SETUP STEPS
-- ============================================================
-- After running this:
--
-- 1. Run storage + daily_notes setup:
--    node scripts/setup-features.mjs
--
-- 2. Seed the dogs from CSV:
--    node scripts/seed-dogs.mjs
--
-- 3. Create your admin user:
--    a) Sign up via the app login page
--    b) Run in SQL Editor:
--       update profiles set role = 'admin' where email = 'you@example.com';
--
-- Roles:
--   admin          — full access to everything
--   senior_walker  — view/edit dogs, manage groups, log walks (no delete)
--   junior_walker  — read-only (default for new signups)
-- ============================================================
