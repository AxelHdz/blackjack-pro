"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Swords, Clock, DollarSign } from "lucide-react"

interface Challenge {
  id: string
  challengerId: string
  challengerName: string
  challengedId: string
  challengedName: string
  wagerAmount: number
  durationMinutes: number
  status: string
}

interface ChallengeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  challengedUserId?: string
  challengedUserName?: string
  challenge?: Challenge | null
  mode?: "create" | "accept" | "counter"
  userBalance?: number
  onChallengeCreated?: () => void
  onChallengeUpdated?: () => void
}

export function ChallengeModal({
  open,
  onOpenChange,
  challengedUserId,
  challengedUserName,
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
  const [mode, setMode] = useState<"create" | "accept" | "counter">(initialMode || "create")

  useEffect(() => {
    if (open) {
      if (challenge) {
        // Existing challenge - determine mode
        if (challenge.status === "pending") {
          // Check if user is challenger or challenged
          const currentUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null
          if (currentUserId === challenge.challengedId) {
            setMode("accept")
          } else {
            setMode("create") // Challenger viewing their pending challenge
          }
          setWagerAmount(challenge.wagerAmount.toString())
          setDurationMinutes(challenge.durationMinutes)
        } else {
          setMode("create")
        }
      } else {
        setMode(initialMode || "create")
        setWagerAmount("")
        setDurationMinutes(15)
      }
      // Fetch user balance when modal opens
      if (userBalance === 0) {
        fetch("/api/me/profile")
          .then((res) => res.json())
          .then((data) => {
            if (data.stats?.total_money !== undefined) {
              // Update parent component's balance if needed
              // For now, we'll use the prop
            }
          })
          .catch((err) => console.error("[v0] Failed to fetch balance:", err))
      }
    }
  }, [open, challenge, initialMode, userBalance])

  const handleCreateChallenge = async () => {
    if (!challengedUserId) {
      toast({
        title: "Error",
        description: "No user selected",
        variant: "destructive",
      })
      return
    }

    const wager = Number.parseInt(wagerAmount)
    if (!wager || wager <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid wager amount",
        variant: "destructive",
      })
      return
    }

    if (wager > userBalance) {
      toast({
        title: "Error",
        description: "Insufficient balance",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengedId: challengedUserId,
          wagerAmount: wager,
          durationMinutes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to create challenge",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Challenge created successfully",
      })

      onChallengeCreated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to create challenge:", error)
      toast({
        title: "Error",
        description: "Failed to create challenge",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptChallenge = async () => {
    if (!challenge) return

    setLoading(true)
    try {
      const response = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to accept challenge",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Challenge accepted! You must play Expert mode.",
      })

      onChallengeUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to accept challenge:", error)
      toast({
        title: "Error",
        description: "Failed to accept challenge",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCounterOffer = async () => {
    if (!challenge) return

    const wager = Number.parseInt(wagerAmount)
    if (!wager || wager <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid wager amount",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "counter-offer",
          wagerAmount: wager,
          durationMinutes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to send counter-offer",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Counter-offer sent. Waiting for challenger to accept.",
      })

      onChallengeUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Failed to counter-offer:", error)
      toast({
        title: "Error",
        description: "Failed to send counter-offer",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            {mode === "create" ? "Challenge Player" : mode === "accept" ? "Challenge Received" : "Counter-Offer"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" && challengedUserName
              ? `Challenge ${challengedUserName} to a blackjack competition`
              : mode === "accept" && challenge
                ? `${challenge.challengerName} has challenged you!`
                : "Update the challenge terms"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "accept" && challenge && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Wager:</span>
                <span className="text-sm font-semibold">${challenge.wagerAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Duration:</span>
                <span className="text-sm font-semibold">{challenge.durationMinutes} minutes</span>
              </div>
            </div>
          )}

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
                    max={userBalance}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Your balance: ${userBalance.toLocaleString()}</p>
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

          {mode === "accept" && (
            <div className="rounded-lg border border-border bg-primary/10 p-4">
              <p className="text-sm text-center">
                Both players must play <strong>Expert mode</strong> during the challenge. The player with the highest
                balance increase wins the wager.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          {mode === "create" && (
            <Button onClick={handleCreateChallenge} className="flex-1" disabled={loading}>
              Request Challenge
            </Button>
          )}
          {mode === "accept" && (
            <>
              <Button variant="outline" onClick={() => setMode("counter")} className="flex-1" disabled={loading}>
                Request Update
              </Button>
              <Button onClick={handleAcceptChallenge} className="flex-1" disabled={loading}>
                Accept Challenge
              </Button>
            </>
          )}
          {mode === "counter" && (
            <Button onClick={handleCounterOffer} className="flex-1" disabled={loading}>
              Request Update
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

