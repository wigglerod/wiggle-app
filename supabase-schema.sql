-- ============================================================
-- Wiggle Dog Walks — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Profiles (linked to Supabase Auth users)
create table if not exists profiles (
  id uuid references auth.users primary key,
  email text,
  role text check (role in ('admin', 'walker')) default 'walker',
  sector text check (sector in ('Plateau', 'Laurier', 'both')) default 'both',
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Dogs
create table if not exists dogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  last_name text,
  address text,
  door_info text,
  must_know text,
  extra_info text,
  email text,
  sector text check (sector in ('Plateau', 'Laurier')),
  photo_url text,
  created_at timestamptz default now()
);

-- Walk logs
create table if not exists walk_logs (
  id uuid primary key default gen_random_uuid(),
  walker_id uuid references profiles(id),
  dog_id uuid references dogs(id),
  walk_date date not null,
  status text check (status in ('completed', 'skipped', 'incident')),
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table dogs enable row level security;
alter table walk_logs enable row level security;

-- Profiles: users can read/update their own
create policy "profiles_own" on profiles
  for all using (auth.uid() = id);

-- Dogs: walkers see only their sector; admins see all
create policy "dogs_walker_read" on dogs
  for select using (
    (select role from profiles where id = auth.uid()) = 'admin'
    or sector = (select sector from profiles where id = auth.uid())
    or (select sector from profiles where id = auth.uid()) = 'both'
  );

create policy "dogs_admin_write" on dogs
  for all using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Walk logs: walkers can insert; admins can do everything
create policy "walk_logs_walker_insert" on walk_logs
  for insert with check (auth.uid() = walker_id);

create policy "walk_logs_walker_read" on walk_logs
  for select using (
    auth.uid() = walker_id
    or (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "walk_logs_admin_all" on walk_logs
  for all using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- ============================================================
-- Storage bucket for dog photos
-- ============================================================
-- Run in Supabase Dashboard → Storage → New Bucket
-- Bucket name: photos  |  Public: true
-- Or via SQL (requires pg_storage extension):
-- select storage.create_bucket('photos', public := true);

-- ============================================================
-- Seed data (optional dev seed)
-- ============================================================
insert into dogs (name, address, door_info, must_know, extra_info, email, sector) values
  ('Lito', '3742 Rue Saint-Denis, Montréal, QC', null, null, null, 'mont0370@mylaurier.ca', 'Laurier'),
  ('Maikan', '4521 Avenue du Parc, Montréal, QC', 'Key under mat', null, 'Feed after walk', 'christinegueth@gmail.com', 'Plateau'),
  ('Nico', '2891 Boulevard Saint-Laurent, Montréal, QC', 'Code 4892', 'Reactive to other dogs on leash', 'Very energetic — needs full hour', 'hewon00yang@gmail.com', 'Plateau'),
  ('Cleo', '1204 Avenue Laurier Est, Montréal, QC', 'Lockbox code 7531', 'Nervous around strangers', null, null, 'Plateau'),
  ('Indie', '3301 Rue Rachel Est, Montréal, QC', 'Door code 2244', null, 'Loves fetch', null, 'Plateau'),
  ('Cedar', '987 Rue Gilford, Montréal, QC', null, 'Pulls hard on leash — use front clip harness', 'Has a favourite red ball, bring it', null, 'Plateau')
on conflict do nothing;
