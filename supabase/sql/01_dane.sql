-- Rytm: tabela z danymi użytkownika (uruchomione przy zakładaniu projektu)
create table public.rytm_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.rytm_state enable row level security;
create policy "odczyt wlasnych danych" on public.rytm_state
  for select using ((select auth.uid()) = user_id);
create policy "dodawanie wlasnych danych" on public.rytm_state
  for insert with check ((select auth.uid()) = user_id);
create policy "zmiana wlasnych danych" on public.rytm_state
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "usuwanie wlasnych danych" on public.rytm_state
  for delete using ((select auth.uid()) = user_id);
