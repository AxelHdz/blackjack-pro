import { type Card, calculateHandValue, isPair, isSoftHand } from "./card-utils"
import { getOptimalMove, type GameAction } from "./blackjack-strategy"

// EV (Expected Value) estimates for different actions
// These are approximate values based on basic strategy simulations
export interface ActionEVs {
  hit?: number
  stand?: number
  double?: number
  split?: number
}

export interface DecisionResult {
  correctAction: GameAction
  ev: ActionEVs
  legalActions: GameAction[]
}

export function getDecisionWithEV(playerHand: Card[], dealerUpCard: Card): DecisionResult {
  const correctAction = getOptimalMove(playerHand, dealerUpCard)
  const ev = calculateEVs(playerHand, dealerUpCard)
  const legalActions = getLegalActions(playerHand)

  return {
    correctAction,
    ev,
    legalActions,
  }
}

function getLegalActions(playerHand: Card[]): GameAction[] {
  const actions: GameAction[] = ["hit", "stand"]

  if (playerHand.length === 2) {
    actions.push("double")
    if (isPair(playerHand)) {
      actions.push("split")
    }
  }

  return actions
}

// Calculate approximate EVs for each action
function calculateEVs(playerHand: Card[], dealerUpCard: Card): ActionEVs {
  const playerValue = calculateHandValue(playerHand)
  const dealerValue = dealerUpCard.rank === "A" ? 11 : Math.min(10, Number.parseInt(dealerUpCard.rank) || 10)
  const isFirstTwoCards = playerHand.length === 2
  const isSoft = isSoftHand(playerHand)
  const pair = isPair(playerHand)

  const ev: ActionEVs = {}

  // These are simplified EV calculations based on common scenarios
  // In production, these would come from pre-computed lookup tables

  // Stand EV
  if (playerValue >= 17) {
    ev.stand = 0.1 // Standing on 17+ is usually decent
  } else if (playerValue >= 12 && dealerValue <= 6) {
    ev.stand = 0.05 // Dealer likely to bust
  } else if (playerValue >= 12) {
    ev.stand = -0.2 // Weak hand vs strong dealer
  } else {
    ev.stand = -0.5 // Very weak hand
  }

  // Hit EV
  if (playerValue <= 11) {
    ev.hit = 0.15 // Safe to hit
  } else if (playerValue === 12 && dealerValue <= 6) {
    ev.hit = -0.15 // Risky
  } else if (playerValue >= 17) {
    ev.hit = -0.3 // Too risky
  } else {
    ev.hit = dealerValue >= 7 ? 0.05 : -0.1
  }

  // Double EV (if allowed)
  if (isFirstTwoCards) {
    if (playerValue === 11) {
      ev.double = dealerValue === 11 ? 0.2 : 0.25 // 11 doubles against every upcard
    } else if (playerValue === 10) {
      ev.double = dealerValue <= 9 ? 0.2 : 0.05
    } else if (playerValue === 9) {
      ev.double = dealerValue >= 3 && dealerValue <= 6 ? 0.15 : -0.05
    } else if (isSoft) {
      if (playerValue === 19 && dealerValue === 6) {
        ev.double = 0.12
      } else if (playerValue === 18 && dealerValue >= 2 && dealerValue <= 6) {
        ev.double = 0.1
      } else if (playerValue === 17 && dealerValue >= 3 && dealerValue <= 6) {
        ev.double = 0.08
      } else if ((playerValue === 16 || playerValue === 15) && dealerValue >= 4 && dealerValue <= 6) {
        ev.double = 0.06
      } else if ((playerValue === 14 || playerValue === 13) && (dealerValue === 5 || dealerValue === 6)) {
        ev.double = 0.05
      } else {
        ev.double = -0.12
      }
    } else {
      ev.double = -0.15
    }
  }

  // Split EV (if pair)
  if (pair) {
    const cardValue = Math.min(10, Number.parseInt(playerHand[0].rank) || 10)
    if (cardValue === 11) {
      // Aces
      ev.split = 0.3 // Always great
    } else if (cardValue === 8) {
      ev.split = 0.15 // Always split
    } else if (cardValue === 9) {
      ev.split = dealerValue !== 7 && dealerValue <= 9 ? 0.1 : -0.05
    } else if (cardValue === 7 || cardValue === 3 || cardValue === 2) {
      ev.split = dealerValue <= 7 ? 0.05 : -0.1
    } else if (cardValue === 6) {
      ev.split = dealerValue <= 6 ? 0.05 : -0.15
    } else if (cardValue === 4) {
      ev.split = dealerValue === 5 || dealerValue === 6 ? 0.02 : -0.15
    } else {
      ev.split = -0.2 // Don't split 5s or 10s
    }
  }

  return ev
}

export function calculateCredit(optimalEV: number, bestWrongEV: number): number {
  return Math.max(0, optimalEV - bestWrongEV)
}

export function getBestWrongAction(ev: ActionEVs, correctAction: GameAction): { action: GameAction; ev: number } {
  let bestAction: GameAction = "hit"
  let bestEV = Number.NEGATIVE_INFINITY

  for (const [action, value] of Object.entries(ev)) {
    if (action !== correctAction && value !== undefined && value > bestEV) {
      bestEV = value
      bestAction = action as GameAction
    }
  }

  return { action: bestAction, ev: bestEV }
}
