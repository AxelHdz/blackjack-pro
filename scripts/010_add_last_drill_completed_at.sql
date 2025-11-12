-- Add last_drill_completed_at column to track when player last successfully completed a drill
alter table public.game_stats
add column if not exists last_drill_completed_at timestamp with time zone;

-- Add comment for documentation
comment on column public.game_stats.last_drill_completed_at is 'Timestamp of when the player last successfully completed a buyback drill. Used for 24-hour tier reset logic.';

