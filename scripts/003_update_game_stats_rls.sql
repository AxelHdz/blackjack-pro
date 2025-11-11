-- Drop existing restrictive SELECT policies on game_stats
DROP POLICY IF EXISTS "Users can view own stats" ON game_stats;
DROP POLICY IF EXISTS "Users can view their own stats" ON game_stats;

-- Create new policy that allows users to view their own stats AND their friends' stats
CREATE POLICY "Users can view own and friends stats"
  ON game_stats FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM friends 
      WHERE friends.user_id = auth.uid() 
      AND friends.friend_user_id = game_stats.user_id
    )
  );

-- Also allow viewing all stats for leaderboard (global view)
-- This is safe because game_stats doesn't contain sensitive information
CREATE POLICY "Anyone can view game stats for leaderboard"
  ON game_stats FOR SELECT
  USING (true);
