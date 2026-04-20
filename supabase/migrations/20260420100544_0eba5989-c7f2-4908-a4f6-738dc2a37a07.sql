CREATE OR REPLACE FUNCTION public.refund_b2c_withdrawal(_request_id uuid, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _req record;
BEGIN
  SELECT * INTO _req FROM public.mpesa_b2c_requests WHERE id = _request_id FOR UPDATE;
  IF _req IS NULL THEN RAISE EXCEPTION 'B2C request not found'; END IF;
  IF _req.refunded THEN RETURN; END IF;

  UPDATE public.wallets SET balance = balance + _req.amount WHERE user_id = _req.user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, description, reference_id)
  VALUES (_req.user_id, 'credit', _req.amount,
    'Withdrawal refund: ' || COALESCE(_reason, 'M-Pesa unavailable'), _request_id::text);

  UPDATE public.mpesa_b2c_requests
  SET refunded = true,
      refunded_at = NOW(),
      status = 'failed',
      next_retry_at = NULL
  WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_req.user_id, 'Withdrawal Refunded',
    'KES ' || _req.amount || ' has been refunded to your wallet. ' || COALESCE(_reason, ''),
    'payment');
END;
$function$;