-- 20241203000003_enforce_unique_game_stats_user.sql
-- Enforce a single stats row per user and harden rank calculation against duplicates

BEGIN;

-- Ensure one stats row per user
ALTER TABLE public.game_stats
  ADD CONSTRAINT game_stats_user_unique UNIQUE (user_id);

-- Recreate rank function to ignore any existing duplicates and only count users with profiles
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
  -- Get user's stats (only if profile exists)
  SELECT gs.total_money, gs.level
  INTO v_user_stats
  FROM public.game_stats gs
  WHERE gs.user_id = p_user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = gs.user_id
    );
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Calculate rank based on metric, counting distinct users with profiles
  IF p_metric = 'balance' THEN
    IF p_scope = 'friends' AND array_length(p_friend_ids, 1) > 0 THEN
      SELECT COUNT(DISTINCT gs.user_id) + 1
      INTO v_rank
      FROM public.game_stats gs
      WHERE gs.user_id = ANY(p_friend_ids)
        AND EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = gs.user_id
        )
        AND (
          gs.total_money > v_user_stats.total_money OR
          (gs.total_money = v_user_stats.total_money AND gs.level > v_user_stats.level) OR
          (gs.total_money = v_user_stats.total_money AND gs.level = v_user_stats.level AND gs.user_id < p_user_id)
        );
    ELSE
      SELECT COUNT(DISTINCT gs.user_id) + 1
      INTO v_rank
      FROM public.game_stats gs
      WHERE EXISTS (
        SELECT 1 FROM public.user_profiles up WHERE up.id = gs.user_id
      )
      AND (
        gs.total_money > v_user_stats.total_money OR
        (gs.total_money = v_user_stats.total_money AND gs.level > v_user_stats.level) OR
        (gs.total_money = v_user_stats.total_money AND gs.level = v_user_stats.level AND gs.user_id < p_user_id)
      );
    END IF;
  ELSE
    -- Level metric
    IF p_scope = 'friends' AND array_length(p_friend_ids, 1) > 0 THEN
      SELECT COUNT(DISTINCT gs.user_id) + 1
      INTO v_rank
      FROM public.game_stats gs
      WHERE gs.user_id = ANY(p_friend_ids)
        AND EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = gs.user_id
        )
        AND (
          gs.level > v_user_stats.level OR
          (gs.level = v_user_stats.level AND gs.total_money > v_user_stats.total_money) OR
          (gs.level = v_user_stats.level AND gs.total_money = v_user_stats.total_money AND gs.user_id < p_user_id)
        );
    ELSE
      SELECT COUNT(DISTINCT gs.user_id) + 1
      INTO v_rank
      FROM public.game_stats gs
      WHERE EXISTS (
        SELECT 1 FROM public.user_profiles up WHERE up.id = gs.user_id
      )
      AND (
        gs.level > v_user_stats.level OR
        (gs.level = v_user_stats.level AND gs.total_money > v_user_stats.total_money) OR
        (gs.level = v_user_stats.level AND gs.total_money = v_user_stats.total_money AND gs.user_id < p_user_id)
      );
    END IF;
  END IF;
  
  RETURN v_rank;
END;
$$;

COMMIT;
