-- 20241203000001_add_leaderboard_composite_indexes.sql
-- Add composite indexes to optimize leaderboard ranking queries
-- 
-- Optimizes queries with patterns:
-- 1. ORDER BY total_money DESC, level DESC, user_id ASC (balance metric)
-- 2. ORDER BY level DESC, total_money DESC, user_id ASC (level metric)
-- 3. Rank calculation queries that need to find position in sorted order

BEGIN;

-- ============================================================================
-- COMPOSITE INDEXES FOR LEADERBOARD QUERIES
-- ============================================================================

-- Composite index for balance-based leaderboard ranking
-- Optimizes: ORDER BY total_money DESC, level DESC, user_id ASC
-- Used by: /api/leaderboard?metric=balance and rank calculation for balance metric
CREATE INDEX IF NOT EXISTS idx_game_stats_balance_ranking 
  ON public.game_stats(total_money DESC, level DESC, user_id ASC);

-- Composite index for level-based leaderboard ranking
-- Optimizes: ORDER BY level DESC, total_money DESC, user_id ASC
-- Used by: /api/leaderboard?metric=level and rank calculation for level metric
CREATE INDEX IF NOT EXISTS idx_game_stats_level_ranking 
  ON public.game_stats(level DESC, total_money DESC, user_id ASC);

-- ============================================================================
-- INDEX USAGE NOTES
-- ============================================================================
-- These composite indexes will:
-- 1. Enable index-only scans for leaderboard list queries (no sorting needed)
-- 2. Allow efficient rank calculation using index seeks instead of full table scans
-- 3. Support both global and friends-scoped queries (friends filter applied after index scan)
-- 4. Match the exact sort order used in application queries for optimal performance

COMMIT;

