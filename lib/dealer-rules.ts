import { getHandValueInfo, type Card } from "./card-utils"

export type TableVariant = "H17" | "S17"

/**
 * Determine whether the dealer should hit or stand based on the table rules.
 *
 * H17: Dealer hits on soft 17, stands on hard 17 or higher.
 * S17: Dealer stands on all 17 values (soft or hard).
 */
export function getDealerAction(hand: Card[], tableVariant: TableVariant): "hit" | "stand" {
  const { value, isSoft } = getHandValueInfo(hand)

  if (value < 17) return "hit"
  if (value > 17) return "stand"

  // Exactly 17
  if (tableVariant === "H17" && isSoft) return "hit"

  return "stand"
}
