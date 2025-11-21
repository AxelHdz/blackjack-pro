# Refactor Roadmap

## High-Impact Refactors
- **Decouple game logic (pending):** `components/blackjack-game.tsx` (~1200 lines) still owns engine, challenge lifecycle, persistence, and UI. `useGameEngine`/`useChallengeLifecycle` exist but are unused; deterministic flows (dealing/settlement, XP calc, challenge balance sync) live inline. Extract a reducer-driven engine, a focused challenge hook, and pure helpers to cut state churn/stale refs.
- **Persistence (partial):** `useStatsPersistence` now fires on round completion and mode/tier changes, but each call writes the entire stats row plus the deck blob from the client (challenge mode skips money only). Move to seed+position storage, single upserts per hand with backoff, and a server/API boundary so the client stops issuing Supabase updates.
- **Loading (pending):** `loadUserStats` still reads/writes Supabase directly from the client and inserts missing rows; challenge context fetches separately. Fold stats + active challenge into one server/API load (read-only), seed decks server-side, and remove client fan-out.

## Data Integrity & Backend
- **Transactional challenge flows (pending):** Create/accept/counter/cancel/forfeit/complete do multiple balance updates and challenge mutations without transactions or locking; service-role writes are not atomic. Move to RPC/transactional routines that reserve wagers, transition status, and settle balances/XP in one commit with concurrency guards.
- **Guard progress/complete (partial):** Progress clamps non-negative credit/XP but still trusts client-supplied `creditBalance`/`xpDelta`, and winners are derived from those stored values at completion. Derive credits/XP deltas server-side (from hands/logs), enforce expiry windows, and reject regressions/tampering.
- **Leaderboard/friends efficiency (partial):** Cache headers exist and `LeaderboardChip` now prioritizes active/pending/completed queries with fetch caching. Still need DB-side pagination (keyset/views) and indexes to avoid full scans and OR chains in `/api/challenges` and leaderboard/friends queries.

## Type Safety & Next Conventions
- TS errors fail builds but `skipLibCheck` stays on. Supabase clients are typed `any` and request bodies lack runtime validation. Add typed Supabase helpers, zod validation for API inputs, and align handlers with Next types to remove `any`/`as` casts.

## Dependencies & Tooling
- Versions pinned and ESLint configured. `images.unoptimized: true` remains; re-enable the optimizer (or document why) once `remotePatterns` are defined.

## Testing & Observability
- Unit tests cover strategy/settlement/card utils only; challenge flows, persistence, and UI/route contracts remain untested. Add API contract tests and Playwright smoke (auth + hand/challenge) plus coverage for XP/payout edge cases. Console logging in API routes is still noisy - add structured logging with level gating.

## Auth & Routing
- Proxy (`proxy.ts` -> `lib/supabase/middleware.ts`) is active, but auth checks still duplicate in client pages/components. Centralize auth state (server + middleware) and remove per-page Supabase calls where possible.
