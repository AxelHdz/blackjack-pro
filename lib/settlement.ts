export function settle({
  result,
  baseBet,
  isDoubled,
  isBlackjack,
}: {
  result: "win" | "push" | "loss"
  baseBet: number
  isDoubled: boolean
  isBlackjack: boolean
}): number {
  const wager = baseBet * (isDoubled ? 2 : 1)

  // Blackjack pays 3:2 on base bet only
  if (isBlackjack) return Number((baseBet * 2.5).toFixed(2))

  // Regular win: return 2x wager
  if (result === "win") return Number((2 * wager).toFixed(2))

  // Push: return wager
  if (result === "push") return Number(wager.toFixed(2))

  // Loss: return 0
  return 0
}
