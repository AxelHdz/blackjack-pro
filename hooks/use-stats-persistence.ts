import { useEffect, useMemo, useCallback } from "react"

type SaveDeps = {
  balance: number | null
  totalWinnings: number
  levelWinnings: number
  level: number
  xp: number
  handsPlayed: number
  correctMoves: number
  totalMoves: number
  wins: number
  losses: number
  drillTier: number
  lastDrillCompletedAt: Date | null
  modeStats: any
  learningMode: string
  deck: any
  userId: string
  activeChallenge: any
}

type SaveUserStatsArgs = SaveDeps & {
  supabase: any
}

async function persistStats({
  supabase,
  userId,
  activeChallenge,
  balance,
  totalWinnings,
  levelWinnings,
  level,
  xp,
  handsPlayed,
  correctMoves,
  totalMoves,
  wins,
  losses,
  drillTier,
  lastDrillCompletedAt,
  modeStats,
  learningMode,
  deck,
}: SaveUserStatsArgs) {
  if (balance === null) return

  const moneyFields = activeChallenge
    ? {}
    : {
        total_money: Math.floor(balance),
        total_winnings: Math.floor(totalWinnings),
        level_winnings: Math.floor(levelWinnings),
      }

  await supabase
    .from("game_stats")
    .update({
      level: Math.floor(level),
      experience: Math.floor(xp),
      hands_played: Math.floor(handsPlayed),
      correct_moves: Math.floor(correctMoves),
      total_moves: Math.floor(totalMoves),
      wins: Math.floor(wins),
      losses: Math.floor(losses),
      drill_tier: Math.floor(drillTier),
      last_drill_completed_at: lastDrillCompletedAt?.toISOString() || null,
      learning_hands_played: Math.floor(modeStats.guided.handsPlayed),
      learning_correct_moves: Math.floor(modeStats.guided.correctMoves),
      learning_total_moves: Math.floor(modeStats.guided.totalMoves),
      learning_wins: Math.floor(modeStats.guided.wins),
      learning_losses: Math.floor(modeStats.guided.losses),
      practice_hands_played: Math.floor(modeStats.practice.handsPlayed),
      practice_correct_moves: Math.floor(modeStats.practice.correctMoves),
      practice_total_moves: Math.floor(modeStats.practice.totalMoves),
      practice_wins: Math.floor(modeStats.practice.wins),
      practice_losses: Math.floor(modeStats.practice.losses),
      expert_hands_played: Math.floor(modeStats.expert.handsPlayed),
      expert_correct_moves: Math.floor(modeStats.expert.correctMoves),
      expert_total_moves: Math.floor(modeStats.expert.totalMoves),
      expert_wins: Math.floor(modeStats.expert.wins),
      expert_losses: Math.floor(modeStats.expert.losses),
      last_play_mode: learningMode,
      deck: deck,
      updated_at: new Date().toISOString(),
      ...moneyFields,
    })
    .eq("user_id", userId)
}

/**
 * Persist stats when notable events happen (round completion, mode/tier metadata changes).
 */
export function useStatsPersistence({
  supabase,
  userId,
  activeChallenge,
  roundResult,
  statsLoaded,
  deps,
}: {
  supabase: any
  userId: string
  activeChallenge: any
  roundResult: any
  statsLoaded: boolean
  deps: SaveDeps
}) {
  const save = useCallback(async () => {
    try {
      await persistStats({ ...deps, supabase, activeChallenge, userId })
    } catch (err) {
      console.error("[v0] Error saving stats:", err)
    }
  }, [deps, supabase, activeChallenge, userId])

  // Save snapshots after a round finishes
  useEffect(() => {
    if (!statsLoaded || deps.balance === null) return
    if (!roundResult) return
    void save()
  }, [roundResult, statsLoaded, deps.balance, save])

  // Persist when learning mode or drill tier metadata changes (less frequent than per-state churn)
  useEffect(() => {
    if (!statsLoaded || deps.balance === null) return
    void save()
  }, [deps.learningMode, deps.drillTier, deps.lastDrillCompletedAt, statsLoaded, deps.balance, save])

  return { saveUserStats: save }
}
