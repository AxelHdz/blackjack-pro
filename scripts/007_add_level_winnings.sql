-- Add level_winnings column to track winnings accrued since current level began
-- This resets to 0 on each level-up and tracks performance within the current level

alter table public.game_stats add column if not exists level_winnings integer default 0;

-- Add comment for documentation
comment on column public.game_stats.level_winnings is 'Winnings accrued since current level began. Resets to 0 on level-up.';

