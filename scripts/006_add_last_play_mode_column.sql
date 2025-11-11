-- Add last_play_mode column to track the user's last selected play mode
alter table public.game_stats
add column if not exists last_play_mode text default 'guided';

-- Add comment for documentation
comment on column public.game_stats.last_play_mode is 'Last selected play mode: guided, practice, or expert';
