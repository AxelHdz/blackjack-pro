-- 20241202001_optimize_database_performance.sql
-- Database Performance Optimization
-- Fixes performance warnings from Supabase advisors:
-- 1. Add missing index on foreign key
-- 2. Optimize RLS policies to use subquery pattern
-- 3. Remove duplicate RLS policies
-- 4. Drop unused indexes
--
-- Note: This migration should be run during a maintenance window as it modifies
-- RLS policies which may briefly affect query performance during the update.

BEGIN;

-- ============================================================================
-- 1. ADD MISSING INDEX FOR FOREIGN KEY
-- ============================================================================

-- Add index on challenges.winner_id to optimize foreign key lookups
-- This index improves performance for queries filtering or joining on winner_id
CREATE INDEX IF NOT EXISTS idx_challenges_winner_id ON public.challenges(winner_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES WITH SUBQUERY PATTERN
-- ============================================================================
-- Replace auth.uid() with (select auth.uid()) to prevent per-row re-evaluation

-- ----------------------------------------------------------------------------
-- user_profiles table policies
-- ----------------------------------------------------------------------------

-- Drop and recreate "Users can view own profile"
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING ((select auth.uid()) = id);

-- Drop and recreate "Users can view friends profiles"
DROP POLICY IF EXISTS "Users can view friends profiles" ON public.user_profiles;
CREATE POLICY "Users can view friends profiles"
  ON public.user_profiles FOR SELECT
  USING (
    (select auth.uid()) IN (
      SELECT user_id FROM public.friends WHERE friend_user_id = public.user_profiles.id
    )
  );

-- "Anyone can view display names for leaderboard" doesn't use auth.uid(), so no change needed

-- Drop and recreate "Users can insert their own profile"
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

-- Drop and recreate "Users can update own profile" (keeping this one, removing duplicate)
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING ((select auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- game_stats table policies
-- ----------------------------------------------------------------------------

-- Drop and recreate "Users can view own and friends stats"
-- Optimized: single auth.uid() subquery evaluation per policy check
DROP POLICY IF EXISTS "Users can view own and friends stats" ON public.game_stats;
CREATE POLICY "Users can view own and friends stats"
  ON public.game_stats FOR SELECT
  USING (
    (select auth.uid()) = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.friends 
      WHERE public.friends.user_id = (select auth.uid())
      AND public.friends.friend_user_id = public.game_stats.user_id
    )
  );

-- "Anyone can view game stats for leaderboard" doesn't use auth.uid(), so no change needed

-- Drop and recreate "Users can insert own stats" (keeping this one, removing duplicate)
DROP POLICY IF EXISTS "Users can insert own stats" ON public.game_stats;
CREATE POLICY "Users can insert own stats"
  ON public.game_stats FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Drop and recreate "Users can update own stats" (keeping this one, removing duplicate)
DROP POLICY IF EXISTS "Users can update own stats" ON public.game_stats;
CREATE POLICY "Users can update own stats"
  ON public.game_stats FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- friends table policies
-- ----------------------------------------------------------------------------

-- Drop and recreate "Users can view their own friends"
DROP POLICY IF EXISTS "Users can view their own friends" ON public.friends;
CREATE POLICY "Users can view their own friends"
  ON public.friends FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Drop and recreate "Users can add friends"
DROP POLICY IF EXISTS "Users can add friends" ON public.friends;
CREATE POLICY "Users can add friends"
  ON public.friends FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Drop and recreate "Users can remove friends"
DROP POLICY IF EXISTS "Users can remove friends" ON public.friends;
CREATE POLICY "Users can remove friends"
  ON public.friends FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- challenges table policies
-- ----------------------------------------------------------------------------

-- Drop and recreate "Users can view challenges where they are challenger or challenged"
-- Optimized: single auth.uid() subquery evaluation
DROP POLICY IF EXISTS "Users can view challenges where they are challenger or challenged" ON public.challenges;
CREATE POLICY "Users can view challenges where they are challenger or challenged"
  ON public.challenges FOR SELECT
  USING (
    (select auth.uid()) IN (challenger_id, challenged_id)
  );

-- Drop and recreate "Users can create challenges where they are the challenger"
DROP POLICY IF EXISTS "Users can create challenges where they are the challenger" ON public.challenges;
CREATE POLICY "Users can create challenges where they are the challenger"
  ON public.challenges FOR INSERT
  WITH CHECK ((select auth.uid()) = challenger_id);

-- Drop and recreate "Users can delete challenges where they are challenger and status is pending"
DROP POLICY IF EXISTS "Users can delete challenges where they are challenger and status is pending" ON public.challenges;
CREATE POLICY "Users can delete challenges where they are challenger and status is pending"
  ON public.challenges FOR DELETE
  USING ((select auth.uid()) = challenger_id AND status = 'pending');

-- ----------------------------------------------------------------------------
-- friend_requests table policies
-- ----------------------------------------------------------------------------

-- Drop and recreate "Users can view their own sent and received requests"
-- Optimized: single auth.uid() subquery evaluation
DROP POLICY IF EXISTS "Users can view their own sent and received requests" ON public.friend_requests;
CREATE POLICY "Users can view their own sent and received requests"
  ON public.friend_requests FOR SELECT
  USING (
    (select auth.uid()) IN (from_user_id, to_user_id)
  );

-- Drop and recreate "Users can create friend requests"
DROP POLICY IF EXISTS "Users can create friend requests" ON public.friend_requests;
CREATE POLICY "Users can create friend requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK ((select auth.uid()) = from_user_id);

-- Drop and recreate "Users can update received requests"
DROP POLICY IF EXISTS "Users can update received requests" ON public.friend_requests;
CREATE POLICY "Users can update received requests"
  ON public.friend_requests FOR UPDATE
  USING ((select auth.uid()) = to_user_id);

-- Drop and recreate "Users can delete their own requests"
-- Optimized: single auth.uid() subquery evaluation
DROP POLICY IF EXISTS "Users can delete their own requests" ON public.friend_requests;
CREATE POLICY "Users can delete their own requests"
  ON public.friend_requests FOR DELETE
  USING (
    (select auth.uid()) IN (from_user_id, to_user_id)
  );

-- ============================================================================
-- 3. REMOVE DUPLICATE RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- challenges table - Remove old UPDATE policy, keep "Participants can update challenges"
-- ----------------------------------------------------------------------------

-- Drop the old policy that was replaced
DROP POLICY IF EXISTS "Users can update challenges where they are challenger (pending only) or challenged (accept/counter-offer)" ON public.challenges;

-- Update "Participants can update challenges" to use subquery pattern
-- Optimized: single auth.uid() subquery evaluation in both USING and WITH CHECK
DROP POLICY IF EXISTS "Participants can update challenges" ON public.challenges;
CREATE POLICY "Participants can update challenges"
  ON public.challenges FOR UPDATE
  USING ((select auth.uid()) IN (challenger_id, challenged_id))
  WITH CHECK ((select auth.uid()) IN (challenger_id, challenged_id));

-- Drop the duplicate "Participants can update pending or active challenges" if it still exists
DROP POLICY IF EXISTS "Participants can update pending or active challenges" ON public.challenges;

-- ----------------------------------------------------------------------------
-- game_stats table - Remove duplicate INSERT and UPDATE policies
-- ----------------------------------------------------------------------------

-- Drop duplicate "Users can insert their own stats" (keeping "Users can insert own stats")
DROP POLICY IF EXISTS "Users can insert their own stats" ON public.game_stats;

-- Drop duplicate "Users can update their own stats" (keeping "Users can update own stats")
DROP POLICY IF EXISTS "Users can update their own stats" ON public.game_stats;

-- ----------------------------------------------------------------------------
-- user_profiles table - Remove duplicate UPDATE policy
-- ----------------------------------------------------------------------------

-- Drop duplicate "Users can update their own profile" (keeping "Users can update own profile")
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- ============================================================================
-- 4. DROP UNUSED INDEXES
-- ============================================================================

-- Drop unused index on challenges.expires_at
-- Note: Verify this index is truly unused before dropping in production.
-- Consider using pg_stat_user_indexes to confirm zero usage before dropping.
DROP INDEX IF EXISTS public.idx_challenges_expires_at;

-- Drop unused index on friend_requests.status
-- Note: Verify this index is truly unused before dropping in production.
-- Consider using pg_stat_user_indexes to confirm zero usage before dropping.
DROP INDEX IF EXISTS public.idx_friend_requests_status;

COMMIT;
