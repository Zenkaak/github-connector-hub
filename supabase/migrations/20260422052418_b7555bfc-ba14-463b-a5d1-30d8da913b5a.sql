-- 1. Drop the duplicate notification trigger
DROP TRIGGER IF EXISTS on_stk_success ON public.stk_transactions;

-- 2. Refund the known duplicate credit (UDM1Y1V473 was credited twice for KES 10)
DELETE FROM public.wallet_transactions
WHERE id IN (
  SELECT id FROM public.wallet_transactions
  WHERE description = 'M-Pesa deposit · UDM1Y1V473'
    AND user_id = '0cd585fa-d342-486f-8f6c-c8743277cd2c'
  LIMIT 1
);

UPDATE public.wallets
SET balance = GREATEST(0, balance - 10)
WHERE user_id = '0cd585fa-d342-486f-8f6c-c8743277cd2c';

-- Also refund the chama double-credit (UDM1Y1V6XA — KES 1 to chama_savings)
-- Check if there are duplicate chama_savings rows for this receipt
DELETE FROM public.chama_savings
WHERE id IN (
  SELECT id FROM public.chama_savings
  WHERE stk_reference = 'UDM1Y1V6XA'
  ORDER BY created_at DESC
  OFFSET 1
);