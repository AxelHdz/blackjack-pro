import { type Card, type GameAction, getCardValue, calculateHandValue, isSoftHand } from "./card-utils"
import { getTipMessage, getFeedbackMessage } from "./blackjack-strategy"

export type NormalizedUpcard = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "A"

// Normalize dealer upcard: map J,Q,K,10 → 10
export function normalizeUpcard(dealerCard: Card): NormalizedUpcard {
  const rank = dealerCard.rank
  if (rank === "A") return "A"
  if (["J", "Q", "K", "10"].includes(rank)) return 10
  return Number.parseInt(rank) as NormalizedUpcard
}

export interface FeedbackContext {
  playerHand: Card[]
  dealerUpcard: Card
  optimalMove: GameAction
  playerMove: GameAction
  tableVariant: "S17" | "H17"
}

export interface FeedbackResult {
  tip: string
  why: string
  templateMatchesOptimal: boolean
  selectedMessageKey: string
}

/**
 * Resolve drill feedback messages that match the engine's optimal move.
 * Uses normalized upcard and includes guardrail fallback if template contradicts engine.
 */
export function resolveFeedback(ctx: FeedbackContext): FeedbackResult {
  const normalizedUp = normalizeUpcard(ctx.dealerUpcard)
  const playerValue = calculateHandValue(ctx.playerHand)
  const isSoft = isSoftHand(ctx.playerHand)
  const isPair = ctx.playerHand.length === 2 && getCardValue(ctx.playerHand[0]) === getCardValue(ctx.playerHand[1])

  // Get the tip and feedback from the strategy engine
  const strategyTip = getTipMessage(ctx.playerHand, ctx.dealerUpcard)
  const strategyFeedback = getFeedbackMessage(ctx.playerHand, ctx.dealerUpcard)

  // Check if the strategy messages match the optimal move
  const moveKeywords = {
    hit: ["hit", "take a card", "draw", "improve"],
    stand: ["stand", "don't hit", "hold"],
    double: ["double", "doubling"],
    split: ["split", "splitting"],
  }

  const tipLower = strategyTip.toLowerCase()
  const feedbackLower = strategyFeedback.toLowerCase()
  const optimalLower = ctx.optimalMove.toLowerCase()

  // Check if the tip or feedback contains keywords for the optimal move
  const tipMatchesOptimal = moveKeywords[optimalLower].some((keyword) => tipLower.includes(keyword))
  const feedbackMatchesOptimal = moveKeywords[optimalLower].some((keyword) => feedbackLower.includes(keyword))

  // Generate message key for telemetry
  let messageKey = "unknown"
  if (isPair) {
    messageKey = `pair_${ctx.playerHand[0].rank}_vs_${normalizedUp}`
  } else if (isSoft) {
    messageKey = `soft_${playerValue}_vs_${normalizedUp}`
  } else {
    messageKey = `hard_${playerValue}_vs_${normalizedUp}`
  }
  messageKey += `_${ctx.optimalMove}`

  // Guardrail: if template doesn't match optimal move, use fallback
  if (!tipMatchesOptimal || !feedbackMatchesOptimal) {
    console.log(`[v0] Feedback mismatch detected for ${messageKey}. Using fallback.`)
    return {
      tip: `Optimal: ${ctx.optimalMove.toUpperCase()}.`,
      why: "Under current table rules, this choice has higher expected value.",
      templateMatchesOptimal: false,
      selectedMessageKey: messageKey + "_fallback",
    }
  }

  // Log telemetry
  console.log(`[v0] Feedback resolved: ${messageKey}, normalized_upcard: ${normalizedUp}, template_matches: true`)

  return {
    tip: strategyTip,
    why: strategyFeedback,
    templateMatchesOptimal: true,
    selectedMessageKey: messageKey,
  }
}
