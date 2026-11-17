# Rytm: instrukcja projektu dla Claude

## Użytkownik i sposób pracy
- Właściciel nie programuje. Pisz po polsku, prostym językiem, bez żargonu. Kroki do wyklikania dawaj jako numerowane listy z dokładnymi nazwami przycisków.
- Lubi, gdy dopytujesz i myślisz krytycznie: wskaż pułapki w jego pomyśle, zaproponuj lepsze rozwiązanie, a potem je zrealizuj.
- Rób rzeczy sam, gdy masz dostęp (repo GitHub, konektor Supabase). O ręczne kroki proś tylko wtedy, gdy nie da się inaczej.
- Przed czymkolwiek, co kasuje dane, wyłącza usługi albo zmienia zasady dostępu w bazie, zapytaj.
- Nigdy nie proś o hasła ani klucze secret/service_role. Jeśli użytkownik coś takiego wklei, nie używaj tego i doradź zmianę.

## Adresy
- Aplikacja: https://papurikasan.github.io/rytm/ (GitHub Pages z gałęzi `main`, katalog główny; aktualizuje się sama ok. minutę po pushu)
- Repo: PapurikaSan/rytm
- Supabase: projekt `rytm`, ref `jscxrlwhuwisbpubbedg`, URL `https://jscxrlwhuwisbpubbedg.supabase.co`

## Architektura
- `index.html`: cała aplikacja (vanilla JS, bez bundlera). Biblioteka `@supabase/supabase-js@2.45.4` z jsDelivr.
  - Stan użytkownika to jeden obiekt `S` (cele, wpisy, ustawienia) zapisywany jako JSON w `rytm_state.data`. `fixState()` uzupełnia brakujące pola przy wczytaniu, więc nowe pola dodawaj z wartościami domyślnymi właśnie tam.
  - `Sync` (logowanie, zapis z opóźnieniem 800 ms, pamięć podręczna w localStorage, odświeżanie po powrocie do aplikacji), `Push` (włączanie powiadomień na urządzeniu).
  - Widoki: `viewToday`, `viewWeek`, `viewMonth`, `viewCharts`, `viewGoals`, `viewSettings`; arkusze w `sheetHtml()`. Akcje kliknięć: atrybut `data-act` → `act()`; zmiany pól: `data-chg`; wpisywanie w arkuszu: `data-inp`.
  - Typy celów: `do` (zaznaczanie, dzień/tydzień/miesiąc, opcjonalnie bez celu, rodzaje `variants`), `qty` (ilość dziennie), `range` (wartość ± tolerancja), `limit` (maks. dni, wagi poziomów `w`), `contact` (spotkania/rozmowy z długością), `measure` (pomiar, np. waga). Priorytety `prio`: `main` ×3, `imp` ×1, `extra` ×0.
- `sw.js`: offline (najpierw sieć, potem pamięć) oraz obsługa powiadomień push. Zapytania do Supabase nie są cache'owane. Przy zmianach w `sw.js` podbij `CACHE`.
- `manifest.webmanifest` + ikony: instalacja na ekranie głównym iPhone'a.
- `supabase/sql/`: historia zmian w bazie (01 dane, 02 przypomnienia). Nowe zmiany dopisuj jako kolejne pliki i stosuj przez konektor (`apply_migration`).
- `supabase/functions/rytm-push/index.ts`: wysyłanie przypomnień. Wdrożona z `verify_jwt: false` (wywołuje ją pg_cron co 5 minut, job `rytm-przypomnienia`). Klucze VAPID generuje sama i trzyma w `rytm_config`. Po zmianie kodu wdrażaj przez konektor `deploy_edge_function` z `verify_jwt: false`.

## Baza (wszystkie tabele z RLS)
- `rytm_state`: jeden wiersz na użytkownika, dostęp tylko do własnego.
- `rytm_push`: urządzenia z włączonymi powiadomieniami, dostęp tylko do własnych.
- `rytm_push_log`, `rytm_config`: bez zasad, czyli dostęp wyłącznie z serwera (to celowe, ostrzeżenie „RLS enabled no policy” jest oczekiwane).

## Sprawdzanie zmian
- Kontener nie ma połączenia z `*.supabase.co` (blokada sieci). Do bazy i funkcji używaj konektora Supabase.
- Składnia: wyciągnij ostatni `<script>` z `index.html` i uruchom `node --check`.
- Testy przeglądarkowe z atrapą Supabase (Playwright jest zainstalowany):
  ```
  python3 -m http.server 8765 &   # w katalogu repo
  node tests/auth.test.js         # logowanie, ekran powitalny, zapis, drugie urządzenie, wylogowanie
  node tests/push.test.js         # przypomnienia i włączanie powiadomień
  ```
  Oba powinny kończyć się `errors []`. Po zmianach w interfejsie zrób też zrzut ekranu w szerokości telefonu (390 px) w jasnym i ciemnym motywie.
- Prawdziwych powiadomień i logowania nie da się sprawdzić z kontenera. Poproś użytkownika o test („Wyślij próbne” w Ustawieniach) i sprawdź logi funkcji przez konektor.

## Pomysły na później
- Znajomi: osobne konta, ewentualnie porównywanie serii albo wspólne wyzwania (do przemyślenia z użytkownikiem).
- Sen jako godziny zaśnięcia i pobudki (użytkownik na razie odpuścił).
