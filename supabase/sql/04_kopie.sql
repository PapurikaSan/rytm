-- Rytm: automatyczne kopie zapasowe danych użytkowników.
-- Codziennie o 3:17 (UTC) serwer robi kopię każdemu, kto nie ma kopii z ostatnich 7 dni,
-- i usuwa kopie starsze niż 70 dni (zostaje ok. 10 tygodniowych kopii na osobę).

create table public.rytm_backup (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.rytm_backup enable row level security;
-- Użytkownik może tylko odczytać swoje kopie (żeby je przywrócić). Tworzy i usuwa je wyłącznie serwer.
create policy "kopie: odczyt wlasnych" on public.rytm_backup
  for select to authenticated using (user_id = (select auth.uid()));

select cron.schedule(
  'rytm-kopie',
  '17 3 * * *',
  $$
  insert into public.rytm_backup(user_id, day, data)
  select s.user_id, current_date, s.data from public.rytm_state s
  where not exists (
    select 1 from public.rytm_backup b where b.user_id = s.user_id and b.day > current_date - 7
  )
  on conflict do nothing;
  delete from public.rytm_backup where day < current_date - 70;
  $$
);
