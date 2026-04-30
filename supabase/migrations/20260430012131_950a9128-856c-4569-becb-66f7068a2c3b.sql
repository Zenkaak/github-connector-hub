-- Purge stale pgmq messages with missing/empty unsubscribe_token
SELECT pgmq.purge_queue('transactional_emails');
SELECT pgmq.purge_queue('auth_emails');