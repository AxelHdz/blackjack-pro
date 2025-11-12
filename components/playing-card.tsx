"use client"

import type { Card } from "@/lib/card-utils"
import { cn } from "@/lib/utils"

interface PlayingCardProps {
  card: Card
  hidden?: boolean
  delay?: number
  owner?: "dealer" | "player"
}

export function PlayingCard({ card, hidden = false, delay = 0, owner = "player" }: PlayingCardProps) {
  const isRed = card.suit === "♥" || card.suit === "♦"
  const isFaceCard = ["J", "Q", "K"].includes(card.rank)

  return (
    <div
      className={cn(
        "relative w-28 h-36 md:w-[7.5rem] md:h-[10.5rem] rounded-xl border-2 border-gray-300 bg-white shadow-xl",
        "transition-all duration-500 ease-out hover:scale-105 hover:shadow-2xl",
      )}
      style={{
        animation:
          owner === "dealer"
            ? "dealerCardAppear 450ms cubic-bezier(0.22, 0.68, 0.36, 0.98) backwards"
            : "playerCardAppear 450ms cubic-bezier(0.22, 0.68, 0.36, 0.98) backwards",
        animationDelay: `${delay}ms`,
        willChange: "opacity, transform",
        transformOrigin: "center center",
      }}
    >
      {hidden ? (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-900 flex items-center justify-center">
          <div className="w-full h-full p-3 flex items-center justify-center">
            <div className="w-full h-full rounded-lg border-2 border-blue-400/40 bg-blue-700/30" />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col">
          {/* Top-left rank and suit */}
          <div className="absolute top-1 left-1.5 md:top-1.5 md:left-2 flex flex-col items-center">
            <div className={cn("text-xl md:text-xl font-bold leading-none", isRed ? "text-red-600" : "text-gray-900")}>
              {card.rank}
            </div>
            <div className={cn("text-xl md:text-xl leading-none -mt-0.5", isRed ? "text-red-600" : "text-gray-900")}>
              {card.suit}
            </div>
          </div>

          {/* Center suit symbols for number cards */}
          {!isFaceCard && card.rank !== "A" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn("text-5xl md:text-5xl", isRed ? "text-red-600" : "text-gray-900")}>{card.suit}</div>
            </div>
          )}

          {/* Center suit for Ace */}
          {card.rank === "A" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn("text-6xl md:text-6xl", isRed ? "text-red-600" : "text-gray-900")}>{card.suit}</div>
            </div>
          )}

          {/* Face card center display */}
          {isFaceCard && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className={cn("text-5xl md:text-5xl font-bold", isRed ? "text-red-600" : "text-gray-900")}>
                  {card.rank}
                </div>
                <div className={cn("text-4xl md:text-4xl", isRed ? "text-red-600" : "text-gray-900")}>{card.suit}</div>
              </div>
            </div>
          )}

          {/* Bottom-right rank and suit - mirrored */}
          <div className="absolute bottom-1 right-1.5 md:bottom-1.5 md:right-2 flex flex-col items-center rotate-180">
            <div className={cn("text-xl md:text-xl font-bold leading-none", isRed ? "text-red-600" : "text-gray-900")}>
              {card.rank}
            </div>
            <div className={cn("text-xl md:text-xl leading-none -mt-0.5", isRed ? "text-red-600" : "text-gray-900")}>
              {card.suit}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
