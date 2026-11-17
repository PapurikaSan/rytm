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
  - Katalog aktywności `CAT` (klucz, nazwa, synonimy, `share`: czy można udostępniać, `d`: domyślne ustawienia celu). Cel ma `act` (klucz z katalogu, `'none'` dla własnej aktywności albo brak). `matchAct()` dopasowuje wpisaną nazwę (bez polskich znaków, z tolerancją literówek). Grupy katalogu: Ruch, Umysł (można udostępniać), Zdrowie, Ograniczenia, Relacje (prywatne, nigdy nie są udostępniane). Słowa dwuznaczne (`trening`, `ćwiczenia`, `sport`) zawsze dają kilka propozycji.
  - `Social`: zakładka Znajomi (profil, grupy, ranking, wyzwania, piątki) i synchronizacja udostępnień (`rytm_share`) po każdym zapisie. Cel ma `groups` (id grup, którym jest udostępniony).
  - `Asst`: asystentka Pixa (oryginalna, abstrakcyjna kobieca postać z linii światła i „pasm danych”, rysowana proceduralnie w `PixaArt` na siatce 44×58, palety kolorów w `PixaArt.PALETTES`, wybór w Ustawieniach: `S.settings.pixaPal`; pozy ze szkieletu w `PixaArt.POSES`, losowane co kilka sekund, zależne od podpowiedzi, reakcja na dotknięcie). Przycisk to czerwona soczewka w lewym dolnym rogu (nie zasłania przycisków po prawej), świeci mocniej, gdy są nowe podpowiedzi; nigdy nie otwiera się sama. Podpowiedzi to reguły w `tips()` (nastrój, braki wieczorem, podsumowanie tygodnia, podniesienie/zmniejszenie celu, limity, rekordy, wnioski). Każda ma „Nie teraz” (`S.asst.snooze`) i „Nie pokazuj takich” (`S.asst.off`), wyłączenie w Ustawieniach (`S.settings.asst`). Zmiany celu tylko po kliknięciu. Nie używać postaci z cudzych marek.
  - Typy celów: `do` (zaznaczanie, dzień/tydzień/miesiąc, opcjonalnie bez celu, rodzaje `variants`), `qty` (ilość dziennie; `dir: 'max'` = „najwyżej X”, np. czas przed ekranem, kawa; 0 to prawidłowy wpis), `range` (wartość ± tolerancja), `limit` (maks. dni, wagi poziomów `w`), `contact` (spotkania/rozmowy z długością), `measure` (pomiar, np. waga). Priorytety `prio`: `main` ×3, `imp` ×1, `extra` ×0.
- `sw.js`: offline (najpierw sieć, potem pamięć) oraz obsługa powiadomień push. Zapytania do Supabase nie są cache'owane. Przy zmianach w `sw.js` podbij `CACHE`.
- `manifest.webmanifest` + ikony: instalacja na ekranie głównym iPhone'a.
- `supabase/sql/`: historia zmian w bazie (01 dane, 02 przypomnienia). Nowe zmiany dopisuj jako kolejne pliki i stosuj przez konektor (`apply_migration`).
- `supabase/functions/rytm-push/index.ts`: wysyłanie przypomnień. Wdrożona z `verify_jwt: false` (wywołuje ją pg_cron co 5 minut, job `rytm-przypomnienia`). Klucze VAPID generuje sama i trzyma w `rytm_config`. Po zmianie kodu wdrażaj przez konektor `deploy_edge_function` z `verify_jwt: false`.

## Baza (wszystkie tabele z RLS)
- `rytm_state`: jeden wiersz na użytkownika, dostęp tylko do własnego.
- `rytm_push`: urządzenia z włączonymi powiadomieniami, dostęp tylko do własnych.
- `rytm_profile` (wyświetlana nazwa), `rytm_group` (kod zaproszenia), `rytm_member`, `rytm_share` (podsumowanie udostępnionego celu: dni z aktywnością z ostatnich 120 dni, zaliczone tygodnie, opis celu), `rytm_challenge`, `rytm_kudos`. Zasady: widzisz tylko swoje grupy, ich członków i to, co udostępniono tym grupom. Tworzenie grup i dołączanie wyłącznie przez funkcje `rytm_create_group`, `rytm_join_group`. Piątki dodaje tylko funkcja `rytm-push` (akcja `kudos`). Ostrzeżenie „SECURITY DEFINER executable by authenticated” dla `rytm_my_groups`, `rytm_create_group`, `rytm_join_group` jest oczekiwane: działają tylko na koncie wywołującego.
- `rytm_push_log`, `rytm_config`: bez zasad, czyli dostęp wyłącznie z serwera (to celowe, ostrzeżenie „RLS enabled no policy” jest oczekiwane).

## Sprawdzanie zmian
- Kontener nie ma połączenia z `*.supabase.co` (blokada sieci). Do bazy i funkcji używaj konektora Supabase.
- Składnia: wyciągnij ostatni `<script>` z `index.html` i uruchom `node --check`.
- Testy przeglądarkowe z atrapą Supabase (Playwright jest zainstalowany):
  ```
  python3 -m http.server 8765 &   # w katalogu repo
  node tests/auth.test.js         # logowanie, ekran powitalny, zapis, drugie urządzenie, wylogowanie
  node tests/push.test.js         # przypomnienia i włączanie powiadomień
  node tests/friends.test.js      # katalog, grupa, link z zaproszeniem, ranking, piątka, wyzwanie (dwie osoby)
  ```
  Oba powinny kończyć się `errors []`. Po zmianach w interfejsie zrób też zrzut ekranu w szerokości telefonu (390 px) w jasnym i ciemnym motywie.
- Prawdziwych powiadomień i logowania nie da się sprawdzić z kontenera. Poproś użytkownika o test („Wyślij próbne” w Ustawieniach) i sprawdź logi funkcji przez konektor.

## Pomysły na później
- Asystentka, etap 2: rozmowa przez model AI (tworzenie celów z opisu). Klucz tylko na serwerze, dzienny limit wiadomości, do modelu wyłącznie podsumowania, zgoda przy pierwszym użyciu, zmiany zawsze do zatwierdzenia.
- Dane ze Zdrowia na iPhonie (sen, kroki) przez Skróty iOS: użytkownik na razie odpuścił.
- Sen jako godziny zaśnięcia i pobudki (użytkownik na razie odpuścił).
