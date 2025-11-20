import { useCallback, useEffect, useRef, useState } from "react"
import { fetchCached } from "@/lib/fetch-cache"
import { type Challenge } from "@/types/challenge"

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
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [pendingChallengeXp, setPendingChallengeXp] = useState(0)
  const [lastSyncedChallengeCredit, setLastSyncedChallengeCredit] = useState<number | null>(null)
  const activeChallengeRef = useRef<Challenge | null>(null)
  const applyChallengeContextRef = useRef(applyChallengeContext)
  const enterChallengeExpertModeRef = useRef(enterChallengeExpertMode)

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
    try {
      const data = await fetchCached<{ challenge?: Challenge }>("/api/challenges/active")
      if (data.challenge && data.challenge.status === "active") {
        applyChallengeContextWrapped(data.challenge)
        enterChallengeExpertMode()
      } else {
        applyChallengeContextWrapped(null)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch active challenge:", error)
    }
  }, [applyChallengeContextWrapped, enterChallengeExpertMode])

  useEffect(() => {
    let isInitialMount = true
    const handleVisibilityChange = () => {
      if (isInitialMount) {
        isInitialMount = false
        return
      }
      if (document.visibilityState === "visible" && !activeChallengeRef.current) {
        void fetchCached<{ challenge?: Challenge }>("/api/challenges/active")
          .then((data) => {
            if (data.challenge?.status === "active") {
              applyChallengeContextRef.current(data.challenge)
              enterChallengeExpertModeRef.current()
            }
          })
          .catch((err) => console.error("[v0] Failed to fetch challenge on visibility:", err))
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

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
