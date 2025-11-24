"use client"

import { Trophy } from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
import { ChallengeChip } from "@/components/challenge-chip"
import { ChallengeModal } from "@/components/challenge-modal"
import { type Challenge } from "@/types/challenge"
import { fetchCached } from "@/lib/fetch-cache"

// Module-level guard to prevent duplicate fetches in React Strict Mode
let hasInitialFetchRun = false

interface LeaderboardChipProps {
  onClick: () => void
  metric: "balance" | "level"
  scope: "global" | "friends"
  userId: string
}

export function LeaderboardChip({ onClick, metric, scope, userId }: LeaderboardChipProps) {
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [userBalance, setUserBalance] = useState<number | null>(null)
  const dismissedChallengeIdRef = useRef<string | null>(null)

  const dismissChallenge = (id: string | null) => {
    dismissedChallengeIdRef.current = id
  }

  const fetchRank = useCallback(async () => {
    try {
      setLoading(true)
      const url = `/api/me/rank?scope=${scope}&metric=${metric}`
      const res = await fetch(url, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error("[v0] Rank request failed:", { status: res.status, body: data })
        setRank(null)
        return
      }

      setRank(typeof data.rank === "number" ? data.rank : null)
    } catch (error) {
      console.error("[v0] Failed to fetch rank:", error)
      setRank(null)
    } finally {
      setLoading(false)
    }
  }, [metric, scope])

  const fetchChallenge = useCallback(async () => {
    try {
      const dismissedId = dismissedChallengeIdRef.current
      
      // Optimized: Fetch only what's needed in priority order
      // Priority 1: Active challenge (most important, always shown)
      const activeData = await fetchCached<{ challenge?: Challenge }>("/api/challenges/active")
      if (activeData.challenge && activeData.challenge.status === "active") {
        setChallenge(activeData.challenge)
        return
      }

      // Priority 2: Pending challenges (awaiting user response)
      // Use 15s TTL for challenge list queries (optimized from 3s)
      const pendingData = await fetchCached<{ challenges?: Challenge[] }>("/api/challenges?status=pending", undefined, 15000)
      if (pendingData.challenges && pendingData.challenges.length > 0) {
        const awaiting = pendingData.challenges.find((c) => c.awaitingUserId === userId)
        if (awaiting) {
          setChallenge(awaiting)
          return
        }
        const outgoing = pendingData.challenges.find((c) => c.challengerId === userId)
        if (outgoing) {
          setChallenge(outgoing)
          return
        }
      }

      // Priority 3: Completed challenge (only if not dismissed)
      const completedData = await fetchCached<{ challenges?: Challenge[] }>("/api/challenges?status=completed", undefined, 15000)
      if (completedData.challenges && completedData.challenges.length > 0) {
        const completed = completedData.challenges.find((c) => c.id !== dismissedId)
        if (completed) {
          setChallenge(completed)
          return
        }
      }

      // Priority 4: Cancelled challenge (only if not dismissed)
      const cancelledData = await fetchCached<{ challenges?: Challenge[] }>("/api/challenges?status=cancelled", undefined, 15000)
      if (cancelledData.challenges && cancelledData.challenges.length > 0) {
        const cancelled = cancelledData.challenges.find((c) => c.id !== dismissedId)
        if (cancelled) {
          setChallenge(cancelled)
          return
        }
      }

      // No challenge found
      setChallenge(null)
    } catch (error) {
      console.error("[v0] Failed to fetch challenge:", error)
      setChallenge(null)
    }
  }, [userId])

  const fetchUserBalance = useCallback(async () => {
    try {
      const data = await fetchCached<{ stats?: { total_money?: number } }>("/api/me/profile")
      if (data.stats?.total_money !== undefined) {
        setUserBalance(data.stats.total_money)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch user balance:", error)
    }
  }, [])

  // Initial fetch on mount only - with module-level guard to prevent duplicates in React Strict Mode
  useEffect(() => {
    if (hasInitialFetchRun) return
    hasInitialFetchRun = true
    
    void fetchRank()
    void fetchChallenge()
    void fetchUserBalance()
    
    return () => {}
  }, []) // Only run once on mount

  useEffect(() => {
    const handleChallengeProgress = (event: Event) => {
      const detail = (event as CustomEvent<Challenge | null>).detail
      if (!detail) return
      if (!challenge || detail.id === challenge.id) {
        setChallenge(detail)
      }
    }

    window.addEventListener("challenge:progress", handleChallengeProgress as EventListener)
    return () => window.removeEventListener("challenge:progress", handleChallengeProgress as EventListener)
  }, [challenge])

  useEffect(() => {
    const handleStatsUpdate = () => {
      void fetchUserBalance()
    }
    window.addEventListener("stats:update", handleStatsUpdate)
    return () => window.removeEventListener("stats:update", handleStatsUpdate)
  }, [fetchUserBalance])

  useEffect(() => {
    const handleRankRefresh = () => {
      void fetchRank()
    }
    window.addEventListener("rank:refresh", handleRankRefresh)
    return () => window.removeEventListener("rank:refresh", handleRankRefresh)
  }, [fetchRank])

  // Smart polling: only when page becomes visible (to detect new challenges)
  // Challenge updates are handled via the challenge:progress event system
  const fetchChallengeRef = useRef(fetchChallenge)
  const challengeRef = useRef(challenge)
  
  useEffect(() => {
    fetchChallengeRef.current = fetchChallenge
  }, [fetchChallenge])

  useEffect(() => {
    challengeRef.current = challenge
  }, [challenge])

  useEffect(() => {
    let isInitialMount = true

    const handleVisibilityChange = () => {
      // Skip the first visibility change (happens on mount)
      if (isInitialMount) {
        isInitialMount = false
        return
      }

      // Only poll when page becomes visible and we don't have a challenge
      // This detects new challenges if user was away
      if (document.visibilityState === "visible" && !challengeRef.current) {
        void fetchChallengeRef.current()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, []) // Only set up once, use refs for current values

  const handleChallengeChipClick = () => {
    if (challenge) {
      setShowChallengeModal(true)
      void fetchUserBalance()
    }
  }

  // Re-fetch rank when metric/scope toggles
  useEffect(() => {
    void fetchRank()
  }, [metric, scope, fetchRank])

  return (
    <div className="flex flex-col gap-2 items-center">
      <button
        onClick={onClick}
        aria-label={`Open leaderboard. Current rank ${rank || "unknown"} for ${metric}.`}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <Trophy
          className={`h-5 w-5 ${
            rank === 1
              ? "text-yellow-500"
              : rank === 2
                ? "text-gray-400"
                : rank === 3
                  ? "text-amber-800"
                  : "text-primary"
          }`}
        />
        <span className="text-sm font-medium text-foreground">Leaderboard · #{loading ? "..." : rank || "—"}</span>
      </button>
      {challenge && (
        <ChallengeChip challenge={challenge} onClick={handleChallengeChipClick} userId={userId} />
      )}
      {challenge && (
        <ChallengeModal
          open={showChallengeModal}
          onOpenChange={setShowChallengeModal}
          challenge={challenge}
          userId={userId}
          userBalance={userBalance ?? 0}
          onChallengeUpdated={() => {
            void fetchChallenge()
            void fetchUserBalance()
            setShowChallengeModal(false)
          }}
          onChallengeCreated={() => {
            void fetchChallenge()
            void fetchUserBalance()
          }}
          onChallengeEnded={() => {
            // Hide completed challenge after user ends it
            if (challenge?.status === "completed" && challenge?.id) {
              dismissChallenge(challenge.id)
              setChallenge(null)
            }
            void fetchChallenge()
            void fetchUserBalance()
            setShowChallengeModal(false)
          }}
        />
      )}
    </div>
  )
}
