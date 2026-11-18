-- Rytm: indeksy na kolumnach powiązań (zalecenie doradcy wydajności Supabase).
-- Przyspieszają wyszukiwanie urządzeń do powiadomień, piątek, wyzwań i grup oraz usuwanie konta.
create index if not exists rytm_push_user_idx on public.rytm_push(user_id);
create index if not exists rytm_kudos_to_idx on public.rytm_kudos(to_user);
create index if not exists rytm_challenge_group_idx on public.rytm_challenge(group_id);
create index if not exists rytm_challenge_created_idx on public.rytm_challenge(created_by);
create index if not exists rytm_group_created_idx on public.rytm_group(created_by);
