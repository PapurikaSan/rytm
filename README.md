# Rytm

Tracker celów i nawyków: cele dzienne, tygodniowe i miesięczne, limity, pomiary, relacje, nastrój, serie, kalendarze i wykresy.

Aplikacja to jedna strona (`index.html`), hostowana na GitHub Pages. Logowanie i dane są w Supabase: każdy użytkownik widzi wyłącznie swoje dane (Row Level Security).

## Pliki

- `index.html`: cała aplikacja
- `manifest.webmanifest`, ikony: instalacja na ekranie głównym telefonu
- `sw.js`: działanie bez internetu (bez zapisywania odpowiedzi z bazy)

## Przypomnienia

- `supabase/sql/02_przypomnienia.sql`: tabele urządzeń i dziennika oraz harmonogram (co 5 minut)
- `supabase/functions/rytm-push/index.ts`: funkcja wysyłająca powiadomienia. Wdrożona w Supabase z wyłączonym „Verify JWT”, bo wywołuje ją harmonogram.
- Klucze do powiadomień (VAPID) funkcja tworzy sama przy pierwszym użyciu i trzyma w tabeli `rytm_config`, dostępnej tylko z serwera.

## Znajomi

- `supabase/sql/03_znajomi.sql`: profile, grupy z kodem zaproszenia, udostępnianie podsumowań celów, wspólne wyzwania i piątki
- Domyślnie nic nie jest udostępniane. Każdy cel udostępnia się wybranym grupom, a znajomi widzą tylko podsumowanie (dni z aktywnością, cel, zaliczone tygodnie).

## Baza danych (Supabase)

Tabela z danymi użytkownika (`supabase/sql/01_dane.sql`). Kod do uruchomienia w SQL Editor:

```sql
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
```

Klucz w `index.html` to klucz publiczny (publishable). Bezpieczeństwo danych zapewniają zasady RLS powyżej. Nigdy nie wpisuj tu klucza secret ani hasła do bazy.
