-- 20251123000238_fix_mode_stats_mismatch.sql
-- Fix Mode Stats Mismatch
-- 
-- This migration backfills missing mode-specific stats for users where
-- overall hands_played doesn't match the sum of mode-specific hands_played.
-- 
-- Strategy:
-- 1. For users with some mode stats: distribute missing hands proportionally
-- 2. For users with zero mode stats: assign to last_play_mode (or "guided" as default)
--
-- Note: This migration uses explicit transaction control for safety.
-- All updates are atomic - if any error occurs, all changes are rolled back.

BEGIN;

DO $$
DECLARE
  user_record RECORD;
  missing_hands INTEGER;
  missing_wins INTEGER;
  missing_losses INTEGER;
  total_mode_hands INTEGER;
  total_mode_wins INTEGER;
  total_mode_losses INTEGER;
  learning_ratio NUMERIC;
  practice_ratio NUMERIC;
  expert_ratio NUMERIC;
  learning_add INTEGER;
  practice_add INTEGER;
  expert_add INTEGER;
  learning_wins_add INTEGER;
  practice_wins_add INTEGER;
  expert_wins_add INTEGER;
  learning_losses_add INTEGER;
  practice_losses_add INTEGER;
  expert_losses_add INTEGER;
  target_mode TEXT;
  users_processed INTEGER := 0;
BEGIN
  -- Process each user with mismatched stats
  FOR user_record IN
    SELECT 
      user_id,
      COALESCE(hands_played, 0) as hands_played,
      COALESCE(wins, 0) as wins,
      COALESCE(losses, 0) as losses,
      COALESCE(learning_hands_played, 0) as learning_hands_played,
      COALESCE(practice_hands_played, 0) as practice_hands_played,
      COALESCE(expert_hands_played, 0) as expert_hands_played,
      COALESCE(learning_wins, 0) as learning_wins,
      COALESCE(practice_wins, 0) as practice_wins,
      COALESCE(expert_wins, 0) as expert_wins,
      COALESCE(learning_losses, 0) as learning_losses,
      COALESCE(practice_losses, 0) as practice_losses,
      COALESCE(expert_losses, 0) as expert_losses,
      last_play_mode
    FROM game_stats
    WHERE COALESCE(hands_played, 0) != 
      (COALESCE(learning_hands_played, 0) + COALESCE(practice_hands_played, 0) + COALESCE(expert_hands_played, 0))
    FOR UPDATE
  LOOP
    -- Calculate missing stats (using COALESCE to handle NULLs)
    total_mode_hands := user_record.learning_hands_played + user_record.practice_hands_played + user_record.expert_hands_played;
    missing_hands := user_record.hands_played - total_mode_hands;
    
    total_mode_wins := user_record.learning_wins + user_record.practice_wins + user_record.expert_wins;
    missing_wins := user_record.wins - total_mode_wins;
    
    total_mode_losses := user_record.learning_losses + user_record.practice_losses + user_record.expert_losses;
    missing_losses := user_record.losses - total_mode_losses;
    
    -- Skip if no missing hands to distribute (shouldn't happen due to WHERE clause, but safety check)
    IF missing_hands <= 0 THEN
      CONTINUE;
    END IF;
    
    -- Strategy 1: If user has some mode stats, distribute proportionally
    IF total_mode_hands > 0 THEN
      -- Calculate ratios based on existing mode stats (safe division - we know total_mode_hands > 0)
      learning_ratio := user_record.learning_hands_played::NUMERIC / total_mode_hands::NUMERIC;
      practice_ratio := user_record.practice_hands_played::NUMERIC / total_mode_hands::NUMERIC;
      expert_ratio := user_record.expert_hands_played::NUMERIC / total_mode_hands::NUMERIC;
      
      -- Distribute missing hands proportionally
      learning_add := FLOOR(missing_hands * learning_ratio);
      practice_add := FLOOR(missing_hands * practice_ratio);
      expert_add := missing_hands - learning_add - practice_add; -- Remainder goes to expert to ensure exact match
      
      -- Distribute wins proportionally (if there are missing wins)
      IF missing_wins > 0 THEN
        IF total_mode_wins > 0 THEN
          -- Use existing win ratios
          learning_wins_add := FLOOR(missing_wins * (user_record.learning_wins::NUMERIC / total_mode_wins::NUMERIC));
          practice_wins_add := FLOOR(missing_wins * (user_record.practice_wins::NUMERIC / total_mode_wins::NUMERIC));
          expert_wins_add := missing_wins - learning_wins_add - practice_wins_add;
        ELSE
          -- If no mode wins but missing wins, distribute proportionally by hands
          learning_wins_add := FLOOR(missing_wins * learning_ratio);
          practice_wins_add := FLOOR(missing_wins * practice_ratio);
          expert_wins_add := missing_wins - learning_wins_add - practice_wins_add;
        END IF;
      ELSE
        learning_wins_add := 0;
        practice_wins_add := 0;
        expert_wins_add := 0;
      END IF;
      
      -- Distribute losses proportionally (if there are missing losses)
      IF missing_losses > 0 THEN
        IF total_mode_losses > 0 THEN
          -- Use existing loss ratios
          learning_losses_add := FLOOR(missing_losses * (user_record.learning_losses::NUMERIC / total_mode_losses::NUMERIC));
          practice_losses_add := FLOOR(missing_losses * (user_record.practice_losses::NUMERIC / total_mode_losses::NUMERIC));
          expert_losses_add := missing_losses - learning_losses_add - practice_losses_add;
        ELSE
          -- If no mode losses but missing losses, distribute proportionally by hands
          learning_losses_add := FLOOR(missing_losses * learning_ratio);
          practice_losses_add := FLOOR(missing_losses * practice_ratio);
          expert_losses_add := missing_losses - learning_losses_add - practice_losses_add;
        END IF;
      ELSE
        learning_losses_add := 0;
        practice_losses_add := 0;
        expert_losses_add := 0;
      END IF;
    ELSE
      -- Strategy 2: User has zero mode stats, assign to last_play_mode or default to "guided"
      target_mode := COALESCE(user_record.last_play_mode, 'guided');
      
      -- Map last_play_mode to the correct prefix
      IF target_mode = 'guided' OR target_mode = 'learning' THEN
        learning_add := missing_hands;
        practice_add := 0;
        expert_add := 0;
        
        learning_wins_add := GREATEST(0, missing_wins);
        practice_wins_add := 0;
        expert_wins_add := 0;
        
        learning_losses_add := GREATEST(0, missing_losses);
        practice_losses_add := 0;
        expert_losses_add := 0;
      ELSIF target_mode = 'practice' THEN
        learning_add := 0;
        practice_add := missing_hands;
        expert_add := 0;
        
        learning_wins_add := 0;
        practice_wins_add := GREATEST(0, missing_wins);
        expert_wins_add := 0;
        
        learning_losses_add := 0;
        practice_losses_add := GREATEST(0, missing_losses);
        expert_losses_add := 0;
      ELSE
        -- expert or any other value
        learning_add := 0;
        practice_add := 0;
        expert_add := missing_hands;
        
        learning_wins_add := 0;
        practice_wins_add := 0;
        expert_wins_add := GREATEST(0, missing_wins);
        
        learning_losses_add := 0;
        practice_losses_add := 0;
        expert_losses_add := GREATEST(0, missing_losses);
      END IF;
    END IF;
    
    -- Update the user's stats
    UPDATE game_stats
    SET
      learning_hands_played = learning_hands_played + learning_add,
      practice_hands_played = practice_hands_played + practice_add,
      expert_hands_played = expert_hands_played + expert_add,
      learning_wins = learning_wins + learning_wins_add,
      practice_wins = practice_wins + practice_wins_add,
      expert_wins = expert_wins + expert_wins_add,
      learning_losses = learning_losses + learning_losses_add,
      practice_losses = practice_losses + practice_losses_add,
      expert_losses = expert_losses + expert_losses_add,
      updated_at = NOW()
    WHERE user_id = user_record.user_id;
    
    users_processed := users_processed + 1;
    RAISE NOTICE 'Fixed stats for user %: added % learning, % practice, % expert hands (wins: %/%/%, losses: %/%/%)', 
      user_record.user_id, 
      learning_add, practice_add, expert_add,
      learning_wins_add, practice_wins_add, expert_wins_add,
      learning_losses_add, practice_losses_add, expert_losses_add;
  END LOOP;
  
  RAISE NOTICE 'Migration completed: processed % users with mismatched stats', users_processed;
END $$;

-- Verify the fix
DO $$
DECLARE
  mismatch_count INTEGER;
  mismatch_details TEXT;
BEGIN
  SELECT COUNT(*)
  INTO mismatch_count
  FROM game_stats
  WHERE COALESCE(hands_played, 0) != 
    (COALESCE(learning_hands_played, 0) + COALESCE(practice_hands_played, 0) + COALESCE(expert_hands_played, 0));
  
  IF mismatch_count > 0 THEN
    -- Get details of remaining mismatches for debugging
    SELECT string_agg(user_id::TEXT || ' (diff: ' || 
      (hands_played - (learning_hands_played + practice_hands_played + expert_hands_played))::TEXT || ')', ', ')
    INTO mismatch_details
    FROM game_stats
    WHERE COALESCE(hands_played, 0) != 
      (COALESCE(learning_hands_played, 0) + COALESCE(practice_hands_played, 0) + COALESCE(expert_hands_played, 0))
    LIMIT 10;
    
    RAISE WARNING 'Still have % users with mismatched stats after migration. Affected users: %', 
      mismatch_count, COALESCE(mismatch_details, 'none');
  ELSE
    RAISE NOTICE 'All user stats are now consistent!';
  END IF;
END $$;

COMMIT;

