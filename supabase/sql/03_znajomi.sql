-- Rytm: znajomi, grupy, udostępnianie podsumowań, wyzwania i piątki.
-- Zasada: nikt nie widzi Twoich danych, dopóki sam nie udostępnisz celu konkretnej grupie.

-- Profil widoczny dla członków Twoich grup (tylko wyświetlana nazwa).
create table public.rytm_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.rytm_group (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.rytm_member (
  group_id uuid not null references public.rytm_group(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index rytm_member_user_idx on public.rytm_member(user_id);

-- Podsumowanie jednego udostępnionego celu (dni z aktywnością, zaliczone tygodnie).
-- Nigdy pełne dane, notatki, nastrój ani osoby z relacji.
create table public.rytm_share (
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id text not null,
  act text not null,
  name text not null,
  groups uuid[] not null default '{}',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, goal_id)
);

create table public.rytm_challenge (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.rytm_group(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  act text not null,
  target int not null check (target between 1 and 10000),
  start_day date not null,
  end_day date not null check (end_day >= start_day and end_day - start_day <= 92),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Piątki: wysyła je tylko funkcja na serwerze (sprawdza wspólną grupę), raz dziennie na osobę i aktywność.
create table public.rytm_kudos (
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  act text not null,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user, act, day)
);

-- Grupy zalogowanego użytkownika. security definer, żeby zasady RLS nie odwoływały się same do siebie.
create or replace function public.rytm_my_groups()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select group_id from public.rytm_member where user_id = (select auth.uid())
$$;

-- Tworzenie grupy z losowym kodem zaproszenia (twórca od razu jest właścicielem).
create or replace function public.rytm_create_group(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid; c text;
begin
  if (select auth.uid()) is null then raise exception 'Nie zalogowano'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'Nazwa grupy musi mieć od 1 do 60 znaków'; end if;
  if (select count(*) from public.rytm_group where created_by = (select auth.uid())) >= 10 then raise exception 'Możesz mieć najwyżej 10 własnych grup'; end if;
  loop
    c := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 6));
    exit when char_length(c) = 6 and not exists (select 1 from public.rytm_group where code = c);
  end loop;
  insert into public.rytm_group(name, code, created_by) values (trim(p_name), c, (select auth.uid())) returning id into gid;
  insert into public.rytm_member(group_id, user_id, role) values (gid, (select auth.uid()), 'owner');
  return gid;
end $$;

-- Dołączanie kodem (grupy nie da się zobaczyć ani znaleźć bez kodu).
create or replace function public.rytm_join_group(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if (select auth.uid()) is null then raise exception 'Nie zalogowano'; end if;
  select id into gid from public.rytm_group where code = upper(trim(coalesce(p_code, '')));
  if gid is null then raise exception 'Nie ma grupy z takim kodem'; end if;
  if (select count(*) from public.rytm_member where group_id = gid) >= 30 then raise exception 'Ta grupa jest pełna'; end if;
  insert into public.rytm_member(group_id, user_id) values (gid, (select auth.uid())) on conflict do nothing;
  return gid;
end $$;

revoke execute on function public.rytm_my_groups() from public, anon;
revoke execute on function public.rytm_create_group(text) from public, anon;
revoke execute on function public.rytm_join_group(text) from public, anon;
grant execute on function public.rytm_my_groups() to authenticated;
grant execute on function public.rytm_create_group(text) to authenticated;
grant execute on function public.rytm_join_group(text) to authenticated;

alter table public.rytm_profile enable row level security;
alter table public.rytm_group enable row level security;
alter table public.rytm_member enable row level security;
alter table public.rytm_share enable row level security;
alter table public.rytm_challenge enable row level security;
alter table public.rytm_kudos enable row level security;

-- Profil: swój zawsze, cudzy tylko gdy jesteście w tej samej grupie.
create policy "profil: odczyt" on public.rytm_profile for select to authenticated using (
  user_id = (select auth.uid())
  or user_id in (select m.user_id from public.rytm_member m where m.group_id in (select public.rytm_my_groups()))
);
create policy "profil: dodanie" on public.rytm_profile for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profil: zmiana" on public.rytm_profile for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Grupy: widzisz tylko swoje. Zmienić lub usunąć może tylko twórca. Tworzenie wyłącznie przez rytm_create_group.
create policy "grupa: odczyt" on public.rytm_group for select to authenticated using (id in (select public.rytm_my_groups()));
create policy "grupa: zmiana" on public.rytm_group for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "grupa: usuniecie" on public.rytm_group for delete to authenticated using (created_by = (select auth.uid()));

-- Członkostwa: widzisz członków swoich grup. Odejść możesz sam, a twórca może usunąć każdego.
create policy "czlonek: odczyt" on public.rytm_member for select to authenticated using (group_id in (select public.rytm_my_groups()));
create policy "czlonek: odejscie" on public.rytm_member for delete to authenticated using (
  user_id = (select auth.uid())
  or group_id in (select g.id from public.rytm_group g where g.created_by = (select auth.uid()))
);

-- Udostępnienia: swoje zawsze. Cudze tylko z grup, w których jesteście oboje i którym zostały udostępnione.
create policy "udostepnienie: odczyt" on public.rytm_share for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.rytm_member m
    where m.user_id = rytm_share.user_id
      and m.group_id = any(rytm_share.groups)
      and m.group_id in (select public.rytm_my_groups())
  )
);
create policy "udostepnienie: dodanie" on public.rytm_share for insert to authenticated with check (
  user_id = (select auth.uid()) and groups <@ array(select public.rytm_my_groups())
);
create policy "udostepnienie: zmiana" on public.rytm_share for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and groups <@ array(select public.rytm_my_groups()));
create policy "udostepnienie: usuniecie" on public.rytm_share for delete to authenticated using (user_id = (select auth.uid()));

-- Wyzwania: widzą i tworzą członkowie grupy. Usunąć może autor.
create policy "wyzwanie: odczyt" on public.rytm_challenge for select to authenticated using (group_id in (select public.rytm_my_groups()));
create policy "wyzwanie: dodanie" on public.rytm_challenge for insert to authenticated with check (
  created_by = (select auth.uid()) and group_id in (select public.rytm_my_groups())
);
create policy "wyzwanie: usuniecie" on public.rytm_challenge for delete to authenticated using (created_by = (select auth.uid()));

-- Piątki: widzisz otrzymane i wysłane. Dodaje je tylko funkcja na serwerze.
create policy "piatki: odczyt" on public.rytm_kudos for select to authenticated using (
  to_user = (select auth.uid()) or from_user = (select auth.uid())
);
