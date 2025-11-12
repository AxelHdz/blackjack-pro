-- Add deck column to game_stats table to persist card deck state
-- The deck is stored as JSONB array of card objects: [{suit: "♠", rank: "A"}, ...]
alter table public.game_stats
add column if not exists deck jsonb;

-- Add comment to document the deck structure
comment on column public.game_stats.deck is 'Current card deck state as JSONB array. Each card has suit and rank properties. Contains up to 312 cards (6 decks).';
