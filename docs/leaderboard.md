# Leaderboard & Rank

This page explains how the leaderboard chip/modal, APIs, and database function stay consistent, plus how to test and extend the feature.

## Data rules
- Scope: `global` (everyone) or `friends` (user + friends).
- Metric: `balance` (total_money desc, level desc, user_id asc) or `level` (level desc, total_money desc, user_id asc).
- Profiles required: leaderboard entries and rank calculations exclude users without a `user_profiles` row.
- Uniqueness: one `game_stats` row per user (constraint on `game_stats.user_id`).
- Tie-breakers: align list and rank by ordering on user_id ascending after metric fields.

## Components & events
- `components/leaderboard-chip.tsx`: shows current rank, opens modal, listens for `rank:refresh`.
- `components/leaderboard-modal.tsx`: lists entries, paginates, listens for `rank:refresh` / `stats:update`.
- Event contract:
  - `rank:refresh`: refetch rank/list.
  - `stats:update`: fired after a round resolution; modal refetches.
- Challenge chips/modals are adjacent but independent of rank; they share no events with rank beyond UI proximity.

## APIs
- `GET /api/me/rank`: uses `calculate_user_rank` with scope/metric; guards duplicate `game_stats` rows and requires a profile.
- `GET /api/leaderboard`: applies scope filter, metric ordering + user_id tie-breaker, inner join on profiles, pagination.

## Database
- Rank function: `scripts/migrations/20241203000003_enforce_unique_game_stats_user.sql` defines `calculate_user_rank` counting distinct users with profiles and respecting scope/metric ordering.
- Constraint: unique `game_stats.user_id` enforced in the same migration.

## Testing checklist
- Load: single rank request per metric/scope; loading state appears once.
- Toggle metric/scope: rank updates with spinner; no stale values when toggling quickly.
- Friends scope: includes self + friends only; excludes users without profiles.
- Tie-breakers: equal metric values sort by user_id asc; chip rank matches modal position.
- Duplicates: API returns error if duplicate stats exist; DB constraint prevents new ones.

## Rank hook / service
- `hooks/use-rank.ts` centralizes rank fetching/de-dupe, listens for `rank:refresh`, and is reused by `leaderboard-chip` (and can be used elsewhere to avoid duplicate requests).

## Future cleanup
- If the modal ever needs the current user’s rank, consume `use-rank` there too to keep a single source of truth.
