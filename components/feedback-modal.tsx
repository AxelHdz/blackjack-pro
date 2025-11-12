"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlayingCard } from "@/components/playing-card"
import { calculateHandValue, type Card } from "@/lib/card-utils"
import { type GameAction } from "@/lib/blackjack-strategy"
import { X } from "lucide-react"

interface FeedbackModalProps {
  onClose: () => void
  feedbackData: {
    playerAction: GameAction
    optimalAction: GameAction
    isCorrect: boolean
    tip: string
    why: string
    originalPlayerHand: Card[]
    moveCount: number
  }
  playerHand: Card[]
  dealerUpcard: Card
  isGuidedMode?: boolean
}

export function FeedbackModal({ onClose, feedbackData, playerHand, dealerUpcard, isGuidedMode = false }: FeedbackModalProps) {
  // Use originalPlayerHand from feedbackData to show the correct hand that was used for the decision
  const originalHand = feedbackData.originalPlayerHand.length > 0 ? feedbackData.originalPlayerHand : playerHand
  const playerValue = calculateHandValue(originalHand)
  const dealerValue = calculateHandValue([dealerUpcard])
  const isCorrect = feedbackData.isCorrect

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`bg-card border rounded-2xl p-6 max-w-lg w-full shadow-2xl ${
        isCorrect ? "border-success" : "border-error"
      }`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isCorrect ? "bg-success/20" : "bg-error/20"
              }`}>
                {isCorrect ? (
                  <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <X className="h-6 w-6 text-error" />
                )}
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${isCorrect ? "text-success" : "text-error"}`}>
                  {isGuidedMode ? `Optimal: ${feedbackData.optimalAction.toUpperCase()}` : (isCorrect ? "Correct!" : "Not Optimal")}
                </h2>
                {!isGuidedMode && (
                  <p className="text-sm text-muted-foreground">
                    Your move: {feedbackData.playerAction.toUpperCase()} → Optimal: {feedbackData.optimalAction.toUpperCase()}
                  </p>
                )}
              </div>
            </div>
            <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Game State */}
          <div className="space-y-3">
            {/* Dealer and Player Cards - Side by Side */}
            <div className="flex items-center justify-center gap-4">
              {/* Dealer Hand */}
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Dealer Shows</div>
                <Badge variant="secondary" className="mb-2 text-base font-bold px-3 py-1">
                  {dealerValue}
                </Badge>
                <div className="flex justify-center scale-75">
                  <PlayingCard card={dealerUpcard} delay={0} owner="dealer" />
                </div>
              </div>

              {/* Player Hand */}
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Your Hand</div>
                <Badge variant="default" className="mb-2 text-base font-bold px-3 py-1 bg-primary">
                  {playerValue}
                </Badge>
                <div className={`flex justify-center scale-75 ${originalHand.length >= 2 ? "" : "gap-1"}`}>
                  {originalHand.map((card, index) => (
                    <div key={index} className={originalHand.length >= 2 && index > 0 ? (originalHand.length >= 4 ? "-ml-20" : "-ml-[42px] md:-ml-[45px]") : ""}>
                      <PlayingCard card={card} delay={0} owner="player" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Feedback - Matching buyback drill "try again" format exactly */}
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex gap-2 items-center">
                  <span className="text-xs font-mono bg-background px-2 py-1 rounded">
                    P: {playerValue} vs D: {dealerUpcard.rank}
                  </span>
                </div>
                {!isGuidedMode && (
                  <div className={`text-xs font-semibold ${
                    isCorrect ? "text-success" : "text-error"
                  }`}>
                    You: {feedbackData.playerAction.toUpperCase()} → Optimal: {feedbackData.optimalAction.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-primary">{feedbackData.tip}</p>
                <p className="text-xs text-muted-foreground whitespace-normal break-words">
                  {feedbackData.why || "Under current table rules, this choice has higher expected value."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={onClose} variant="default" className="flex-1 h-11 bg-primary">
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

