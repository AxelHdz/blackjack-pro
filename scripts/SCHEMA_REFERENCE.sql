-- ============================================================================
-- BLACKJACK PRO - DATABASE SCHEMA REFERENCE
-- ============================================================================
-- This file contains the complete current database schema for reference.
-- It represents the final state after all migrations have been applied.
-- Do not run this file directly - it is for reference only.
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_profiles
-- Stores user profile information
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view friends profiles"
  ON public.user_profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM friends WHERE friend_user_id = user_profiles.id
    )
  );

CREATE POLICY "Anyone can view display names for leaderboard"
  ON public.user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- game_stats
-- Stores game statistics and player progress
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Overall stats
  total_money INTEGER DEFAULT 500,
  total_winnings INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  hands_played INTEGER DEFAULT 0,
  correct_moves INTEGER DEFAULT 0,
  total_moves INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  
  -- Learning mode stats
  learning_hands_played INTEGER DEFAULT 0,
  learning_correct_moves INTEGER DEFAULT 0,
  learning_total_moves INTEGER DEFAULT 0,
  learning_wins INTEGER DEFAULT 0,
  learning_losses INTEGER DEFAULT 0,
  
  -- Practice mode stats
  practice_hands_played INTEGER DEFAULT 0,
  practice_correct_moves INTEGER DEFAULT 0,
  practice_total_moves INTEGER DEFAULT 0,
  practice_wins INTEGER DEFAULT 0,
  practice_losses INTEGER DEFAULT 0,
  
  -- Expert mode stats
  expert_hands_played INTEGER DEFAULT 0,
  expert_correct_moves INTEGER DEFAULT 0,
  expert_total_moves INTEGER DEFAULT 0,
  expert_wins INTEGER DEFAULT 0,
  expert_losses INTEGER DEFAULT 0,
  
  -- Additional fields
  drill_tier INTEGER DEFAULT 1,
  last_play_mode TEXT DEFAULT 'guided',
  level_winnings INTEGER DEFAULT 0,
  deck JSONB,
  last_drill_completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments for documentation
COMMENT ON COLUMN public.game_stats.drill_tier IS 'Current tier level in the escalating mastery buyback drill system (1-20+)';
COMMENT ON COLUMN public.game_stats.last_play_mode IS 'Last selected play mode: guided, practice, or expert';
COMMENT ON COLUMN public.game_stats.level_winnings IS 'Winnings accrued since current level began. Resets to 0 on level-up.';
COMMENT ON COLUMN public.game_stats.deck IS 'Current card deck state as JSONB array. Each card has suit and rank properties. Contains up to 312 cards (6 decks).';
COMMENT ON COLUMN public.game_stats.last_drill_completed_at IS 'Timestamp of when the player last successfully completed a buyback drill. Used for 24-hour tier reset logic.';

-- Enable RLS for game_stats
ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_stats
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

CREATE POLICY "Anyone can view game stats for leaderboard"
  ON game_stats FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own stats"
  ON public.game_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON public.game_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for game_stats
CREATE INDEX IF NOT EXISTS idx_game_stats_total_money ON game_stats(total_money DESC);
CREATE INDEX IF NOT EXISTS idx_game_stats_level ON game_stats(level DESC);

-- ----------------------------------------------------------------------------
-- friends
-- Bidirectional friendship relationships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_user_id)
);

-- Enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Policies for friends table
CREATE POLICY "Users can view their own friends"
  ON friends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add friends"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove friends"
  ON friends FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for friends
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_user_id ON friends(friend_user_id);

-- ----------------------------------------------------------------------------
-- friend_requests
-- Friend request system for two-way requests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- Enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Policies for friend_requests table
CREATE POLICY "Users can view their own sent and received requests"
  ON friend_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update received requests"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = to_user_id);

CREATE POLICY "Users can delete their own requests"
  ON friend_requests FOR DELETE
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Indexes for friend_requests
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

-- ----------------------------------------------------------------------------
-- challenges
-- User-to-user challenge system for timed competitions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wager_amount INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (15, 30)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  challenger_balance_start INTEGER,
  challenged_balance_start INTEGER,
  challenger_balance_end INTEGER,
  challenged_balance_end INTEGER,
  winner_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Policies for challenges table
CREATE POLICY "Users can view challenges where they are challenger or challenged"
  ON challenges FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges where they are the challenger"
  ON challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update challenges where they are challenger (pending only) or challenged (accept/counter-offer)"
  ON challenges FOR UPDATE
  USING (
    (auth.uid() = challenger_id AND status = 'pending') OR
    (auth.uid() = challenged_id)
  );

CREATE POLICY "Users can delete challenges where they are challenger and status is pending"
  ON challenges FOR DELETE
  USING (auth.uid() = challenger_id AND status = 'pending');

-- Indexes for challenges
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_id ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged_id ON challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires_at ON challenges(expires_at);

-- Partial unique indexes to ensure one active/pending challenge per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_active_challenger
  ON challenges(challenger_id)
  WHERE status IN ('pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_active_challenged
  ON challenges(challenged_id)
  WHERE status IN ('pending', 'active');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- handle_new_user()
-- Automatically creates user profile and game stats when a new user signs up
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  username_from_email text;
BEGIN
  -- Extract username from email (part before @)
  username_from_email := split_part(NEW.email, '@', 1);
  
  -- Replace dots and special characters with underscores
  username_from_email := regexp_replace(username_from_email, '[^a-zA-Z0-9]', '', 'g');
  
  -- Insert into user_profiles
  INSERT INTO public.user_profiles (id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    username_from_email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert default game stats
  INSERT INTO public.game_stats (user_id)
  VALUES (new.id)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- create_bidirectional_friendship()
-- Creates bidirectional friendship relationships between two users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_bidirectional_friendship(
  user1_id UUID,
  user2_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if friendship already exists
  IF EXISTS (
    SELECT 1 FROM friends 
    WHERE (user_id = user1_id AND friend_user_id = user2_id)
       OR (user_id = user2_id AND friend_user_id = user1_id)
  ) THEN
    RETURN;
  END IF;

  -- Create bidirectional friendship
  INSERT INTO friends (user_id, friend_user_id, created_at)
  VALUES 
    (user1_id, user2_id, NOW()),
    (user2_id, user1_id, NOW())
  ON CONFLICT (user_id, friend_user_id) DO NOTHING;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_bidirectional_friendship(UUID, UUID) TO authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- on_auth_user_created
-- Trigger that creates user profile and game stats when a new user signs up
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- ============================================================================
-- SCHEMA SUMMARY
-- ============================================================================
-- 
-- Tables:
--   1. user_profiles - User profile information
--   2. game_stats - Game statistics and player progress
--   3. friends - Bidirectional friendship relationships
--   4. friend_requests - Friend request system
--   5. challenges - User-to-user challenge system
--
-- Functions:
--   1. handle_new_user() - Auto-creates profile and stats on signup
--   2. create_bidirectional_friendship() - Creates bidirectional friendships
--
-- Triggers:
--   1. on_auth_user_created - Triggers handle_new_user() on user signup
--
-- Key Features:
--   - Row Level Security (RLS) enabled on all tables
--   - Automatic profile and stats creation on signup
--   - Bidirectional friendship system
--   - Challenge system with wager tracking
--   - Leaderboard support with public read access
--   - Friend-based privacy controls
--
-- ============================================================================

