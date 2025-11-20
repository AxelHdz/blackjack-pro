"use client"

import { Trophy } from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
import { ChallengeChip } from "@/components/challenge-chip"
import { ChallengeModal } from "@/components/challenge-modal"
import { type Challenge } from "@/types/challenge"

// Module-level guard to prevent duplicate fetches in React Strict Mode
let isInitialFetchInProgress = false

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
  const [userBalance, setUserBalance] = useState<number>(0)
  const dismissedChallengeIdRef = useRef<string | null>(null)

  const dismissChallenge = (id: string | null) => {
    dismissedChallengeIdRef.current = id
  }

  const fetchRank = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/me/rank?scope=${scope}&metric=${metric}`)
      const data = await response.json()
      setRank(data.rank)
    } catch (error) {
      console.error("[v0] Failed to fetch rank:", error)
      setRank(null)
    } finally {
      setLoading(false)
    }
  }, [metric, scope])

  const fetchChallenge = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/challenges?status=${encodeURIComponent("pending,active,completed,cancelled")}`,
      )
      const data = await response.json()
      if (!data.challenges || data.challenges.length === 0) {
        setChallenge(null)
        return
      }

      const list: Challenge[] = data.challenges
      const dismissedId = dismissedChallengeIdRef.current
      // Prioritize: active > completed (not dismissed) > pending (awaiting) > pending (outgoing) > cancelled
      const active = list.find((c) => c.status === "active")
      const completed = list.find((c) => c.status === "completed" && c.id !== dismissedId)
      const awaiting = list.find((c) => c.status === "pending" && c.awaitingUserId === userId)
      const outgoing = list.find((c) => c.status === "pending" && c.challengerId === userId)
      const cancelled = list.find((c) => c.status === "cancelled" && c.id !== dismissedId)

      setChallenge(active || completed || awaiting || outgoing || cancelled || null)
    } catch (error) {
      console.error("[v0] Failed to fetch challenge:", error)
      setChallenge(null)
    }
  }, [userId])

  const fetchUserBalance = useCallback(async () => {
    try {
      const response = await fetch("/api/me/profile")
      const data = await response.json()
      if (data.stats?.total_money !== undefined) {
        setUserBalance(data.stats.total_money)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch user balance:", error)
    }
  }, [])

  // Initial fetch on mount only - with module-level guard to prevent duplicates in React Strict Mode
  useEffect(() => {
    if (isInitialFetchInProgress) return
    isInitialFetchInProgress = true
    
    // Reset guard after a short delay to allow for legitimate re-fetches
    const timeoutId = setTimeout(() => {
      isInitialFetchInProgress = false
    }, 1000)
    
    void fetchRank()
    void fetchChallenge()
    void fetchUserBalance()
    
    return () => {
      clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          userBalance={userBalance}
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
