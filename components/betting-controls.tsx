"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface BettingControlsProps {
  currentBet: number
  balance: number
  onBetChange: (bet: number) => void
  onDeal: () => void
  disabled?: boolean
}

interface CasinoChipProps {
  value: number
  color: string
  borderColor: string
  isSelected: boolean
  onClick: () => void
  disabled: boolean
}

function CasinoChip({ value, color, borderColor, isSelected, onClick, disabled }: CasinoChipProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative w-16 h-16 md:w-20 md:h-20 rounded-full
        flex items-center justify-center
        transition-all duration-200
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-110 active:scale-95"}
        ${isSelected ? "ring-4 ring-primary ring-offset-2 ring-offset-background scale-105" : ""}
      `}
      style={{
        background: `radial-gradient(circle at 30% 30%, ${color}, ${borderColor})`,
        boxShadow: isSelected
          ? `0 8px 16px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)`
          : `0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.2)`,
      }}
    >
      {/* Outer ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `4px solid ${borderColor}`,
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.2)",
        }}
      />

      {/* Inner decorative ring */}
      <div
        className="absolute inset-2 rounded-full border-2 border-dashed"
        style={{ borderColor: "rgba(255,255,255,0.3)" }}
      />

      {/* Value display */}
      <div className="relative z-10 text-center">
        <div className="text-xs md:text-sm font-bold text-white drop-shadow-lg">$</div>
        <div className="text-lg md:text-2xl font-bold text-white drop-shadow-lg leading-none">{value}</div>
      </div>
    </button>
  )
}

export function BettingControls({ currentBet, balance, onBetChange, onDeal, disabled = false }: BettingControlsProps) {
  const chips = [
    { value: 5, color: "#DC2626", borderColor: "#991B1B" }, // Red
    { value: 10, color: "#2563EB", borderColor: "#1E40AF" }, // Blue
    { value: 25, color: "#16A34A", borderColor: "#15803D" }, // Green
    { value: 50, color: "#EA580C", borderColor: "#C2410C" }, // Orange
    { value: 100, color: "#1F2937", borderColor: "#111827" }, // Black
    { value: 500, color: "#9333EA", borderColor: "#7E22CE" }, // Purple
  ]

  return (
    <Card className="border-2">
      <CardContent className="p-3 md:p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm text-muted-foreground">Place Your Bet</span>
            <span className="text-xl md:text-2xl font-bold text-primary">${currentBet}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-4 place-items-center py-2">
            {chips.map((chip) => (
              <CasinoChip
                key={chip.value}
                value={chip.value}
                color={chip.color}
                borderColor={chip.borderColor}
                isSelected={currentBet === chip.value}
                onClick={() => onBetChange(chip.value)}
                disabled={chip.value > balance || disabled}
              />
            ))}
          </div>

          <Button
            onClick={onDeal}
            size="lg"
            className="w-full h-11 md:h-12 text-base"
            disabled={currentBet > balance || disabled}
          >
            Deal Cards
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
