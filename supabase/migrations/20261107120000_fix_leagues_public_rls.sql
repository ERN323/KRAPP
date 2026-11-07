-- Drop the "Allow public ... on leagues" policies added directly in the SQL editor on 2026-11-07,
-- outside the migration workflow. Postgres OR-combines permissive RLS policies on the same table and
-- command, so these `using (true)` policies stacked alongside the original leagues_read / leagues_create /
-- leagues_write policies and made every row in `leagues` fully public to anon + authenticated: readable,
-- insertable, updatable and deletable by anyone, including the plaintext `password` column.
-- See docs/decisions.md, 2026-11-07 "Leagues RLS exposure" row.
drop policy if exists "Allow public select on leagues" on public.leagues;
drop policy if exists "Allow public insert on leagues" on public.leagues;
drop policy if exists "Allow public update on leagues" on public.leagues;
drop policy if exists "Allow public delete on leagues" on public.leagues;

notify pgrst, 'reload schema';
