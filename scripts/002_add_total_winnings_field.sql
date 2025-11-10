-- Add a total_winnings field to properly track winnings separately from balance
alter table public.game_stats add column if not exists total_winnings integer default 0;
