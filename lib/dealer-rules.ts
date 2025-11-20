import { getHandValueInfo, type Card } from "./card-utils"

/**
 * Determine whether the dealer should hit or stand using H17 rules.
 *
 * H17: Dealer hits on soft 17, stands on hard 17 or higher.
 */
export function getDealerAction(hand: Card[]): "hit" | "stand" {
  const { value, isSoft } = getHandValueInfo(hand)

  if (value < 17) return "hit"
  if (value > 17) return "stand"

  // Exactly 17
  if (isSoft) return "hit"

  return "stand"
}
