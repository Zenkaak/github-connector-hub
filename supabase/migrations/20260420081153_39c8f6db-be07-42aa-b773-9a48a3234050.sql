
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('mpesa-b2c-retry-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'mpesa-b2c-retry-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qtrubtfubdzodahsfacv.supabase.co/functions/v1/mpesa-b2c-retry',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
