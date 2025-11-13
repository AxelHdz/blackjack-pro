"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Swords, Clock, DollarSign, Trophy } from "lucide-react"
import { type Challenge } from "@/types/challenge"

type ChallengeModalMode = "create" | "accept" | "counter" | "view" | "results"

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
}: ChallengeModalProps) {
  const { toast } = useToast()
  const [wagerAmount, setWagerAmount] = useState<string>("")
  const [durationMinutes, setDurationMinutes] = useState<number>(15)
  const [loading, setLoading] = useState(false)

  const derivedMode: ChallengeModalMode = useMemo(() => {
    if (!challenge) {
      return initialMode || "create"
    }

    if (challenge.status === "completed") {
      return "results"
    }

    if (challenge.status === "active") {
      return "view"
    }

    if (challenge.status === "pending") {
      return challenge.awaitingUserId === userId ? "accept" : "view"
    }

    return "view"
  }, [challenge, initialMode, userId])

  const [mode, setMode] = useState<ChallengeModalMode>(derivedMode)
  const [modalCountdown, setModalCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setMode(derivedMode)

    if (challenge) {
      setWagerAmount(challenge.wagerAmount.toString())
      setDurationMinutes(challenge.durationMinutes)
    } else {
      setWagerAmount("")
      setDurationMinutes(15)
    }
  }, [open, challenge, derivedMode])

  useEffect(() => {
    if (mode === "counter" && challenge) {
      setWagerAmount(challenge.wagerAmount.toString())
      setDurationMinutes(challenge.durationMinutes)
    }
  }, [mode, challenge])

  useEffect(() => {
    if (!challenge || challenge.status !== "active" || !challenge.expiresAt) {
      setModalCountdown(null)
      return
    }

    const updateTimer = () => {
      const expiresAt = new Date(challenge.expiresAt!)
      const diff = Math.max(0, expiresAt.getTime() - Date.now())
      setModalCountdown(Math.floor(diff / 1000))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [challenge])

  const isPendingResponse = Boolean(challenge && challenge.status === "pending" && challenge.awaitingUserId === userId)
  const isChallenger = challenge?.challengerId === userId
  const isChallenged = challenge?.challengedId === userId
  const canCounter = Boolean(isPendingResponse && isChallenged)
  const canCancel = Boolean(challenge && challenge.status === "pending" && isChallenger)
  const awaitingOpponentName = challenge && (isChallenger ? challenge.challengedName : challenge.challengerName)
  const isActiveChallenge = challenge?.status === "active"
  const playerCredits = challenge
    ? isChallenger
      ? challenge.challengerCreditBalance
      : challenge.challengedCreditBalance
    : null
  const opponentCredits = challenge
    ? isChallenger
      ? challenge.challengedCreditBalance
      : challenge.challengerCreditBalance
    : null
  const shouldShowSnapshot = Boolean(
    challenge && (mode === "accept" || mode === "view") && challenge.status !== "active",
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

  const title = (() => {
    if (mode === "create") return "Challenge Player"
    if (mode === "results") return "Challenge Results"
    if (mode === "counter") return "Counter-Offer"
    if (mode === "accept") return isChallenger ? "Counter Offer" : "Challenge Received"
    return "Challenge Details"
  })()

  const description = (() => {
    if (mode === "create" && challengedUserName) {
      return `Challenge ${challengedUserName} to a blackjack competition`
    }

    if (mode === "accept" && challenge) {
      return isChallenger
        ? `${challenge.challengedName} sent a counter-offer.`
        : `${challenge.challengerName} has challenged you!`
    }

    if (mode === "results") {
      return "Challenge completed. Review the outcome below."
    }

    if (challenge && awaitingOpponentName) {
      return `Versus ${awaitingOpponentName}`
    }

    return "Update or review the challenge."
  })()

  const renderActiveDetails = () => {
    if (!challenge || challenge.status !== "active") return null

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
            <p className="text-muted-foreground">{challenge.challengerName}</p>
            <p className={`font-semibold ${challengerHighlight}`}>
              {formatCredits(challenge.challengerCreditBalance)} credits
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">{challenge.challengedName}</p>
            <p className={`font-semibold ${challengedHighlight}`}>
              {formatCredits(challenge.challengedCreditBalance)} credits
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderChallengeSnapshot = () => {
    if (!challenge) return null

    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Wager:</span>
          <span className="text-sm font-semibold">{formatCurrency(challenge.wagerAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Duration:</span>
          <span className="text-sm font-semibold">{challenge.durationMinutes} minutes</span>
        </div>
      </div>
    )
  }

  const renderResults = () => {
    if (mode !== "results" || !challenge) return null

    const challengerChange =
      challenge.challengerBalanceEnd !== null && challenge.challengerBalanceStart !== null
        ? challenge.challengerBalanceEnd - challenge.challengerBalanceStart
        : null
    const challengedChange =
      challenge.challengedBalanceEnd !== null && challenge.challengedBalanceStart !== null
        ? challenge.challengedBalanceEnd - challenge.challengedBalanceStart
        : null
    const winnerLabel = challenge.winnerId
      ? challenge.winnerId === userId
        ? "You"
        : challenge.winnerId === challenge.challengerId
          ? challenge.challengerName
          : challenge.challengedName
      : "Tie"

    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4" />
          <span>Winner: {winnerLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{challenge.challengerName}</p>
            <p className="font-medium">Change: {challengerChange !== null ? formatCurrency(challengerChange) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{challenge.challengedName}</p>
            <p className="font-medium">Change: {challengedChange !== null ? formatCurrency(challengedChange) : "—"}</p>
          </div>
        </div>
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
                    variant={durationMinutes === 15 ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setDurationMinutes(15)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    15 min
                  </Button>
                  <Button
                    type="button"
                    variant={durationMinutes === 30 ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setDurationMinutes(30)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    30 min
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>
            Close
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
