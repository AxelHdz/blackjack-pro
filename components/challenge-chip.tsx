"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Swords, Clock, DollarSign, X, CheckCircle } from "lucide-react"
import { type Challenge } from "@/types/challenge"

interface ChallengeChipProps {
  challenge: Challenge | null
  onClick: () => void
  userId: string
}

export function ChallengeChip({ challenge, onClick, userId }: ChallengeChipProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!challenge || challenge.status !== "active" || !challenge.expiresAt) {
      setTimeRemaining(null)
      return
    }

    const updateTimer = () => {
      const expiresAt = new Date(challenge.expiresAt!)
      const now = new Date()
      const diff = Math.max(0, expiresAt.getTime() - now.getTime())
      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(minutes * 60 + seconds)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [challenge])

  if (!challenge) return null

  const isChallenger = challenge.challengerId === userId
  const isChallenged = challenge.challengedId === userId
  const isWinner = challenge.winnerId === userId
  const isCompleted = challenge.status === "completed"
  const awaitingUserId = challenge.awaitingUserId
  const playerCredits = isChallenger ? challenge.challengerCreditBalance ?? 0 : challenge.challengedCreditBalance ?? 0
  const opponentCredits = isChallenger ? challenge.challengedCreditBalance ?? 0 : challenge.challengerCreditBalance ?? 0
  const creditDiff = playerCredits - opponentCredits

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getChallengeText = () => {
    if (isCompleted) {
      if (challenge.winnerId) {
        return isWinner ? "Challenge Won!" : "Challenge Lost"
      }
      return "Challenge Tied"
    }

    if (challenge.status === "pending") {
      if (awaitingUserId === userId) {
        return isChallenger ? "Counter Offer Received" : "Challenge Received"
      }
      return isChallenger ? "Pending Opponent" : "Challenge Sent"
    }

    if (challenge.status === "active") {
      if (creditDiff > 0) return "You're Winning"
      if (creditDiff < 0) return "You're Losing"
      return "Challenge Tied"
    }

    return "Challenge"
  }

  const getOpponentName = () => {
    if (challenge.status === "pending" && isChallenger) {
      return challenge.challengedName
    }
    return null
  }

  const getIcon = () => {
    if (isCompleted) {
      if (challenge.winnerId) {
        return isWinner ? (
          <DollarSign className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-red-500" />
        )
      }
      return <CheckCircle className="h-4 w-4 text-muted-foreground" />
    }

    if (challenge.status === "pending") {
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
        {challenge.status === "pending" && isChallenger && getOpponentName() && (
          <span className="text-xs text-muted-foreground">· {getOpponentName()}</span>
        )}
        {challenge.status === "active" && (
          <>
            {timeRemaining !== null && (
              <Badge variant="secondary" className="text-xs">
                {formatTime(timeRemaining)}
              </Badge>
            )}
            <span
              className={`text-xs font-semibold ${
                creditDiff === 0 ? "text-muted-foreground" : creditDiff > 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {creditDiff === 0 ? "Even" : `${creditDiff > 0 ? "+" : "-"}${Math.abs(creditDiff).toLocaleString()}`}
            </span>
          </>
        )}
      </div>
      {challenge.status === "pending" && awaitingUserId === userId && (
        <Badge variant="destructive" className="text-xs">
          New
        </Badge>
      )}
    </button>
  )
}
