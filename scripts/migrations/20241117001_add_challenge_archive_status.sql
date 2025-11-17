-- 20241117001_add_challenge_archive_status.sql
-- Adds archive status columns to track when users have dismissed completed challenges from their view

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS challenger_archive_status BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS challenged_archive_status BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.challenges.challenger_archive_status IS 'Whether the challenger has archived this challenge from their view';
COMMENT ON COLUMN public.challenges.challenged_archive_status IS 'Whether the challenged player has archived this challenge from their view';
