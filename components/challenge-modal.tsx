"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Swords, Clock, DollarSign, Trophy, Flag } from "lucide-react"
import { type Challenge } from "@/types/challenge"

type ChallengeModalMode = "create" | "accept" | "counter" | "view" | "results"

type StatusIntent = "warning" | "danger" | "success" | "neutral"

type StatusInfo = {
  badge: string
  badgeVariant: "default" | "secondary" | "destructive" | "outline"
  title: string
  message?: string
  intent: StatusIntent
}

interface ChallengeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  challengedUserId?: string
  challengedUserName?: string
  challengedUserBalance?: number
  challenge?: Challenge | null
  mode?: "create"
  userBalance?: number
  onChallengeCreated?: () => void
  onChallengeUpdated?: () => void
  onChallengeEnded?: () => void
}

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number") {
    return "—"
  }

  const isNegative = value < 0
  const absoluteValue = Math.abs(value)
  const formatted = `$${absoluteValue.toLocaleString()}`
  return isNegative ? `-${formatted}` : formatted
}

const formatCredits = (value?: number | null) => {
  if (typeof value !== "number") {
    return "—"
  }
  return value.toLocaleString()
}

const formatTimer = (seconds: number | null) => {
  if (seconds === null) return "..."
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function ChallengeModal({
  open,
  onOpenChange,
  userId,
  challengedUserId,
  challengedUserName,
  challengedUserBalance = 0,
  challenge,
  mode: initialMode,
  userBalance = 0,
  onChallengeCreated,
  onChallengeUpdated,
  onChallengeEnded,
}: ChallengeModalProps) {
  const { toast } = useToast()
  const [wagerAmount, setWagerAmount] = useState<string>("")
  const [durationMinutes, setDurationMinutes] = useState<number>(5)
  const [loading, setLoading] = useState(false)
  const [liveChallenge, setLiveChallenge] = useState<Challenge | null>(challenge ?? null)

  // Update live challenge when prop changes
  useEffect(() => {
    setLiveChallenge(challenge ?? null)
  }, [challenge])

  const derivedMode: ChallengeModalMode = useMemo(() => {
    const currentChallenge = liveChallenge ?? challenge
    if (!currentChallenge) {
      return initialMode || "create"
    }

    if (currentChallenge.status === "completed") {
      return "results"
    }

    if (currentChallenge.status === "active") {
      return "view"
    }

    if (currentChallenge.status === "pending") {
      return currentChallenge.awaitingUserId === userId ? "accept" : "view"
    }

    return "view"
  }, [challenge, initialMode, liveChallenge, userId])

  const [mode, setMode] = useState<ChallengeModalMode>(derivedMode)
  const [modalCountdown, setModalCountdown] = useState<number | null>(null)

  useEffect(() => {
    setLiveChallenge(challenge ?? null)
  }, [challenge])

  useEffect(() => {
    if (!open) {
      return
    }

    setMode(derivedMode)

    if (liveChallenge ?? challenge) {
      const c = (liveChallenge ?? challenge)!
      setWagerAmount(c.wagerAmount.toString())
      setDurationMinutes(c.durationMinutes)
    } else {
      setWagerAmount("")
      setDurationMinutes(5)
    }
  }, [open, challenge, liveChallenge, derivedMode])

  useEffect(() => {
    const currentChallenge = liveChallenge ?? challenge
    if (mode === "counter" && currentChallenge) {
      setWagerAmount(currentChallenge.wagerAmount.toString())
      setDurationMinutes(currentChallenge.durationMinutes)
    }
  }, [mode, challenge, liveChallenge])

  useEffect(() => {
    const currentChallenge = liveChallenge ?? challenge
    if (!currentChallenge || currentChallenge.status !== "active" || !currentChallenge.expiresAt) {
      setModalCountdown(null)
      return
    }

    const updateTimer = () => {
      const expiresAt = new Date(currentChallenge.expiresAt!)
      const diff = Math.max(0, expiresAt.getTime() - Date.now())
      setModalCountdown(Math.floor(diff / 1000))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [challenge, liveChallenge])

  // Poll challenge while active to auto-refresh into results
  useEffect(() => {
    const currentChallenge = liveChallenge ?? challenge
    if (!open || !currentChallenge || currentChallenge.status !== "active") return

    let cancelled = false

    const pollChallenge = async () => {
      try {
        const response = await fetch(`/api/challenges/${currentChallenge.id}`)
        if (!response.ok) return
        const latest = await response.json()
        if (cancelled || !latest) return
        if (latest.status && (latest.status === "completed" || latest.status === "cancelled")) {
          setLiveChallenge(latest as Challenge)
          setMode("results")
          onChallengeUpdated?.()
        }
      } catch (err) {
        console.error("[ChallengeModal] Failed to poll challenge:", err)
      }
    }

    pollChallenge()
    const interval = setInterval(pollChallenge, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [open, challenge, liveChallenge, onChallengeUpdated])

  const currentChallenge = liveChallenge ?? challenge
  const isPendingResponse = Boolean(
    currentChallenge && currentChallenge.status === "pending" && currentChallenge.awaitingUserId === userId,
  )
  const isChallenger = currentChallenge?.challengerId === userId
  const isChallenged = currentChallenge?.challengedId === userId
  const canCounter = Boolean(isPendingResponse && isChallenged)
  const canCancel = Boolean(challenge && challenge.status === "pending" && isChallenger)
  const awaitingOpponentName = challenge && (isChallenger ? challenge.challengedName : challenge.challengerName)
  const opponentName = awaitingOpponentName
  const isActiveChallenge = currentChallenge?.status === "active"
  const isCompletedView = currentChallenge?.status === "completed" || derivedMode === "results"
  const isCancelledView = currentChallenge?.status === "cancelled"
  const playerCredits = currentChallenge
    ? isChallenger
      ? currentChallenge.challengerCreditBalance
      : currentChallenge.challengedCreditBalance
    : null
  const opponentCredits = currentChallenge
    ? isChallenger
      ? currentChallenge.challengedCreditBalance
      : currentChallenge.challengerCreditBalance
    : null
  const shouldShowSnapshot = Boolean(
    currentChallenge && (mode === "accept" || mode === "view") && currentChallenge.status !== "active",
  )

  const handleCreateChallenge = async () => {
    if (!challengedUserId) {
      toast({ title: "Error", description: "No user selected", variant: "destructive" })
      return
    }

    const wager = Number.parseInt(wagerAmount)
    if (!wager || wager <= 0) {
      toast({ title: "Error", description: "Please enter a valid wager amount", variant: "destructive" })
      return
    }

    if (wager > userBalance) {
      toast({ title: "Error", description: "Insufficient balance", variant: "destructive" })
      return
    }

    if (challengedUserBalance > 0 && wager > challengedUserBalance) {
      toast({
        title: "Error",
        description: `Wager cannot exceed ${challengedUserName}'s balance of $${challengedUserBalance.toLocaleString()}`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengedId: challengedUserId, wagerAmount: wager, durationMinutes }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to create challenge", variant: "destructive" })
        return
      }

      toast({ title: "Success", description: "Challenge created successfully" })
      onChallengeCreated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to create challenge:", error)
      toast({ title: "Error", description: "Failed to create challenge", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptChallenge = async () => {
    if (!challenge?.id) {
      toast({
        title: "Error",
        description: "Challenge details unavailable. Please reopen the modal.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to accept challenge", variant: "destructive" })
        return
      }

      toast({
        title: "Challenge Ready",
        description: isChallenger
          ? "Counter-offer accepted. Challenge credits reset to 500 and XP is doubled until it ends."
          : "Challenge accepted! You now have 500 gold credits and 2x XP until the challenge ends.",
      })

      onChallengeUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to accept challenge:", error)
      toast({ title: "Error", description: "Failed to accept challenge", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCounterOffer = async () => {
    if (!challenge?.id) {
      toast({
        title: "Error",
        description: "Challenge details unavailable. Please reopen the modal.",
        variant: "destructive",
      })
      return
    }

    const wager = Number.parseInt(wagerAmount)
    if (!wager || wager <= 0) {
      toast({ title: "Error", description: "Please enter a valid wager amount", variant: "destructive" })
      return
    }

    if (wager > userBalance) {
      toast({ title: "Error", description: "Wager exceeds your balance", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "counter-offer", wagerAmount: wager, durationMinutes }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to send counter-offer", variant: "destructive" })
        return
      }

      toast({ title: "Success", description: "Counter-offer sent. Waiting for challenger." })

      onChallengeUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to counter-offer:", error)
      toast({ title: "Error", description: "Failed to send counter-offer", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelChallenge = async () => {
    if (!challenge?.id) {
      toast({
        title: "Error",
        description: "Challenge details unavailable. Please reopen the modal.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/challenges/${challenge.id}`, { method: "DELETE" })
      const data = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to cancel challenge", variant: "destructive" })
        return
      }

      toast({ title: "Challenge cancelled", description: "Wager refunded." })
      onChallengeUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to cancel challenge:", error)
      toast({ title: "Error", description: "Failed to cancel challenge", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleEndChallenge = async () => {
    if (!currentChallenge?.id) return

    console.log("[v0] Archiving challenge with ID:", currentChallenge.id, "status:", currentChallenge.status)

    // Check if user has already archived this challenge
    const isChallenger = currentChallenge.challengerId === userId
    const userAlreadyArchived = isChallenger ? currentChallenge.challengerArchived : currentChallenge.challengedArchived

    if (userAlreadyArchived) {
      console.log("[v0] Challenge already archived by user, just closing modal")
      onChallengeEnded?.()
      onOpenChange(false)
      return
    }

    setLoading(true)
    try {
      console.log("[v0] Making fetch request to:", `/api/challenges/${currentChallenge.id}/archive`)

      const response = await fetch(`/api/challenges/${currentChallenge.id}/archive`, {
        method: "POST",
      })

      console.log("[v0] Archive response status:", response.status, "ok:", response.ok)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[v0] Archive response error data:", errorData)
        throw new Error(errorData.error || "Failed to archive challenge")
      }

      const responseData = await response.json().catch(() => ({}))
      console.log("[v0] Archive response success data:", responseData)

      onChallengeEnded?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to archive challenge:", error)
      toast({
        title: "Error",
        description: "Failed to archive challenge. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleForfeit = async () => {
    if (!currentChallenge?.id) return
    setLoading(true)
    try {
      const response = await fetch(`/api/challenges/${currentChallenge.id}/forfeit`, { method: "POST" })
      const data = await response.json()
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to forfeit challenge",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Challenge forfeited",
        description: "You have conceded this challenge. Wager paid to your opponent.",
      })
      onChallengeEnded?.()
      onOpenChange(false)

      onChallengeUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to forfeit challenge:", error)
      toast({ title: "Error", description: "Failed to forfeit challenge", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const getCloseButtonText = () => {
    // Check both derivedMode and challenge status to ensure we catch completed challenges
    const isCompleted = challenge?.status === "completed" || derivedMode === "results"
    const isCancelled = challenge?.status === "cancelled"

    if (isCompleted && challenge) {
      const isWinner = challenge.winnerId === userId
      const isTie = !challenge.winnerId
      if (isTie) {
        return "End Challenge"
      }
      return isWinner ? "Collect Winnings" : "End Challenge"
    }

    if (isCancelled) {
      return "Archive"
    }

    // Debug: log challenge status if it exists but isn't completed
    if (challenge && challenge.status !== "completed") {
      console.log("[ChallengeModal] Challenge status:", challenge.status, "derivedMode:", derivedMode)
    }
    return "Close"
  }

  const displayChallenge = currentChallenge ?? challenge

  const statusInfo = useMemo<StatusInfo | null>(() => {
    if (!displayChallenge) {
      return null
    }

    if (displayChallenge.status === "pending") {
      if (isPendingResponse) {
        return {
          badge: "Action needed",
          badgeVariant: "destructive" as const,
          title: isChallenger ? "Review counter offer" : "Respond to challenge",
          message: isChallenger
            ? `${displayChallenge.challengedName} updated the wager. Accept or send new terms to continue.`
            : `${displayChallenge.challengerName} is waiting for your decision. Accept or request changes to begin.`,
          intent: "warning" as const,
        }
      }

      return {
        badge: "Waiting",
        badgeVariant: "secondary" as const,
        title: awaitingOpponentName ? `Waiting on ${awaitingOpponentName}` : "Waiting on opponent",
        message: "We'll keep both players notified through the challenge chip as soon as it's their turn.",
        intent: "neutral" as const,
      }
    }

    if (displayChallenge.status === "active") {
      return {
        badge: "Live",
        badgeVariant: "default" as const,
        title: "Challenge in progress",
        message: "Expert mode only. Keep playing until the countdown reaches zero to lock in the results.",
        intent: "warning" as const,
      }
    }

    if (displayChallenge.status === "completed") {
      const didWin = displayChallenge.winnerId === userId
      return {
        badge: didWin ? "Victory" : displayChallenge.winnerId ? "Defeat" : "Tie",
        badgeVariant: didWin ? "default" : displayChallenge.winnerId ? "destructive" : "secondary",
        title: didWin
          ? "You won the challenge"
          : displayChallenge.winnerId
            ? "You lost this challenge"
            : "Challenge tied",
        message: "Final credit deltas and XP rewards are summarized below.",
        intent: didWin ? "success" : displayChallenge.winnerId ? "danger" : "neutral",
      }
    }

    if (displayChallenge.status === "cancelled") {
      return {
        badge: "Cancelled",
        badgeVariant: "outline" as const,
        title: "Challenge cancelled",
        message: isChallenger
          ? "You cancelled this request. Your wager has been fully refunded."
          : `${displayChallenge.challengerName} cancelled before play began. Your balance was unaffected.`,
        intent: "neutral" as const,
      }
    }

    return null
  }, [displayChallenge, isPendingResponse, isChallenger, userId, awaitingOpponentName])

  const title = (() => {
    if (mode === "create") return "Challenge Player"
    if (mode === "counter") return "Counter-Offer"
    if (!displayChallenge) return "Challenge Details"
    if (displayChallenge.status === "completed") return "Challenge Results"
    if (displayChallenge.status === "cancelled") return "Challenge Cancelled"
    if (displayChallenge.status === "active") return "Active Challenge"
    if (displayChallenge.status === "pending" && isPendingResponse) {
      return isChallenger ? "Review Counter Offer" : "Challenge Received"
    }
    if (displayChallenge.status === "pending") {
      return "Challenge Pending"
    }
    return "Challenge Details"
  })()

  const description = (() => {
    if (mode === "create" && challengedUserName) {
      return `Challenge ${challengedUserName} to a blackjack competition`
    }

    if (!displayChallenge) {
      return "Update or review the challenge."
    }

    if (displayChallenge.status === "pending") {
      if (isPendingResponse) {
        return isChallenger
          ? `${displayChallenge.challengedName} sent new terms. Accept or request different stakes.`
          : `${displayChallenge.challengerName} is waiting for you to accept or counter.`
      }
      if (awaitingOpponentName) {
        return `Waiting on ${awaitingOpponentName} to respond.`
      }
      return "Waiting for opponent response."
    }

    if (displayChallenge.status === "active") {
      return opponentName
        ? `Playing against ${opponentName}. Both players must stay in Expert mode until the timer ends.`
        : "Challenge in progress. Expert mode only."
    }

    if (displayChallenge.status === "completed") {
      return "Challenge completed. Review the outcome below."
    }

    if (displayChallenge.status === "cancelled") {
      return isChallenger
        ? "This challenge was cancelled. Your wager is back in your balance."
        : `${displayChallenge.challengerName} cancelled the challenge before it started.`
    }

    return "Update or review the challenge."
  })()

  const getStatusContainerClass = (intent: StatusIntent) => {
    switch (intent) {
      case "warning":
        return "border-amber-500/40 bg-amber-500/10"
      case "danger":
        return "border-destructive/40 bg-destructive/10"
      case "success":
        return "border-emerald-500/30 bg-emerald-500/10"
      default:
        return "border-border bg-muted/30"
    }
  }

  const renderActiveDetails = () => {
    const c = currentChallenge ?? challenge
    if (!c || c.status !== "active") return null

    const challengerHighlight = isChallenger ? "text-yellow-500" : "text-muted-foreground"
    const challengedHighlight = isChallenged ? "text-yellow-500" : "text-muted-foreground"

    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Time Remaining</span>
          <Badge variant="secondary">{formatTimer(modalCountdown)}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{c.challengerName}</p>
            <p className={`font-semibold ${challengerHighlight}`}>
              {formatCredits(c.challengerCreditBalance)} credits
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">{c.challengedName}</p>
            <p className={`font-semibold ${challengedHighlight}`}>
              {formatCredits(c.challengedCreditBalance)} credits
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderCompletionOutcome = () => {
    if (!challenge || challenge.status !== "completed") return null

    const isWinner = (currentChallenge ?? challenge)?.winnerId === userId
    const isTie = !(currentChallenge ?? challenge)?.winnerId

    const containerClass = isTie
      ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
      : isWinner
        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-50"
        : "border-destructive/50 bg-destructive/10 text-destructive-foreground"

    const headline = isTie ? "Challenge Tied" : isWinner ? "You Won!" : "Challenge Lost"
    const body = isTie
      ? "Wagers were refunded. Credits are frozen and XP was applied."
      : isWinner
        ? "Payout has been added to your balance. Nice work!"
        : "No payout this time, but your stats have been updated."

    return (
      <div className={`rounded-lg border p-4 space-y-1 ${containerClass}`}>
        <div className="text-sm font-semibold">{headline}</div>
        <p className="text-xs opacity-80">{body}</p>
      </div>
    )
  }

  const renderChallengeSnapshot = () => {
    const c = currentChallenge ?? challenge
    if (!c) return null

    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Wager:</span>
          <span className="text-sm font-semibold">{formatCurrency(c.wagerAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Duration:</span>
          <span className="text-sm font-semibold">{c.durationMinutes} minutes</span>
        </div>
      </div>
    )
  }

  const renderResults = () => {
    const c = currentChallenge ?? challenge
    if (mode !== "results" || !c) return null

    const challengerChange =
      c.challengerBalanceEnd !== null && c.challengerBalanceStart !== null
        ? c.challengerBalanceEnd - c.challengerBalanceStart
        : null
    const challengedChange =
      c.challengedBalanceEnd !== null && c.challengedBalanceStart !== null
        ? c.challengedBalanceEnd - c.challengedBalanceStart
        : null
    const winnerLabel = c.winnerId
      ? c.winnerId === userId
        ? "You"
        : c.winnerId === c.challengerId
          ? c.challengerName
          : c.challengedName
      : "Tie"

    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4" />
          <span>Winner: {winnerLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{c.challengerName}</p>
            <p className="font-medium">Change: {challengerChange !== null ? formatCurrency(challengerChange) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{c.challengedName}</p>
            <p className="font-medium">Change: {challengedChange !== null ? formatCurrency(challengedChange) : "—"}</p>
          </div>
        </div>
      </div>
    )
  }

  const renderCancelledNotice = () => {
    const c = currentChallenge ?? challenge
    if (!c || c.status !== "cancelled") return null

    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Challenge cancelled</p>
        <p className="mt-1">
          {isChallenger
            ? "You cancelled this request before it started. Your wager was fully refunded."
            : `${c.challengerName} cancelled before the countdown began. Enjoy your regular balance until a new challenge arrives.`}
        </p>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {statusInfo && (
            <div className={`rounded-lg border p-4 space-y-1 ${getStatusContainerClass(statusInfo.intent)}`}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{statusInfo.title}</span>
                <Badge variant={statusInfo.badgeVariant}>{statusInfo.badge}</Badge>
              </div>
              {statusInfo.message && <p className="text-xs text-muted-foreground">{statusInfo.message}</p>}
            </div>
          )}
          {renderCompletionOutcome()}
          {isActiveChallenge && renderActiveDetails()}
          {shouldShowSnapshot && renderChallengeSnapshot()}
          {mode === "accept" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold text-amber-200">Challenge Boosts</p>
              <p className="mt-1">Both players start with 500 gold challenge credits.</p>
              <p className="mt-1">XP earned during the challenge is doubled and applied when it ends.</p>
            </div>
          )}
          {renderResults()}
          {renderCancelledNotice()}

          {(mode === "create" || mode === "counter") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="wager">Wager Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="wager"
                    type="number"
                    placeholder="Enter wager amount"
                    value={wagerAmount}
                    onChange={(e) => setWagerAmount(e.target.value)}
                    className="pl-9"
                    min="1"
                    max={challengedUserBalance > 0 ? Math.min(userBalance, challengedUserBalance) : userBalance}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Your balance: {formatCurrency(userBalance)}</p>
                  {mode === "create" && challengedUserBalance > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const maxWager = Math.min(userBalance, challengedUserBalance)
                        setWagerAmount(maxWager.toString())
                      }}
                    >
                      Max Wager
                    </Button>
                  )}
                </div>
                {mode === "create" && challengedUserBalance > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {challengedUserName}'s balance: {formatCurrency(challengedUserBalance)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Challenge Duration</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={durationMinutes === 5 ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setDurationMinutes(5)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    5 min
                  </Button>
                  <Button
                    type="button"
                    variant={durationMinutes === 10 ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setDurationMinutes(10)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    10 min
                  </Button>
                </div>
              </div>
            </>
          )}

          {mode === "accept" && !isChallenger && (
            <div className="rounded-lg border border-border bg-primary/10 p-4 text-center text-sm">
              Both players must play <strong>Expert mode</strong>. Highest balance increase wins.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={(isCompletedView || isCancelledView) ? "default" : "outline"}
            onClick={
              (isCompletedView || isCancelledView)
                ? handleEndChallenge
                : () => onOpenChange(false)
            }
            className="flex-1"
            disabled={loading}
          >
            {getCloseButtonText()}
          </Button>

          {mode === "create" && (
            <Button onClick={handleCreateChallenge} className="flex-1" disabled={loading}>
              Request Challenge
            </Button>
          )}

          {mode === "accept" && (
            <>
              {canCounter && (
                <Button variant="outline" onClick={() => setMode("counter")} className="flex-1" disabled={loading}>
                  Request Changes
                </Button>
              )}
              {isChallenger && canCancel && (
                <Button variant="destructive" onClick={handleCancelChallenge} className="flex-1" disabled={loading}>
                  Cancel
                </Button>
              )}
              <Button onClick={handleAcceptChallenge} className="flex-1" disabled={loading}>
                {isChallenger ? "Accept Update" : "Accept Challenge"}
              </Button>
            </>
          )}

          {mode === "view" && canCancel && (
            <Button variant="destructive" onClick={handleCancelChallenge} className="flex-1" disabled={loading}>
              Cancel Challenge
            </Button>
          )}

          {isActiveChallenge && (
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={handleForfeit}
              disabled={loading}
            >
              <Flag className="mr-2 h-4 w-4" />
              Forfeit (Concede)
            </Button>
          )}

          {mode === "counter" && (
            <>
              <Button variant="outline" onClick={() => setMode(derivedMode)} className="flex-1" disabled={loading}>
                Back
              </Button>
              <Button onClick={handleCounterOffer} className="flex-1" disabled={loading}>
                Request Update
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
