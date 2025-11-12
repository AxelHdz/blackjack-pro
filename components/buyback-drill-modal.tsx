"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlayingCard } from "@/components/playing-card"
import { getOptimalMove, type GameAction } from "@/lib/blackjack-strategy"
import { calculateHandValue, createDeck, type Card } from "@/lib/card-utils"
import { X, Check, AlertCircle, Clock } from "lucide-react"
import { DRILL_CONFIG, getReward, getStreakRequired } from "@/lib/drill-config"
import { resolveFeedback, type FeedbackContext } from "@/lib/drill-feedback"

interface BuybackDrillModalProps {
  onClose: () => void
  onSuccess: (amount: number) => void
  userId: string
  currentTier: number
}

type MistakeLog = {
  playerHand: Card[]
  dealerUpcard: Card
  playerMove: GameAction
  optimalMove: GameAction
  tip: string
  why: string
  templateMatchesOptimal: boolean
  selectedMessageKey: string
}

export function BuybackDrillModal({ onClose, onSuccess, userId, currentTier }: BuybackDrillModalProps) {
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [streakCount, setStreakCount] = useState(0)
  const [mistakesLog, setMistakesLog] = useState<MistakeLog[]>([])
  const [selectedAction, setSelectedAction] = useState<GameAction | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isCounted, setIsCounted] = useState(false)
  const [drillComplete, setDrillComplete] = useState(false)
  const [drillFailed, setDrillFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [answerStartTime, setAnswerStartTime] = useState<number>(0)
  const [notCountedReason, setNotCountedReason] = useState("")
  const [timeRemaining, setTimeRemaining] = useState(60)

  const streakRequired = getStreakRequired(currentTier)
  const rewardAmount = getReward(currentTier)

  useEffect(() => {
    generateNewHand()
  }, [])

  useEffect(() => {
    if (drillComplete || drillFailed || isLoading) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setDrillFailed(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [drillComplete, drillFailed, isLoading])

  const generateNewHand = () => {
    let attempts = 0
    let playerCard1: Card
    let playerCard2: Card
    let handValue: number

    do {
      const newDeck = createDeck()
      playerCard1 = newDeck.pop()!
      playerCard2 = newDeck.pop()!
      handValue = calculateHandValue([playerCard1, playerCard2])
      attempts++

      if (attempts > 50) break
    } while (handValue === 21)

    const newDeck = createDeck()
    const usedCards = [playerCard1, playerCard2]
    const filteredDeck = newDeck.filter(
      (card) => !usedCards.some((used) => used.rank === card.rank && used.suit === card.suit),
    )
    const dealerCard = filteredDeck.pop()!

    setPlayerHand([playerCard1, playerCard2])
    setDealerHand([dealerCard])
    setSelectedAction(null)
    setShowFeedback(false)
    setIsLoading(false)
    setAnswerStartTime(Date.now())
  }

  const handleActionSelect = (action: GameAction) => {
    const answerTime = Date.now() - answerStartTime
    const optimal = getOptimalMove(playerHand, dealerHand[0])
    const correct = action === optimal
    const isFastTap = answerTime < DRILL_CONFIG.fast_tap_ms

    setSelectedAction(action)
    setIsCorrect(correct)

    let counted = false
    let reason = ""

    if (!correct) {
      const feedbackCtx: FeedbackContext = {
        playerHand: [...playerHand],
        dealerUpcard: dealerHand[0],
        optimalMove: optimal,
        playerMove: action,
        tableVariant: "H17",
      }
      const feedback = resolveFeedback(feedbackCtx)

      setStreakCount(0)
      setMistakesLog((prev) => [
        ...prev,
        {
          playerHand: [...playerHand],
          dealerUpcard: dealerHand[0],
          playerMove: action,
          optimalMove: optimal,
          tip: feedback.tip,
          why: feedback.why,
          templateMatchesOptimal: feedback.templateMatchesOptimal,
          selectedMessageKey: feedback.selectedMessageKey,
        },
      ])
      reason = "Incorrect move"
    } else if (isFastTap) {
      reason = "Too fast—no instant taps"
    } else {
      counted = true
      setStreakCount((prev) => prev + 1)

      if (streakCount + 1 >= streakRequired) {
        setDrillComplete(true)
      }
    }

    setIsCounted(counted)
    setNotCountedReason(reason)
    setShowFeedback(true)

    setTimeout(() => {
      if (correct && !drillComplete) {
        generateNewHand()
        setShowFeedback(false)
      } else if (!correct) {
        setDrillFailed(true)
      }
    }, 1500)
  }

  const handleSuccess = () => {
    onSuccess(rewardAmount)
    onClose()
  }

  const handleRetry = () => {
    setTimeRemaining(60)
    setStreakCount(0)
    setMistakesLog([])
    setDrillFailed(false)
    setDrillComplete(false)
    generateNewHand()
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center">
            <p className="text-muted-foreground">Loading drill...</p>
          </div>
        </div>
      </div>
    )
  }

  if (playerHand.length === 0 || dealerHand.length === 0) {
    return null
  }

  if (drillComplete) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-card border border-success rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-success mb-2">Buyback Earned!</h2>
              <p className="text-muted-foreground">
                You cleared {streakRequired}-in-a-row and earned{" "}
                <span className="font-bold text-success">${rewardAmount}</span>
              </p>
              {currentTier < 2 && (
                <p className="text-sm text-muted-foreground mt-4">
                  Next bust-out: {getStreakRequired(currentTier + 1)}-in-a-row for ${getReward(currentTier + 1)}
                </p>
              )}
            </div>
            <Button onClick={handleSuccess} size="lg" className="w-full h-14 text-lg bg-success hover:bg-success/90">
              Claim ${rewardAmount}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (drillFailed) {
    const maxStreak = streakCount
    return (
      <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-card border border-error rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-error/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-error" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-error">Drill Failed</h2>
                  <p className="text-sm text-muted-foreground">
                    Closest streak: {maxStreak}/{streakRequired} • {mistakesLog.length} mistake
                    {mistakesLog.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {mistakesLog.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Why these moves weren't optimal</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {mistakesLog.slice(-5).map((mistake, index) => {
                    const playerValue = calculateHandValue(mistake.playerHand)
                    const dealerValue = calculateHandValue([mistake.dealerUpcard])
                    return (
                      <div key={index} className="space-y-3">
                        {/* Dealer and Player Cards - Side by Side */}
                        <div className="flex items-center justify-center gap-4 w-full">
                          {/* Dealer Hand */}
                          <div className="text-center flex-1 flex flex-col items-center">
                            <div className="text-xs text-muted-foreground mb-1">Dealer Shows</div>
                            <Badge variant="secondary" className="mb-2 text-base font-bold px-3 py-1">
                              {dealerValue}
                            </Badge>
                            <div className="flex justify-center scale-75">
                              <PlayingCard card={mistake.dealerUpcard} delay={0} owner="dealer" />
                            </div>
                          </div>

                          {/* Player Hand */}
                          <div className="text-center flex-1 flex flex-col items-center">
                            <div className="text-xs text-muted-foreground mb-1">Your Hand</div>
                            <Badge variant="default" className="mb-2 text-base font-bold px-3 py-1 bg-primary">
                              {playerValue}
                            </Badge>
                            <div className="flex justify-center gap-1 scale-75">
                              {mistake.playerHand.map((card, cardIndex) => (
                                <PlayingCard key={cardIndex} card={card} delay={0} owner="player" />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Feedback - Matching FeedbackModal format */}
                        <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex gap-2 items-center">
                              <span className="text-xs font-mono bg-background px-2 py-1 rounded">
                                P: {playerValue} vs D: {mistake.dealerUpcard.rank}
                              </span>
                            </div>
                            <div className="text-sm text-error font-semibold">
                              You: {mistake.playerMove.toUpperCase()} → Optimal: {mistake.optimalMove.toUpperCase()}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-primary">{mistake.tip}</p>
                            <p className="text-xs text-muted-foreground whitespace-normal break-words">
                              {mistake.why}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button onClick={onClose} variant="outline" className="flex-1 h-11 bg-transparent">
                Close
              </Button>
              <Button onClick={handleRetry} variant="default" className="flex-1 h-11 bg-primary">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const optimalMove = getOptimalMove(playerHand, dealerHand[0])

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-2 overflow-hidden">
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-sm px-3 py-1 bg-primary">
              {streakCount}/{streakRequired}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeRemaining}s
            </Badge>
            <div className="flex gap-1">
              {Array.from({ length: streakRequired }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${i < streakCount ? "bg-success" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm" className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Title */}
        <div className="text-center mb-3">
          <h2 className="text-lg font-bold mb-1">Buyback Drill: Tier {currentTier + 1}</h2>
          <p className="text-xs text-muted-foreground">
            Get {streakRequired} correct in a row to earn ${rewardAmount}
          </p>
        </div>

        {/* Game State */}
        <div className="space-y-3 mb-3">
          {/* Dealer Hand */}
          <div className="text-center -mb-2">
            <div className="text-xs text-muted-foreground mb-1">Dealer Shows</div>
            <Badge variant="secondary" className="mb-0 text-base font-bold px-3 py-1">
              {calculateHandValue([dealerHand[0]])}
            </Badge>
            <div className="flex justify-center scale-75">
              <PlayingCard card={dealerHand[0]} delay={0} owner="dealer" />
            </div>
          </div>

          {/* Feedback - Always reserve space */}
          <div className="min-h-[40px] flex items-center justify-center">
            {showFeedback && (
              <div
                className={`p-2 rounded-lg border text-xs w-auto min-w-[200px] ${
                  isCorrect
                    ? isCounted
                      ? "bg-success/10 border-success"
                      : "bg-yellow-500/10 border-yellow-500"
                    : "bg-error/10 border-error"
                }`}
              >
                <p className="text-center font-semibold">
                  {isCorrect ? (
                    isCounted ? (
                      <>
                        <Check className="inline h-3 w-3 mr-1" />
                        Optimal: {optimalMove?.toUpperCase()}. +1 streak!
                      </>
                    ) : (
                      <>
                        <AlertCircle className="inline h-3 w-3 mr-1" />
                        Correct, but didn't count—{notCountedReason}
                      </>
                    )
                  ) : (
                    <>
                      <X className="inline h-3 w-3 mr-1" />
                      Optimal: {optimalMove?.toUpperCase()}. Streak reset.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Player Hand */}
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Your Hand</div>
            <Badge variant="default" className="mb-0 text-base font-bold px-3 py-1 bg-primary">
              {calculateHandValue(playerHand)}
            </Badge>
            <div className="flex justify-center gap-1 scale-75">
              {playerHand.map((card, index) => (
                <PlayingCard key={index} card={card} delay={0} owner="player" />
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleActionSelect("hit")}
            disabled={showFeedback}
            variant="outline"
            size="lg"
            className="h-12 text-sm"
          >
            Hit
          </Button>
          <Button
            onClick={() => handleActionSelect("stand")}
            disabled={showFeedback}
            variant="outline"
            size="lg"
            className="h-12 text-sm"
          >
            Stand
          </Button>
          <Button
            onClick={() => handleActionSelect("double")}
            disabled={showFeedback}
            variant="outline"
            size="lg"
            className="h-12 text-sm"
          >
            Double
          </Button>
          <Button
            onClick={() => handleActionSelect("split")}
            disabled={showFeedback}
            variant="outline"
            size="lg"
            className="h-12 text-sm"
          >
            Split
          </Button>
        </div>
      </div>
    </div>
  )
}
