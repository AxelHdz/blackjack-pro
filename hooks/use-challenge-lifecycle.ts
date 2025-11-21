import { useCallback, useEffect, useRef, useState } from "react"
import { type Challenge } from "@/types/challenge"
import { useChallenge } from "@/contexts/challenge-context"

type UseChallengeOptions = {
  userId: string
  applyChallengeContext: (challenge: Challenge | null) => void
  enterChallengeExpertMode: () => void
  restoreLearningMode: () => void
}

export function useChallengeLifecycle({
  userId,
  applyChallengeContext,
  enterChallengeExpertMode,
  restoreLearningMode,
}: UseChallengeOptions) {
  // Get active challenge from context (eliminates redundant fetches)
  const { activeChallenge: contextActiveChallenge, refreshActiveChallenge } = useChallenge()
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [pendingChallengeXp, setPendingChallengeXp] = useState(0)
  const [lastSyncedChallengeCredit, setLastSyncedChallengeCredit] = useState<number | null>(null)
  const activeChallengeRef = useRef<Challenge | null>(null)
  const applyChallengeContextRef = useRef(applyChallengeContext)
  const enterChallengeExpertModeRef = useRef(enterChallengeExpertMode)

  // Sync local state with context
  useEffect(() => {
    if (contextActiveChallenge) {
      setActiveChallenge(contextActiveChallenge)
    } else {
      setActiveChallenge(null)
    }
  }, [contextActiveChallenge])

  useEffect(() => {
    applyChallengeContextRef.current = applyChallengeContext
  }, [applyChallengeContext])

  useEffect(() => {
    enterChallengeExpertModeRef.current = enterChallengeExpertMode
  }, [enterChallengeExpertMode])

  useEffect(() => {
    activeChallengeRef.current = activeChallenge
  }, [activeChallenge])

  const applyChallengeContextWrapped = useCallback(
    (challengeData: Challenge | null) => {
      setActiveChallenge(challengeData)
      applyChallengeContext(challengeData)
      if (challengeData) {
        setPendingChallengeXp(0)
        const playerCredit =
          challengeData.challengerId === userId
            ? challengeData.challengerCreditBalance
            : challengeData.challengedCreditBalance
        const resolvedCredit =
          playerCredit !== null && playerCredit !== undefined
            ? playerCredit
            : lastSyncedChallengeCredit !== null
              ? lastSyncedChallengeCredit
              : null
        if (resolvedCredit !== null) setLastSyncedChallengeCredit(resolvedCredit)
      } else {
        setPendingChallengeXp(0)
        setLastSyncedChallengeCredit(null)
        restoreLearningMode()
      }
    },
    [applyChallengeContext, restoreLearningMode, userId, lastSyncedChallengeCredit],
  )

  const updateActiveChallengeState = useCallback(
    (challengeData: Challenge) => {
      if (challengeData.status !== "active") {
        applyChallengeContextWrapped(null)
        return
      }

      const incomingUpdatedAt = challengeData.updatedAt ? new Date(challengeData.updatedAt).getTime() : 0
      const currentUpdatedAt = activeChallengeRef.current?.updatedAt
        ? new Date(activeChallengeRef.current.updatedAt).getTime()
        : 0

      if (currentUpdatedAt && incomingUpdatedAt && incomingUpdatedAt < currentUpdatedAt) {
        return
      }

      setActiveChallenge(challengeData)
      const playerCredit =
        challengeData.challengerId === userId
          ? challengeData.challengerCreditBalance
          : challengeData.challengedCreditBalance

      if (typeof playerCredit === "number") {
        setLastSyncedChallengeCredit(playerCredit)
      } else if (lastSyncedChallengeCredit !== null) {
        setLastSyncedChallengeCredit(lastSyncedChallengeCredit)
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("challenge:progress", { detail: challengeData }))
      }
    },
    [applyChallengeContextWrapped, lastSyncedChallengeCredit, userId],
  )

  const fetchActiveChallenge = useCallback(async () => {
    // Use context refresh instead of direct fetch
    try {
      await refreshActiveChallenge()
      // Context will update via event system, sync will happen via useEffect above
    } catch (error) {
      console.error("[v0] Failed to refresh active challenge:", error)
    }
  }, [refreshActiveChallenge])

  // Visibility change handler removed - consolidated in blackjack-game.tsx
  // Components should listen to 'challenge:progress' events instead of polling

  return {
    activeChallenge,
    pendingChallengeXp,
    setPendingChallengeXp,
    lastSyncedChallengeCredit,
    setLastSyncedChallengeCredit,
    fetchActiveChallenge,
    applyChallengeContextWrapped,
    updateActiveChallengeState,
    activeChallengeRef,
  }
}
