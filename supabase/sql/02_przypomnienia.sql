-- Rytm: przypomnienia (powiadomienia push)

-- Urządzenia, które zgodziły się na powiadomienia. Każdy widzi tylko swoje.
create table public.rytm_push (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  sub jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.rytm_push enable row level security;
create policy "wlasne urzadzenia" on public.rytm_push
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Dziennik wysłanych przypomnień (żeby to samo nie przyszło dwa razy).
-- Brak zasad dostępu = tylko usługa na serwerze może z niej korzystać.
create table public.rytm_push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  rid text not null,
  day date not null,
  primary key (user_id, rid, day)
);
alter table public.rytm_push_log enable row level security;

-- Klucze do powiadomień, generowane automatycznie przez usługę. Dostęp tylko z serwera.
create table public.rytm_config (
  key text primary key,
  value jsonb not null
);
alter table public.rytm_config enable row level security;

-- Co 5 minut serwer sprawdza, czy komuś należy się przypomnienie.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'rytm-przypomnienia',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://jscxrlwhuwisbpubbedg.supabase.co/functions/v1/rytm-push',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"action": "run"}'::jsonb
     ); $$
);
