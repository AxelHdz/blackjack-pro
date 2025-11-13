-- 20240324001_add_challenge_credits.sql
-- Adds challenge credit tracking fields used for the new challenge mode.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS challenger_balance_paused INTEGER,
  ADD COLUMN IF NOT EXISTS challenged_balance_paused INTEGER,
  ADD COLUMN IF NOT EXISTS challenger_credit_balance INTEGER,
  ADD COLUMN IF NOT EXISTS challenged_credit_balance INTEGER,
  ADD COLUMN IF NOT EXISTS challenger_credit_experience INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS challenged_credit_experience INTEGER DEFAULT 0;

COMMENT ON COLUMN public.challenges.challenger_balance_paused IS 'Snapshot of challengers real balance while challenge credits are active';
COMMENT ON COLUMN public.challenges.challenged_balance_paused IS 'Snapshot of challenged players real balance while challenge credits are active';
COMMENT ON COLUMN public.challenges.challenger_credit_balance IS 'Current challenge credit balance for the challenger';
COMMENT ON COLUMN public.challenges.challenged_credit_balance IS 'Current challenge credit balance for the challenged player';
COMMENT ON COLUMN public.challenges.challenger_credit_experience IS 'Accumulated challenge XP (doubled) awaiting payout for the challenger';
COMMENT ON COLUMN public.challenges.challenged_credit_experience IS 'Accumulated challenge XP (doubled) awaiting payout for the challenged player';
