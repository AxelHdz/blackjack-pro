"use client"

import { Trophy } from "lucide-react"
import { useState, useEffect } from "react"
import { ChallengeChip } from "@/components/challenge-chip"
import { ChallengeModal } from "@/components/challenge-modal"
import { type Challenge } from "@/types/challenge"

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

  useEffect(() => {
    fetchRank()
    fetchChallenge()
    fetchUserBalance()
  }, [metric, scope, userId])

  const fetchRank = async () => {
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
  }

  const fetchChallenge = async () => {
    try {
      const response = await fetch("/api/challenges?status=pending,active,completed")
      const data = await response.json()
      if (!data.challenges || data.challenges.length === 0) {
        setChallenge(null)
        return
      }

      const list: Challenge[] = data.challenges
      const active = list.find((c) => c.status === "active")
      const awaiting = list.find((c) => c.status === "pending" && c.awaitingUserId === userId)
      const outgoing = list.find((c) => c.status === "pending" && c.challengerId === userId)
      const completed = list.find((c) => c.status === "completed")

      setChallenge(active || awaiting || outgoing || completed || null)
    } catch (error) {
      console.error("[v0] Failed to fetch challenge:", error)
      setChallenge(null)
    }
  }

  const fetchUserBalance = async () => {
    try {
      const response = await fetch("/api/me/profile")
      const data = await response.json()
      if (data.stats?.total_money !== undefined) {
        setUserBalance(data.stats.total_money)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch user balance:", error)
    }
  }

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
        />
      )}
    </div>
  )
}
