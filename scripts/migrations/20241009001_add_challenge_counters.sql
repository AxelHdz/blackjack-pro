-- Adds challenge outcome counters to track user challenge history.
ALTER TABLE public.game_stats
  ADD COLUMN IF NOT EXISTS completed_challenges INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS won_challenges INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lost_challenges INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tied_challenges INTEGER DEFAULT 0;

COMMENT ON COLUMN public.game_stats.completed_challenges IS 'Total number of completed challenges';
COMMENT ON COLUMN public.game_stats.won_challenges IS 'Total number of challenge wins';
COMMENT ON COLUMN public.game_stats.lost_challenges IS 'Total number of challenge losses';
COMMENT ON COLUMN public.game_stats.tied_challenges IS 'Total number of challenge ties';
