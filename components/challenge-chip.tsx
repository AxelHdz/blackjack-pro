"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Swords, Clock, DollarSign, X, CheckCircle } from "lucide-react"
import { type Challenge } from "@/types/challenge"
import { useChallenge } from "@/contexts/challenge-context"

interface ChallengeChipProps {
  challenge: Challenge | null
  onClick: () => void
  userId: string
}

export function ChallengeChip({ challenge, onClick, userId }: ChallengeChipProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(challenge)
  const { activeChallenge: contextActiveChallenge, refreshActiveChallenge } = useChallenge()

  // Use context active challenge if available and matches the prop challenge
  useEffect(() => {
    if (challenge?.status === "active" && contextActiveChallenge?.id === challenge.id) {
      setCurrentChallenge(contextActiveChallenge)
    } else {
      setCurrentChallenge(challenge)
    }
  }, [challenge, contextActiveChallenge])

  // Refresh challenge data when timer expires (uses context to avoid redundant fetch)
  const fetchActiveChallenge = useCallback(async () => {
    if (!challenge) return
    if (challenge.status !== "active") {
      setCurrentChallenge(challenge)
      return
    }

    // Use context refresh instead of direct fetch
    try {
      await refreshActiveChallenge()
      // Context will update via event system, but we can also check context directly
      if (contextActiveChallenge && contextActiveChallenge.id === challenge.id) {
        setCurrentChallenge(contextActiveChallenge)
      }
    } catch (error) {
      console.error("[v0] Failed to refresh active challenge:", error)
    }
  }, [challenge, refreshActiveChallenge, contextActiveChallenge])

  // Update current challenge when prop changes
  useEffect(() => {
    setCurrentChallenge(challenge)
  }, [challenge])

  useEffect(() => {
    const handleChallengeProgress = (event: Event) => {
      const detail = (event as CustomEvent<Challenge | null>).detail
      if (!detail) return
      if (challenge && detail.id !== challenge.id) return
      setCurrentChallenge(detail)
    }

    window.addEventListener("challenge:progress", handleChallengeProgress as EventListener)
    return () => window.removeEventListener("challenge:progress", handleChallengeProgress as EventListener)
  }, [challenge])

  // No polling needed - challenge updates come via:
  // 1. challenge:progress event (already handled above)
  // 2. Props updates from parent component
  // 3. Timer expiration triggers completion check

  useEffect(() => {
    // Only show timer for active challenges
    if (!currentChallenge || currentChallenge.status !== "active" || !currentChallenge.expiresAt) {
      setTimeRemaining(null)
      return
    }

    const updateTimer = () => {
      const expiresAt = new Date(currentChallenge.expiresAt!)
      const now = new Date()
      const diff = Math.max(0, expiresAt.getTime() - now.getTime())
      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      const totalSeconds = minutes * 60 + seconds

      // If time expired, clear timer (challenge should be completed)
      if (totalSeconds === 0) {
        setTimeRemaining(null)
        // Attempt completion so the UI advances to results even if the main game isn't open
        void (async () => {
          try {
            await fetch(`/api/challenges/${currentChallenge.id}/complete`, { method: "POST" })
            await fetchActiveChallenge()
          } catch (err) {
            console.error("[v0] Failed to auto-complete challenge from chip:", err)
          }
        })()
        return
      }

      setTimeRemaining(totalSeconds)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [currentChallenge])

  const challengeToUse = currentChallenge || challenge
  if (!challengeToUse) return null

  const isChallenger = challengeToUse.challengerId === userId
  const isChallenged = challengeToUse.challengedId === userId
  const isWinner = challengeToUse.winnerId === userId
  const isCompleted = challengeToUse.status === "completed"
  const isCancelled = challengeToUse.status === "cancelled"
  const awaitingUserId = challengeToUse.awaitingUserId
  const playerCredits = isChallenger ? challengeToUse.challengerCreditBalance ?? 0 : challengeToUse.challengedCreditBalance ?? 0
  const opponentCredits = isChallenger ? challengeToUse.challengedCreditBalance ?? 0 : challengeToUse.challengerCreditBalance ?? 0
  const creditDiff = playerCredits - opponentCredits

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getChallengeText = () => {
    if (isCompleted) {
      if (challengeToUse.winnerId) {
        return isWinner ? "Challenge Won!" : "Challenge Lost"
      }
      return "Challenge Tied"
    }

    if (isCancelled) {
      return "Challenge Cancelled"
    }

    if (challengeToUse.status === "pending") {
      if (awaitingUserId === userId) {
        return isChallenger ? "Counter Offer Received" : "Challenge Received"
      }
      return isChallenger ? "Pending Opponent" : "Challenge Sent"
    }

    if (challengeToUse.status === "active") {
      if (creditDiff > 0) return "You're Winning"
      if (creditDiff < 0) return "You're Losing"
      return "Challenge Tied"
    }

    return "Challenge"
  }

  const getOpponentName = () => {
    if (challengeToUse.status === "pending" && isChallenger) {
      return challengeToUse.challengedName
    }
    return null
  }

  const getIcon = () => {
    if (isCompleted) {
      if (challengeToUse.winnerId) {
        return isWinner ? (
          <DollarSign className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-red-500" />
        )
      }
      return <CheckCircle className="h-4 w-4 text-muted-foreground" />
    }

    if (isCancelled) {
      return <X className="h-4 w-4 text-muted-foreground" />
    }

    if (challengeToUse.status === "pending") {
      return <Clock className="h-4 w-4" />
    }

    return <Swords className="h-4 w-4" />
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted transition-all duration-200 hover:scale-105 active:scale-95 w-full justify-between"
      aria-label={`Challenge: ${getChallengeText()}`}
    >
      <div className="flex items-center gap-2">
        {getIcon()}
        <span className="text-sm font-medium text-foreground">{getChallengeText()}</span>
        {challengeToUse.status === "pending" && isChallenger && getOpponentName() && (
          <span className="text-xs text-muted-foreground">· {getOpponentName()}</span>
        )}
        {challengeToUse.status === "active" && (
          <>
            {timeRemaining !== null && timeRemaining > 0 && (
              <Badge variant="secondary" className="text-xs">
                {formatTime(timeRemaining)}
              </Badge>
            )}
            {timeRemaining !== null && timeRemaining > 0 && (
              <span
                className={`text-xs font-semibold ${
                  creditDiff === 0 ? "text-muted-foreground" : creditDiff > 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {creditDiff === 0 ? "Even" : `${creditDiff > 0 ? "+" : "-"}${Math.abs(creditDiff).toLocaleString()}`}
              </span>
            )}
          </>
        )}
      </div>
      {challengeToUse.status === "pending" && awaitingUserId === userId && (
        <Badge variant="destructive" className="text-xs">
          New
        </Badge>
      )}
      {isCancelled && (
        <Badge variant="secondary" className="text-xs">
          Refunded
        </Badge>
      )}
    </button>
  )
}
