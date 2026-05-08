-- WALLET dupes
WITH ranked AS (
  SELECT id, user_id, amount,
    ROW_NUMBER() OVER (PARTITION BY user_id, reference_id, type ORDER BY created_at) AS rn
  FROM public.wallet_transactions WHERE reference_id IS NOT NULL
),
dupes AS (SELECT id, user_id, amount FROM ranked WHERE rn > 1),
refund AS (SELECT user_id, SUM(amount) AS over_credit FROM dupes GROUP BY user_id),
del AS (DELETE FROM public.wallet_transactions WHERE id IN (SELECT id FROM dupes) RETURNING 1)
UPDATE public.wallets w SET balance = GREATEST(0, w.balance - r.over_credit)
FROM refund r WHERE w.user_id = r.user_id;

-- PERSONAL SAVINGS dupes
WITH ranked AS (
  SELECT id, savings_id, amount,
    ROW_NUMBER() OVER (PARTITION BY savings_id, stk_reference ORDER BY created_at) AS rn
  FROM public.personal_savings_deposits WHERE stk_reference IS NOT NULL
),
dupes AS (SELECT id, savings_id, amount FROM ranked WHERE rn > 1),
refund AS (SELECT savings_id, SUM(amount) AS over FROM dupes GROUP BY savings_id),
del AS (DELETE FROM public.personal_savings_deposits WHERE id IN (SELECT id FROM dupes) RETURNING 1)
UPDATE public.personal_savings p SET saved_amount = GREATEST(0, p.saved_amount - r.over)
FROM refund r WHERE p.id = r.savings_id;

-- CHAMA SAVINGS dupes
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY group_id, user_id, stk_reference ORDER BY created_at) AS rn
  FROM public.chama_savings WHERE stk_reference IS NOT NULL
)
DELETE FROM public.chama_savings WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- HARAMBEE dupes
WITH ranked AS (
  SELECT id, harambee_id, amount,
    ROW_NUMBER() OVER (PARTITION BY harambee_id, stk_reference ORDER BY created_at) AS rn
  FROM public.chama_harambee_contributions WHERE stk_reference IS NOT NULL
),
dupes AS (SELECT id, harambee_id, amount FROM ranked WHERE rn > 1),
refund AS (SELECT harambee_id, SUM(amount) AS over FROM dupes GROUP BY harambee_id),
del AS (DELETE FROM public.chama_harambee_contributions WHERE id IN (SELECT id FROM dupes) RETURNING 1)
UPDATE public.chama_harambees h SET raised_amount = GREATEST(0, h.raised_amount - r.over)
FROM refund r WHERE h.id = r.harambee_id;

-- Idempotency indexes
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_user_ref_type_uidx
  ON public.wallet_transactions (user_id, reference_id, type) WHERE reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS personal_savings_deposits_ref_uidx
  ON public.personal_savings_deposits (savings_id, stk_reference) WHERE stk_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chama_savings_ref_user_uidx
  ON public.chama_savings (group_id, user_id, stk_reference) WHERE stk_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chama_harambee_contributions_ref_uidx
  ON public.chama_harambee_contributions (harambee_id, stk_reference) WHERE stk_reference IS NOT NULL;