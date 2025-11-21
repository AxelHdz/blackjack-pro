# Challenge Query Optimization Analysis

## Current Query Patterns

### High-Frequency Queries (from performance data)
- `/api/challenges` with OR conditions: **30,329 calls** (0.08ms mean)
- `/api/challenges` with status filter: **8,000 calls** (0.22ms mean)
- `/api/challenges/active`: Estimated **~15,000+ calls** (based on component analysis)

## Redundant Query Patterns Identified

### 1. Multiple Components Fetching Active Challenge

**Problem**: Three different components/hooks independently fetch `/api/challenges/active`:

1. **`blackjack-game.tsx`** (line 349, 403, 684)
   - Fetches on mount (via `loadUserStats`)
   - Fetches on visibility change (when no active challenge)
   - Fetches after challenge completion

2. **`use-challenge-lifecycle.ts`** (line 100, 120)
   - Fetches on visibility change
   - Provides `fetchActiveChallenge` function

3. **`challenge-chip.tsx`** (line 28)
   - Fetches when challenge is active (but comment says "No polling needed")
   - Actually does fetch on timer expiration

**Impact**: Same endpoint called 3+ times per user interaction, even with 3s cache TTL

### 2. Leaderboard Chip Fetches All Challenges

**Problem**: `leaderboard-chip.tsx` (line 48) fetches:
```typescript
`/api/challenges?status=${encodeURIComponent("pending,active,completed,cancelled")}`
```

This fetches **ALL** challenges when it only needs:
- One active challenge (if exists)
- One pending challenge awaiting user (if exists)
- One completed challenge (if not dismissed)

**Impact**: Unnecessary data transfer and query complexity. The query returns all challenges and filters client-side.

### 3. Duplicate Visibility Change Handlers

**Problem**: Both `blackjack-game.tsx` and `use-challenge-lifecycle.ts` set up visibility change listeners that fetch the same endpoint.

**Impact**: Redundant event listeners and potential duplicate fetches

### 4. Challenge Completion Polling

**Problem**: `blackjack-game.tsx` (line 507) polls challenge completion every 30 seconds:
```typescript
const interval = setInterval(checkChallengeCompletion, 30000)
```

This could be optimized to:
- Only poll when challenge is close to expiring
- Use server-sent events or websockets
- Reduce frequency when challenge has more time remaining

## Optimization Recommendations

### Priority 1: Consolidate Challenge Fetching

**Solution**: Create a single challenge context/provider that:
- Fetches active challenge once
- Shares data across all components via React Context
- Uses event system for updates (already partially implemented)
- Eliminates duplicate visibility change handlers

**Expected Impact**: Reduce `/api/challenges/active` calls by ~60-70%

### Priority 2: Optimize Leaderboard Chip Query

**Solution**: Change leaderboard chip to:
- Fetch only active challenge first: `/api/challenges/active`
- If no active, fetch pending challenges: `/api/challenges?status=pending`
- If no pending, fetch completed (with limit 1): `/api/challenges?status=completed&limit=1`

**Expected Impact**: Reduce query complexity and data transfer by ~80%

### Priority 3: Reduce Polling Frequency

**Solution**: 
- Increase challenge completion check interval from 30s to 60s
- Only poll when challenge expires within 5 minutes
- Use exponential backoff when challenge has >10 minutes remaining

**Expected Impact**: Reduce polling queries by ~50%

### Priority 4: Implement Better Caching Strategy

**Current**: `fetchCached` has 3s TTL (good for deduplication)

**Improvement**:
- Increase TTL for active challenge to 5-10s (challenge state changes infrequently)
- Use stale-while-revalidate pattern
- Cache challenge list queries longer (10-15s) since they're less time-sensitive

**Expected Impact**: Reduce redundant queries by ~30%

### Priority 5: Use Event System More Aggressively

**Current**: Event system exists (`challenge:progress`) but not all components use it

**Improvement**:
- All challenge updates should emit events
- Components should subscribe to events instead of polling
- Only poll when no event received in X seconds (fallback)

**Expected Impact**: Reduce polling queries by ~40%

## Estimated Total Impact

If all optimizations are implemented:
- **Current**: ~53,000 challenge queries
- **Optimized**: ~15,000-20,000 challenge queries
- **Reduction**: ~60-70% fewer queries

## Implementation Priority

1. **High Impact, Low Effort**: Optimize leaderboard chip query (Priority 2)
2. **High Impact, Medium Effort**: Consolidate challenge fetching (Priority 1)
3. **Medium Impact, Low Effort**: Reduce polling frequency (Priority 3)
4. **Medium Impact, Medium Effort**: Better caching (Priority 4)
5. **High Impact, High Effort**: Event-driven architecture (Priority 5)

