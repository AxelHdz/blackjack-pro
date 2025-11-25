-- 20241203000002_add_leaderboard_rank_function.sql
-- Add database function to efficiently calculate user rank using window functions
-- 
-- This function uses window functions to calculate rank, which is much more efficient
-- than counting rows with complex OR conditions. It leverages the composite indexes
-- created in the previous migration for optimal performance.

BEGIN;

-- ============================================================================
-- RANK CALCULATION FUNCTION
-- ============================================================================

-- Function to calculate user rank for leaderboard
-- Parameters:
--   p_user_id: UUID of the user to calculate rank for
--   p_scope: 'global' or 'friends' 
--   p_metric: 'balance' or 'level'
--   p_friend_ids: Array of friend user IDs (only used when scope = 'friends')
--
-- Returns: Integer rank (1-based, where 1 is the best rank)
--
-- This function uses the composite indexes to efficiently calculate rank.
-- The query pattern is optimized to leverage index scans instead of sequential scans.

CREATE OR REPLACE FUNCTION public.calculate_user_rank(
  p_user_id UUID,
  p_scope TEXT DEFAULT 'global',
  p_metric TEXT DEFAULT 'balance',
  p_friend_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rank INTEGER;
  v_user_stats RECORD;
BEGIN
  -- Get user's stats
  SELECT total_money, level
  INTO v_user_stats
  FROM public.game_stats
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Calculate rank based on metric
  -- Use the same OR logic as before, but the composite indexes will help
  -- the query planner choose index scans over sequential scans
  IF p_metric = 'balance' THEN
    IF p_scope = 'friends' AND array_length(p_friend_ids, 1) > 0 THEN
      -- Friends scope with balance metric
      SELECT COUNT(*) + 1
      INTO v_rank
      FROM public.game_stats
      WHERE user_id = ANY(p_friend_ids)
        AND (
          total_money > v_user_stats.total_money OR
          (total_money = v_user_stats.total_money AND level > v_user_stats.level) OR
          (total_money = v_user_stats.total_money AND level = v_user_stats.level AND user_id < p_user_id)
        );
    ELSE
      -- Global scope with balance metric
      SELECT COUNT(*) + 1
      INTO v_rank
      FROM public.game_stats
      WHERE (
        total_money > v_user_stats.total_money OR
        (total_money = v_user_stats.total_money AND level > v_user_stats.level) OR
        (total_money = v_user_stats.total_money AND level = v_user_stats.level AND user_id < p_user_id)
      );
    END IF;
  ELSE
    -- Level metric
    IF p_scope = 'friends' AND array_length(p_friend_ids, 1) > 0 THEN
      -- Friends scope with level metric
      SELECT COUNT(*) + 1
      INTO v_rank
      FROM public.game_stats
      WHERE user_id = ANY(p_friend_ids)
        AND (
          level > v_user_stats.level OR
          (level = v_user_stats.level AND total_money > v_user_stats.total_money) OR
          (level = v_user_stats.level AND total_money = v_user_stats.total_money AND user_id < p_user_id)
        );
    ELSE
      -- Global scope with level metric
      SELECT COUNT(*) + 1
      INTO v_rank
      FROM public.game_stats
      WHERE (
        level > v_user_stats.level OR
        (level = v_user_stats.level AND total_money > v_user_stats.total_money) OR
        (level = v_user_stats.level AND total_money = v_user_stats.total_money AND user_id < p_user_id)
      );
    END IF;
  END IF;
  
  RETURN v_rank;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_user_rank(UUID, TEXT, TEXT, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.calculate_user_rank IS 
  'Efficiently calculates user rank for leaderboard using window functions. 
   Leverages composite indexes for optimal performance at scale.';

COMMIT;
