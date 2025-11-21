-- 20241202002_add_challenges_composite_indexes.sql
-- Add composite indexes to optimize challenges table queries
-- 
-- Optimizes queries with patterns:
-- 1. (challenger_id = X OR challenged_id = X) AND status = Y ORDER BY created_at DESC
-- 2. Queries filtering by archive status with status and ordering
-- 3. Status-filtered queries with ordering

BEGIN;

-- ============================================================================
-- COMPOSITE INDEXES FOR CHALLENGES QUERIES
-- ============================================================================

-- Index for challenger queries with status filter and ordering
-- Optimizes: challenger_id = X AND status = Y ORDER BY created_at DESC
-- Also helps with archive status filters when combined with challenger_id
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_status_created 
  ON public.challenges(challenger_id, status, created_at DESC);

-- Index for challenged queries with status filter and ordering
-- Optimizes: challenged_id = X AND status = Y ORDER BY created_at DESC
-- Also helps with archive status filters when combined with challenged_id
CREATE INDEX IF NOT EXISTS idx_challenges_challenged_status_created 
  ON public.challenges(challenged_id, status, created_at DESC);

-- Index for status-filtered queries with ordering
-- Optimizes: status = Y ORDER BY created_at DESC
-- Useful for queries that filter by status without user_id filters
CREATE INDEX IF NOT EXISTS idx_challenges_status_created 
  ON public.challenges(status, created_at DESC);

-- ============================================================================
-- PARTIAL INDEXES FOR NON-ARCHIVED CHALLENGES
-- ============================================================================

-- Partial index for non-archived challenger queries
-- Optimizes queries filtering by challenger_id where challenger_archive_status = false
-- This is a common pattern in the application
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_not_archived 
  ON public.challenges(challenger_id, status, created_at DESC)
  WHERE challenger_archive_status IS FALSE OR challenger_archive_status IS NULL;

-- Partial index for non-archived challenged queries
-- Optimizes queries filtering by challenged_id where challenged_archive_status = false
-- This is a common pattern in the application
CREATE INDEX IF NOT EXISTS idx_challenges_challenged_not_archived 
  ON public.challenges(challenged_id, status, created_at DESC)
  WHERE challenged_archive_status IS FALSE OR challenged_archive_status IS NULL;

COMMIT;

