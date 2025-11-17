-- Update challenge duration options to 5 or 10 minutes.
-- Drops the old 15/30 constraint and replaces it with 5/10.

ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_duration_minutes_check,
  ADD CONSTRAINT challenges_duration_minutes_check CHECK (duration_minutes IN (5, 10));
