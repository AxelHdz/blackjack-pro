"use client"

import { Trophy } from "lucide-react"
import { useState, useEffect } from "react"

interface LeaderboardChipProps {
  onClick: () => void
  metric: "balance" | "level"
  scope: "global" | "friends"
}

export function LeaderboardChip({ onClick, metric, scope }: LeaderboardChipProps) {
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRank()
  }, [metric, scope])

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

  return (
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
  )
}
