import { useEffect, useCallback, useRef } from "react"

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
  activeChallenge: any
}

async function persistStats({
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

  const payload = {
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
    lastDrillCompletedAt: lastDrillCompletedAt?.toISOString() || null,
    modeStats,
    learningMode,
    deck,
    activeChallenge: Boolean(activeChallenge),
  }

  await fetch("/api/me/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

/**
 * Persist stats when notable events happen (round completion, mode/tier metadata changes).
 */
export function useStatsPersistence({
  userId,
  activeChallenge,
  roundResult,
  statsLoaded,
  deps,
}: {
  userId: string
  activeChallenge: any
  roundResult: any
  statsLoaded: boolean
  deps: SaveDeps
}) {
  const lastSaveRef = useRef<{ signature: string; at: number } | null>(null)
  const inFlightRef = useRef(false)
  const scheduledRef = useRef<NodeJS.Timeout | null>(null)
  const latestPayloadRef = useRef<SaveUserStatsArgs | null>(null)
  const coolingRef = useRef(false)
  const hasHydratedRef = useRef(false)

  const getSignature = useCallback(() => {
    const lastDrill = deps.lastDrillCompletedAt?.toISOString() || "null"
    const deckSig = Array.isArray(deps.deck) ? deps.deck.length.toString() : "no-deck"
    return [
      deps.balance ?? "null",
      deps.totalWinnings,
      deps.levelWinnings,
      deps.level,
      deps.xp,
      deps.handsPlayed,
      deps.correctMoves,
      deps.totalMoves,
      deps.wins,
      deps.losses,
      deps.drillTier,
      lastDrill,
      deps.learningMode,
      deckSig,
      JSON.stringify(deps.modeStats),
      Boolean(activeChallenge),
    ].join("|")
  }, [deps.balance, deps.correctMoves, deps.deck, deps.drillTier, deps.handsPlayed, deps.lastDrillCompletedAt, deps.learningMode, deps.level, deps.levelWinnings, deps.losses, deps.modeStats, deps.totalMoves, deps.totalWinnings, deps.wins, deps.xp, activeChallenge])

  const save = useCallback(async () => {
    if (!statsLoaded || deps.balance === null) return
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true
      return
    }

    const signature = getSignature()
    const now = Date.now()
    const last = lastSaveRef.current
    if (last && last.signature === signature && now - last.at < 750) {
      return
    }
    // Debounce saves: schedule a single write with the latest payload
    latestPayloadRef.current = { ...deps, activeChallenge, userId }
    if (scheduledRef.current || coolingRef.current) return
    scheduledRef.current = setTimeout(async () => {
      scheduledRef.current = null
      const payload = latestPayloadRef.current
      if (!payload) return
      const finalSignature = getSignature()
      const nowTs = Date.now()
      const lastFinal = lastSaveRef.current
      if (lastFinal && lastFinal.signature === finalSignature && nowTs - lastFinal.at < 250) {
        return
      }
      if (inFlightRef.current) {
        return
      }
      inFlightRef.current = true
      try {
        await persistStats(payload)
        lastSaveRef.current = { signature: finalSignature, at: Date.now() }
        coolingRef.current = true
        setTimeout(() => {
          coolingRef.current = false
        }, 500)
        // Dispatch rank refresh event after stats are successfully saved at end of hand
        // Only refresh when roundResult exists (hand has finished)
        if (typeof window !== "undefined" && roundResult) {
          window.dispatchEvent(new CustomEvent("rank:refresh"))
        }
      } catch (err) {
        console.error("[v0] Error saving stats:", err)
      } finally {
        inFlightRef.current = false
      }
    }, 300)
  }, [deps, activeChallenge, userId, statsLoaded, getSignature])

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
