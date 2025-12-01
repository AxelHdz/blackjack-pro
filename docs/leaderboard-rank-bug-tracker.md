# Leaderboard Rank Bugs

Track fixes in the order listed. Check items off as they are resolved and note any related cleanup or simplifications made along the way.

- [x] **Missing profiles counted in rank** — `/api/me/rank` counts all `game_stats` rows while the leaderboard list inner-joins `user_profiles`, so users without profiles skew the chip’s rank.
  - Cleanup/optimization notes: Leaderboard API uses an inner join again (excludes missing profiles) and the rank function now ignores stats rows without a profile, keeping chip rank and list aligned. Apply the updated migration to update the DB function.
- [x] **Initial save skipped, rank refreshes stale stats** — `useStatsPersistence` ignores the first save while `handleRoundResolution` dispatches `rank:refresh`, so the chip can stay one round behind.
  - Cleanup/optimization notes: Removed the hydration skip so the first post-round save writes immediately; dispatch a post-save `rank:refresh` event to ensure the chip re-fetches after the DB is updated; removed the redundant pre-save `rank:refresh` from `handleRoundResolution`.
- [x] **Race between metric/scope changes** — `fetchRank` sets state without validating the request scope/metric, so slower responses can overwrite the latest selection.
  - Cleanup/optimization notes: Added request tokens to guard stale responses/loader state, and a visible loading spinner in the chip when metric/scope toggles.
- [x] **Duplicate `game_stats` rows double-count** — no uniqueness on `user_id` but rank uses `COUNT(*)`, so duplicate rows inflate rank positions.
  - Cleanup/optimization notes: Added a unique constraint on `game_stats.user_id`, updated the rank function to count distinct users with profiles, and added a duplicate-guard in `/api/me/rank` that returns an error if multiple rows exist for the current user. Apply migration `20241203000003_enforce_unique_game_stats_user.sql`.

## Working approach
- Fix in listed order so the chip and modal stay in sync as dependencies change.
- For each bug: confirm root cause, make the smallest fix that aligns rank and list behavior, and remove redundant/complex code uncovered along the way.
- Keep chip and leaderboard API logic consistent (scope, metric, joins, tie-breakers) and avoid client-side race conditions.
- After each fix, update this tracker with what changed and any cleanup/optimization performed.

## Next steps / organization
- Shared rank hook added (`hooks/use-rank.ts`) and used by the chip; extend to the modal if it ever needs to display the user’s rank.
- See docs/leaderboard.md for end-to-end flow, data rules, events, and testing.
