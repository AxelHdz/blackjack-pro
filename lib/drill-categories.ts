import { type Card, calculateHandValue, isSoftHand, getCardValue } from "@/lib/card-utils"

export type DrillCategory =
  | "hard_12_16_vs_2_6"
  | "hard_12_16_vs_7_A"
  | "soft_double_core"
  | "soft18_exceptions"
  | "pair_splits_core"
  | "double_9_10_11"
  | "other"

export function categorizeHand(playerHand: Card[], dealerUpcard: Card): DrillCategory {
  const playerValue = calculateHandValue(playerHand)
  const isSoft = isSoftHand(playerHand)
  const dealerValue = getCardValue(dealerUpcard)
  const isPair = playerHand.length === 2 && getCardValue(playerHand[0]) === getCardValue(playerHand[1])

  // Check pairs first
  if (isPair) {
    return "pair_splits_core"
  }

  // Soft hands
  if (isSoft && playerValue <= 19) {
    if (playerValue === 18) {
      // A,7 exceptions
      if ([9, 10, 11].includes(dealerValue) || [3, 4, 5, 6].includes(dealerValue)) {
        return "soft18_exceptions"
      }
    }
    // Soft doubles A,2-A,7
    if (playerValue >= 13 && playerValue <= 18 && dealerValue >= 3 && dealerValue <= 6) {
      return "soft_double_core"
    }
  }

  // Hard hands
  if (!isSoft) {
    // 9/10/11 doubles
    if ([9, 10, 11].includes(playerValue)) {
      return "double_9_10_11"
    }

    // Hard 12-16
    if (playerValue >= 12 && playerValue <= 16) {
      if (dealerValue >= 2 && dealerValue <= 6) {
        return "hard_12_16_vs_2_6"
      }
      if (dealerValue >= 7) {
        return "hard_12_16_vs_7_A"
      }
    }
  }

  return "other"
}

export function getCategoryTip(category: DrillCategory, playerHand: Card[], dealerUpcard: Card): string {
  const playerValue = calculateHandValue(playerHand)
  const dealerValue = getCardValue(dealerUpcard)
  const dealerRank = dealerUpcard.rank === "A" ? "A" : dealerUpcard.rank

  switch (category) {
    case "hard_12_16_vs_2_6":
      return `Stand ${playerValue} vs ${dealerRank}—dealer bust rate is high.`
    case "hard_12_16_vs_7_A":
      return `Hit ${playerValue} vs ${dealerRank}—dealer's strong upcard requires improvement.`
    case "soft_double_core":
      return `Double soft ${playerValue} vs ${dealerRank}—many live outs plus dealer bust odds.`
    case "soft18_exceptions":
      if ([9, 10, 11].includes(dealerValue)) {
        return `A,7 hits vs ${dealerRank}—18 trails strong dealer upcards.`
      }
      return `A,7 doubles vs ${dealerRank}—good spot for aggressive play.`
    case "pair_splits_core":
      return `Follow pair rules—split, stand, or double based on basic strategy.`
    case "double_9_10_11":
      return `Double ${playerValue} vs ${dealerRank}—high starting total wins often.`
    default:
      return "Follow basic strategy for optimal EV."
  }
}

export function getCategoryWhy(category: DrillCategory, playerHand: Card[], dealerUpcard: Card): string {
  const playerValue = calculateHandValue(playerHand)
  const dealerValue = getCardValue(dealerUpcard)

  switch (category) {
    case "hard_12_16_vs_2_6":
      return "Small dealer upcards bust more often; hitting risks breaking your hand for little EV gain."
    case "hard_12_16_vs_7_A":
      return "Dealer's strong upcards put you behind; taking a card gives outs to improve."
    case "soft_double_core":
      return "You have many live outs plus dealer bust odds; one-card double has positive EV."
    case "soft18_exceptions":
      if ([9, 10, 11].includes(dealerValue)) {
        return "Against strong upcards, 18 is often trailing; hitting recovers EV that standing leaves."
      }
      return "Doubling against mid-range dealer cards captures the edge with your flexible hand."
    case "pair_splits_core":
      return "Optimal pair strategy balances splitting for better hands vs standing/doubling with good totals."
    case "double_9_10_11":
      return "High starting totals win often with a one-card draw; doubling captures that edge."
    default:
      return "Basic strategy maximizes long-term expected value across all decisions."
  }
}
