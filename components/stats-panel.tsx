"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Hash } from "lucide-react"

interface StatsPanelProps {
  balance: number
  totalWinnings: number
  handsPlayed: number
  wins?: number
  losses?: number
}

export function StatsPanel({ balance, totalWinnings, handsPlayed, wins = 0, losses = 0 }: StatsPanelProps) {
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "0.0"

  return (
    <div className="grid grid-cols-2 gap-2 md:gap-3">
      <Card className="border-2">
        <CardContent className="p-2.5 md:p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="text-xs font-medium">Balance</span>
          </div>
          <p className="text-lg md:text-xl font-bold mb-2">${balance}</p>

          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
            {totalWinnings >= 0 ? (
              <TrendingUp className="h-3 w-3 md:h-3.5 md:w-3.5 text-primary" />
            ) : (
              <TrendingDown className="h-3 w-3 md:h-3.5 md:w-3.5 text-destructive" />
            )}
            <span className="text-xs font-medium">Winnings</span>
          </div>
          <p className={`text-base md:text-lg font-bold ${totalWinnings >= 0 ? "text-primary" : "text-destructive"}`}>
            {totalWinnings >= 0 ? "+" : ""}${totalWinnings}
          </p>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="p-2.5 md:p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Hash className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="text-xs font-medium">Hands</span>
          </div>
          <p className="text-lg md:text-xl font-bold mb-2">{handsPlayed}</p>

          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
            <TrendingUp className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <span className="text-xs font-medium">Win Rate</span>
          </div>
          <p className="text-base md:text-lg font-bold">{winRate}%</p>
        </CardContent>
      </Card>
    </div>
  )
}
