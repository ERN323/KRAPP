-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/skxossiiffqrfejvicyl/sql/new)
-- to ensure the `leagues` table has all required columns and allows public/anon reads & inserts for the PWA.

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'LATVIA',
  is_private boolean not null default false,
  password text,
  created_by_user_id text not null default '',
  member_roles jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Add missing columns if `leagues` table was already created with fewer columns
alter table public.leagues add column if not exists name text not null default 'LEAGUE';
alter table public.leagues add column if not exists country text not null default 'LATVIA';
alter table public.leagues add column if not exists is_private boolean not null default false;
alter table public.leagues add column if not exists password text;
alter table public.leagues add column if not exists created_by_user_id text not null default '';
alter table public.leagues add column if not exists member_roles jsonb not null default '{}'::jsonb;
alter table public.leagues add column if not exists created_at timestamptz not null default now();

-- Enable Row Level Security (RLS) and allow the PWA anon key to read, insert, update, and delete leagues
alter table public.leagues enable row level security;

drop policy if exists "Allow public select on leagues" on public.leagues;
create policy "Allow public select on leagues"
  on public.leagues for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow public insert on leagues" on public.leagues;
create policy "Allow public insert on leagues"
  on public.leagues for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow public update on leagues" on public.leagues;
create policy "Allow public update on leagues"
  on public.leagues for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow public delete on leagues" on public.leagues;
create policy "Allow public delete on leagues"
  on public.leagues for delete
  to anon, authenticated
  using (true);

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
