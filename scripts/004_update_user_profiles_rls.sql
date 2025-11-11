-- Update RLS policies for user_profiles to allow viewing friends' profiles
-- This enables the leaderboard to display friends' names

-- Drop existing view policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Create new policy to allow viewing own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow viewing friends' profiles
CREATE POLICY "Users can view friends profiles"
  ON user_profiles
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM friends WHERE friend_user_id = user_profiles.id
    )
  );

-- Create policy to allow viewing any profile for leaderboard (public usernames)
-- Since display names are not sensitive information
CREATE POLICY "Anyone can view display names for leaderboard"
  ON user_profiles
  FOR SELECT
  USING (true);
