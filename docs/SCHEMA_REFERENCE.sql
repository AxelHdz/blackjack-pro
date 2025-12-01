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

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- game_stats
-- Stores game statistics and player progress
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_stats (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  
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
  
  -- Challenge statistics
  completed_challenges INTEGER DEFAULT 0,
  won_challenges INTEGER DEFAULT 0,
  lost_challenges INTEGER DEFAULT 0,
  tied_challenges INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments for documentation
COMMENT ON COLUMN public.game_stats.drill_tier IS 'Current tier level in the escalating mastery buyback drill system (1-20+)';
COMMENT ON COLUMN public.game_stats.last_play_mode IS 'Last selected play mode: guided, practice, or expert';
COMMENT ON COLUMN public.game_stats.level_winnings IS 'Winnings accrued since current level began. Resets to 0 on level-up.';
COMMENT ON COLUMN public.game_stats.deck IS 'Current card deck state as JSONB array. Each card has suit and rank properties. Contains up to 312 cards (6 decks).';
COMMENT ON COLUMN public.game_stats.last_drill_completed_at IS 'Timestamp of when the player last successfully completed a buyback drill. Used for 24-hour tier reset logic.';
COMMENT ON COLUMN public.game_stats.completed_challenges IS 'Total number of completed challenges';
COMMENT ON COLUMN public.game_stats.won_challenges IS 'Total number of challenge wins';
COMMENT ON COLUMN public.game_stats.lost_challenges IS 'Total number of challenge losses';
COMMENT ON COLUMN public.game_stats.tied_challenges IS 'Total number of challenge ties';

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

CREATE POLICY "Users can insert own stats"
  ON public.game_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON public.game_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for game_stats
CREATE INDEX IF NOT EXISTS idx_game_stats_total_money ON game_stats(total_money DESC);
CREATE INDEX IF NOT EXISTS idx_game_stats_level ON game_stats(level DESC);
CREATE INDEX IF NOT EXISTS idx_game_stats_balance_ranking ON game_stats(total_money DESC, level DESC, user_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_level_ranking ON game_stats(level DESC, total_money DESC, user_id);

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
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (5, 10)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'archived')),
  
  -- Balance tracking
  challenger_balance_start INTEGER,
  challenged_balance_start INTEGER,
  challenger_balance_end INTEGER,
  challenged_balance_end INTEGER,
  
  -- Challenge credit system
  challenger_balance_paused INTEGER,
  challenged_balance_paused INTEGER,
  challenger_credit_balance INTEGER,
  challenged_credit_balance INTEGER,
  challenger_credit_experience INTEGER DEFAULT 0,
  challenged_credit_experience INTEGER DEFAULT 0,
  
  -- Archive status (per-user)
  challenger_archive_status BOOLEAN DEFAULT FALSE,
  challenged_archive_status BOOLEAN DEFAULT FALSE,
  
  -- Challenge outcome
  winner_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments for challenge credit fields
COMMENT ON COLUMN public.challenges.challenger_balance_paused IS 'Snapshot of challengers real balance while challenge credits are active';
COMMENT ON COLUMN public.challenges.challenged_balance_paused IS 'Snapshot of challenged players real balance while challenge credits are active';
COMMENT ON COLUMN public.challenges.challenger_credit_balance IS 'Current challenge credit balance for the challenger';
COMMENT ON COLUMN public.challenges.challenged_credit_balance IS 'Current challenge credit balance for the challenged player';
COMMENT ON COLUMN public.challenges.challenger_credit_experience IS 'Accumulated challenge XP (doubled) awaiting payout for the challenger';
COMMENT ON COLUMN public.challenges.challenged_credit_experience IS 'Accumulated challenge XP (doubled) awaiting payout for the challenged player';
COMMENT ON COLUMN public.challenges.challenger_archive_status IS 'Whether the challenger has archived this challenge from their view';
COMMENT ON COLUMN public.challenges.challenged_archive_status IS 'Whether the challenged player has archived this challenge from their view';

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Policies for challenges table
CREATE POLICY "Users can view challenges where they are challenger or challenged"
  ON challenges FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges where they are the challenger"
  ON challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Participants can update challenges"
  ON challenges FOR UPDATE
  USING (
    auth.uid() = challenger_id OR
    auth.uid() = challenged_id
  );

CREATE POLICY "Users can delete challenges where they are challenger and status is pending"
  ON challenges FOR DELETE
  USING (auth.uid() = challenger_id AND status = 'pending');

-- Indexes for challenges
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_id ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged_id ON challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_status_created ON challenges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_winner_id ON challenges(winner_id);

-- Partial unique indexes to ensure one active/pending challenge per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_active_challenger
  ON challenges(challenger_id)
  WHERE status IN ('pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_active_challenged
  ON challenges(challenged_id)
  WHERE status IN ('pending', 'active');

-- Performance indexes for challenge queries
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_status_created
  ON challenges(challenger_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_challenges_challenged_status_created
  ON challenges(challenged_id, status, created_at DESC);

-- Partial indexes for non-archived challenges (optimizes active challenge queries)
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_not_archived
  ON challenges(challenger_id, status, created_at DESC)
  WHERE (challenger_archive_status IS FALSE OR challenger_archive_status IS NULL);

CREATE INDEX IF NOT EXISTS idx_challenges_challenged_not_archived
  ON challenges(challenged_id, status, created_at DESC)
  WHERE (challenged_archive_status IS FALSE OR challenged_archive_status IS NULL);

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
  );
  
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

-- ----------------------------------------------------------------------------
-- auto_archive_user_challenges()
-- Automatically archives previous challenges when a new challenge is created
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_archive_user_challenges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Archive challenges for the challenger (NEW.challenger_id)
  UPDATE challenges
  SET challenger_archive_status = true,
      updated_at = NOW()
  WHERE challenger_id = NEW.challenger_id
    AND status IN ('pending', 'active', 'completed')
    AND challenger_archive_status = false
    AND id != NEW.id;  -- Don't archive the newly created challenge

  -- Archive challenges for the challenged user (NEW.challenged_id)
  UPDATE challenges
  SET challenged_archive_status = true,
      updated_at = NOW()
  WHERE challenged_id = NEW.challenged_id
    AND status IN ('pending', 'active', 'completed')
    AND challenged_archive_status = false
    AND id != NEW.id;  -- Don't archive the newly created challenge

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- calculate_level_from_wins()
-- Calculates level and XP from a given number of wins
-- Used for leveling calculations and testing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_level_from_wins(wins_count integer)
RETURNS TABLE(calculated_level integer, calculated_xp integer)
LANGUAGE plpgsql
AS $$
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
$$;

-- ----------------------------------------------------------------------------
-- calculate_user_rank()
-- Calculates a user's rank based on scope (global/friends) and metric (balance/level)
-- Used by the leaderboard system to determine user rankings
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_user_rank(
  p_user_id uuid,
  p_scope text DEFAULT 'global'::text,
  p_metric text DEFAULT 'balance'::text,
  p_friend_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS integer
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

-- ----------------------------------------------------------------------------
-- trigger_auto_archive_challenges
-- Trigger that automatically archives previous challenges when a new challenge is created
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_auto_archive_challenges ON challenges;

CREATE TRIGGER trigger_auto_archive_challenges
  AFTER INSERT ON challenges
  FOR EACH ROW
  EXECUTE FUNCTION auto_archive_user_challenges();

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
--   3. auto_archive_user_challenges() - Archives previous challenges when new one is created
--   4. calculate_level_from_wins() - Calculates level and XP from win count
--   5. calculate_user_rank() - Calculates user rank for leaderboard (global/friends, balance/level)
--
-- Triggers:
--   1. on_auth_user_created - Triggers handle_new_user() on user signup
--   2. trigger_auto_archive_challenges - Archives old challenges when new challenge is created
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
