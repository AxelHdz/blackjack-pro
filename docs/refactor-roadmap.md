# Refactor Roadmap

## High-Impact Refactors
- **Decouple game logic (pending):** `components/blackjack-game.tsx` (~1200 lines) still mixes gameplay engine, challenge lifecycle, persistence, and UI. Extract focused hooks (`useGameEngine`, `useChallenge`, existing `useStatsPersistence`), move deterministic logic (hand resolution, XP calc, payouts) into pure modules, and drive UI from a reducer/state machine to reduce churn and stale state.
- **Persistence (partial):** Autosave spam reduced to hand completion/mode/tier changes, and deck write-backs during `loadUserStats` were removed. Still need shoe seed/position storage instead of full deck blobs and single upserts per hand (skip balance writes during challenges).
- **Loading (pending):** `loadUserStats` still fans out and can write decks during reads. Fold challenge fetch into the same call, validate-only on decks, and avoid write-backs on load.

## Data Integrity & Backend
- **Transactional challenge flows (pending):** Creation/accept/counter/cancel in `app/api/challenges/route.ts` and `[id]/route.ts` should be atomic (RPC/transaction) to prevent orphaned debits.
- **Guard progress/complete (partial):** `app/api/challenges/[id]/progress` clamps non-negative credit/XP and enforces monotonicity; `/complete` clamps credits. Still need to derive winners/credits from authoritative data and server-enforce deltas.
- **Leaderboard/friends efficiency (partial):** Added cache headers to `/api/leaderboard` and `/api/me/friends`. Still consider PostgREST views, keyset pagination, indexes.

## Type Safety & Next Conventions
- TS errors fail builds; `skipLibCheck` remains on. Handler typings partly cleaned; proxy in place. Per-page auth checks still present. Supabase env validation added; consider tighter runtime guards.

## Dependencies & Tooling
- Versions pinned and ESLint added. Revisit `images.unoptimized: true` once remotePatterns are known; re-enable optimizer or document why.

## Testing & Observability
- Unit tests exist for core math; API contract tests and Playwright smoke (auth + hand) still missing. Add logging/telemetry gating to tame `console.log` in API routes.

## Auth & Routing
- Proxy (`proxy.ts` -> `lib/supabase/middleware.ts`) is active; central auth logic could replace per-page checks in app/auth pages and `app/page.tsx`.
