
-- Add missing columns to chama_support_messages
ALTER TABLE public.chama_support_messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE public.chama_support_messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.chama_support_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.chama_support_messages ADD COLUMN IF NOT EXISTS file_name text;

-- Add missing columns to chama_groups
ALTER TABLE public.chama_groups ADD COLUMN IF NOT EXISTS joining_fee numeric DEFAULT 0;

-- Add missing column to chama_withdrawals
ALTER TABLE public.chama_withdrawals ADD COLUMN IF NOT EXISTS admin_reason text;
