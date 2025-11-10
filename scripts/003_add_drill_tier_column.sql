-- Add drill_tier column to track buyback drill progression
alter table public.game_stats
add column if not exists drill_tier integer default 1;

-- Add comment for documentation
comment on column public.game_stats.drill_tier is 'Current tier level in the escalating mastery buyback drill system (1-20+)';
