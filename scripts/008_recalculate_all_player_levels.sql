-- Recalculate all player levels based on their actual wins
-- This accounts for the progressive XP scaling system where XP per win increases with level

-- Create a function to calculate level and XP from wins
CREATE OR REPLACE FUNCTION calculate_level_from_wins(wins_count INTEGER)
RETURNS TABLE(calculated_level INTEGER, calculated_xp INTEGER) AS $$
DECLARE
  current_level INTEGER := 1;
  current_xp INTEGER := 0;
  win_num INTEGER;
  xp_awarded INTEGER;
  xp_needed INTEGER;
  A CONSTANT NUMERIC := 120;
  alpha CONSTANT NUMERIC := 1.6;
  B CONSTANT NUMERIC := 10;
  XP_PER_WIN_BASE CONSTANT INTEGER := 10;
  XP_SCALING_FACTOR CONSTANT NUMERIC := 0.1;
BEGIN
  -- Award XP for each win, accounting for level scaling
  FOR win_num IN 1..wins_count LOOP
    -- Calculate XP per win based on current level
    xp_awarded := FLOOR(XP_PER_WIN_BASE * (1 + current_level * XP_SCALING_FACTOR));
    current_xp := current_xp + xp_awarded;
    
    -- Check for level-ups
    WHILE current_xp >= CEIL(A * POWER(current_level, alpha) + B * current_level) LOOP
      xp_needed := CEIL(A * POWER(current_level, alpha) + B * current_level);
      current_xp := current_xp - xp_needed;
      current_level := current_level + 1;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT current_level, current_xp;
END;
$$ LANGUAGE plpgsql;

-- Update all players' levels and XP based on their wins
DO $$
DECLARE
  player_record RECORD;
  calculated_result RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR player_record IN 
    SELECT user_id, wins, level, experience 
    FROM game_stats
  LOOP
    -- Calculate correct level and XP
    SELECT * INTO calculated_result 
    FROM calculate_level_from_wins(player_record.wins);
    
    -- Only update if different
    IF calculated_result.calculated_level != player_record.level 
       OR calculated_result.calculated_xp != player_record.experience THEN
      
      UPDATE game_stats
      SET 
        level = calculated_result.calculated_level,
        experience = calculated_result.calculated_xp,
        level_winnings = 0  -- Reset level winnings since we're recalculating
      WHERE user_id = player_record.user_id;
      
      updated_count := updated_count + 1;
      
      RAISE NOTICE 'Updated user %: Level % → %, XP % → % (wins: %)',
        player_record.user_id,
        player_record.level, calculated_result.calculated_level,
        player_record.experience, calculated_result.calculated_xp,
        player_record.wins;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total players updated: %', updated_count;
END $$;

-- Drop the temporary function
DROP FUNCTION IF EXISTS calculate_level_from_wins(INTEGER);

