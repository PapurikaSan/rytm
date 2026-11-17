-- Rytm: dłuższy czas oczekiwania na funkcję przypomnień.
-- Domyślne 5 s czasem nie wystarczało, gdy funkcja startowała „na zimno” (ok. 1 na 6 wywołań kończyło się przekroczeniem czasu).
select cron.schedule(
  'rytm-przypomnienia',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://jscxrlwhuwisbpubbedg.supabase.co/functions/v1/rytm-push',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"action": "run"}'::jsonb,
       timeout_milliseconds := 30000
     ); $$
);
