# Database Review Summary - 2025

This document summarizes the database review conducted via Supabase and the documentation updates made.

## Review Date
December 2025

## Schema Updates Made

### 1. SCHEMA_REFERENCE.sql Updates

#### Added Missing Columns

**game_stats table:**
- `completed_challenges` (INTEGER, default: 0) - Total number of completed challenges
- `won_challenges` (INTEGER, default: 0) - Total number of challenge wins
- `lost_challenges` (INTEGER, default: 0) - Total number of challenge losses
- `tied_challenges` (INTEGER, default: 0) - Total number of challenge ties
- Added `UNIQUE(user_id)` constraint (already exists in database)

**challenges table:**
- `challenger_balance_paused` (INTEGER) - Snapshot of challenger's real balance while challenge credits are active
- `challenged_balance_paused` (INTEGER) - Snapshot of challenged player's real balance while challenge credits are active
- `challenger_credit_balance` (INTEGER) - Current challenge credit balance for the challenger
- `challenged_credit_balance` (INTEGER) - Current challenge credit balance for the challenged player
- `challenger_credit_experience` (INTEGER, default: 0) - Accumulated challenge XP (doubled) awaiting payout for the challenger
- `challenged_credit_experience` (INTEGER, default: 0) - Accumulated challenge XP (doubled) awaiting payout for the challenged player
- `challenger_archive_status` (BOOLEAN, default: FALSE) - Whether the challenger has archived this challenge from their view
- `challenged_archive_status` (BOOLEAN, default: FALSE) - Whether the challenged player has archived this challenge from their view

#### Updated Constraints

**challenges.status:**
- Updated CHECK constraint to include 'archived' status: `CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'archived'))`

#### Added Missing Indexes

**game_stats:**
- `idx_game_stats_balance_ranking` - Composite index for balance-based leaderboard queries
- `idx_game_stats_level_ranking` - Composite index for level-based leaderboard queries

**challenges:**
- `idx_challenges_status_created` - Composite index for status and created_at queries
- `idx_challenges_winner_id` - Index for winner lookups
- `idx_challenges_challenger_status_created` - Composite index for challenger queries
- `idx_challenges_challenged_status_created` - Composite index for challenged queries
- `idx_challenges_challenger_not_archived` - Partial index for non-archived challenger challenges
- `idx_challenges_challenged_not_archived` - Partial index for non-archived challenged challenges

#### Added Missing Functions

1. **auto_archive_user_challenges()**
   - Automatically archives previous challenges when a new challenge is created
   - Trigger function for challenge management

2. **calculate_level_from_wins(wins_count integer)**
   - Calculates level and XP from a given number of wins
   - Returns: `(calculated_level integer, calculated_xp integer)`
   - Used for leveling calculations and testing

3. **calculate_user_rank(p_user_id, p_scope, p_metric, p_friend_ids)**
   - Calculates a user's rank based on scope (global/friends) and metric (balance/level)
   - Used by the leaderboard system
   - Returns: `integer` (rank position)

#### Added Missing Triggers

- **trigger_auto_archive_challenges** - Automatically archives old challenges when a new challenge is created
  - Triggered: AFTER INSERT ON challenges
  - Function: auto_archive_user_challenges()

#### Updated Function Definitions

**handle_new_user():**
- Removed `SET search_path = public` (not present in actual database)
- Removed game_stats insertion (not present in actual database - stats are created separately)

## Database Advisors Findings

### Security Advisors

1. **Function Search Path Mutable (WARN)**
   - Functions affected:
     - `calculate_level_from_wins`
     - `calculate_user_rank`
     - `handle_new_user`
   - Recommendation: Set `SET search_path = 'public'` in function definitions to prevent search path manipulation attacks
   - Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

2. **Leaked Password Protection Disabled (WARN)**
   - Supabase Auth leaked password protection is currently disabled
   - Recommendation: Enable HaveIBeenPwned.org password checking
   - Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Performance Advisors

1. **Unused Indexes (INFO)**
   - Several challenge-related indexes have not been used:
     - `idx_challenges_winner_id`
     - `idx_challenges_challenged_status_created`
     - `idx_challenges_status_created`
     - `idx_challenges_challenger_not_archived`
     - `idx_challenges_challenged_not_archived`
     - `idx_challenges_challenger_status_created`
   - Note: These may be used in the future as the challenge feature grows

2. **Multiple Permissive Policies (WARN)**
   - Tables with multiple permissive SELECT policies:
     - `game_stats` - Has "Anyone can view game stats for leaderboard" and "Users can view own and friends stats"
     - `user_profiles` - Has three SELECT policies
   - Recommendation: Consider consolidating policies for better performance
   - Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

3. **Duplicate Index (WARN)**
   - `game_stats` table has duplicate indexes:
     - `game_stats_pkey` and `game_stats_user_unique` are identical
   - Recommendation: Drop one of the duplicate indexes
   - Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index

## Documentation Status

### Updated Files
- ✅ `scripts/SCHEMA_REFERENCE.sql` - Fully updated with all current schema elements

### Verified Files
- ✅ `docs/CHALLENGE_FEATURE.md` - Accurate and up-to-date
- ✅ `docs/leaderboard.md` - Accurate and up-to-date

### Current Database State

**Tables (5):**
1. `user_profiles` - User profile information
2. `game_stats` - Game statistics and player progress
3. `friends` - Bidirectional friendship relationships
4. `friend_requests` - Friend request system
5. `challenges` - User-to-user challenge system

**Functions (5):**
1. `handle_new_user()` - Auto-creates profile on signup
2. `create_bidirectional_friendship()` - Creates bidirectional friendships
3. `auto_archive_user_challenges()` - Archives old challenges
4. `calculate_level_from_wins()` - Calculates level from wins
5. `calculate_user_rank()` - Calculates user rank for leaderboard

**Triggers (2):**
1. `on_auth_user_created` - Creates profile on user signup
2. `trigger_auto_archive_challenges` - Archives old challenges on new challenge creation

## Recommendations

### High Priority
1. **Fix Function Search Path Security** - Add `SET search_path = 'public'` to all functions
2. **Remove Duplicate Index** - Drop `game_stats_user_unique` (keep `game_stats_pkey`)

### Medium Priority
1. **Consolidate RLS Policies** - Merge multiple permissive policies where possible
2. **Enable Leaked Password Protection** - Enable in Supabase Auth settings

### Low Priority
1. **Monitor Unused Indexes** - Keep indexes that may be used in future, remove if confirmed unused after feature maturity

## Notes

- All documentation now accurately reflects the current database schema
- The challenge feature is fully documented with all credit balance and archive status fields
- Leaderboard system documentation is accurate with rank calculation function details
- Database advisors provide helpful insights but most findings are warnings/info, not critical issues

