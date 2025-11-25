import { type Card, getCardValue, calculateHandValue, isSoftHand } from "./card-utils"
import { getTipMessage, getFeedbackMessage, type GameAction } from "./blackjack-strategy"

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
  const moveKeywords: Record<GameAction, string[]> = {
    hit: ["hit", "take a card", "draw", "improve"],
    stand: ["stand", "don't hit", "hold"],
    double: ["double", "doubling"],
    split: ["split", "splitting"],
  }

  const tipLower = strategyTip.toLowerCase()
  const feedbackLower = strategyFeedback.toLowerCase()
  const optimalMove = ctx.optimalMove

  // Check if the tip or feedback contains keywords for the optimal move
  const tipMatchesOptimal = moveKeywords[optimalMove].some((keyword) => tipLower.includes(keyword))
  const feedbackMatchesOptimal = moveKeywords[optimalMove].some((keyword) => feedbackLower.includes(keyword))

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
  // Use detailed feedback if EITHER tip or feedback matches (not both)
  // This ensures we show detailed explanations even if one message doesn't contain keywords
  if (!tipMatchesOptimal && !feedbackMatchesOptimal) {
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

  // Generate feedback specific to the player's actual move
  // If the player's move doesn't match the optimal move, tailor the feedback
  const finalTip = strategyTip
  let finalWhy = strategyFeedback

  // If the player's move doesn't match optimal, generate specific feedback
  if (ctx.playerMove !== ctx.optimalMove) {
    // Always generate player-specific feedback when moves don't match
    finalWhy = generatePlayerMoveFeedback(
      ctx.playerMove,
      ctx.optimalMove,
      strategyFeedback,
      playerValue,
      isSoft,
      isPair,
    )
  }

  return {
    tip: finalTip,
    why: finalWhy,
    templateMatchesOptimal: true,
    selectedMessageKey: messageKey,
  }
}

/**
 * Generate feedback explaining why the player's specific move was wrong
 */
function generatePlayerMoveFeedback(
  playerMove: GameAction,
  optimalMove: GameAction,
  optimalFeedback: string,
  playerValue: number,
  isSoft: boolean,
  isPair: boolean,
): string {
  // If the optimal feedback already explains why the player's move is wrong, use it
  // Otherwise, generate a specific explanation

  const moveExplanations: Record<GameAction, Partial<Record<GameAction, string>>> = {
    hit: {
      stand:
        playerValue >= 17 && playerValue <= 20
          ? `Hitting on ${playerValue}${isSoft ? " (soft)" : ""} is too risky. ${playerValue} is already a strong hand that beats most dealer outcomes. Taking another card significantly increases your bust risk (you can only improve to 21, but risk busting on any card 2 or higher) without enough benefit.`
          : `Hitting on ${playerValue}${isSoft ? " (soft)" : ""} is too risky here. ${playerValue} is strong enough to beat the dealer's likely outcomes. Taking another card increases your bust risk without enough benefit.`,
      double: `Hitting here wastes the opportunity to double down. Doubling maximizes your win when you have an advantage, while hitting only bets the original amount.`,
      split: isPair
        ? `Hitting on a pair wastes the chance to split. Splitting creates two hands, each with better winning potential than hitting the pair together.`
        : `Hitting isn't optimal here. The optimal move would give you better expected value.`,
    },
    stand: {
      hit: `Standing on ${playerValue}${isSoft ? " (soft)" : ""} is too conservative. You need to improve your hand to have a better chance of winning. The dealer's upcard suggests you should take another card.`,
      double: `Standing wastes the opportunity to double down. Doubling maximizes your win when you have an advantage, while standing only bets the original amount.`,
      split: isPair
        ? `Standing on a pair wastes the chance to split. Splitting creates two hands, each with better winning potential than standing on the pair.`
        : `Standing isn't optimal here. The optimal move would give you better expected value.`,
    },
    double: {
      hit: `Doubling isn't available here (you've already drawn cards), so you should hit instead.`,
      stand: `Doubling isn't available here (you've already drawn cards), so you should stand instead.`,
      split: isPair
        ? `Doubling on a pair wastes the chance to split. Splitting creates two hands, each with better winning potential than doubling on the pair.`
        : `Doubling isn't optimal here. The optimal move would give you better expected value.`,
    },
    split: {
      hit: isPair
        ? `Splitting this pair isn't optimal. ${optimalFeedback.includes("split") ? "" : "You should hit instead to improve your hand."}`
        : `Splitting isn't available here (not a pair). You should hit instead.`,
      stand: isPair
        ? `Splitting this pair isn't optimal. ${optimalFeedback.includes("split") ? "" : "You should stand instead on this strong hand."}`
        : `Splitting isn't available here (not a pair). You should stand instead.`,
      double: isPair
        ? `Splitting this pair isn't optimal. ${optimalFeedback.includes("split") ? "" : "You should double instead to maximize your advantage."}`
        : `Splitting isn't optimal here. The optimal move would give you better expected value.`,
    },
  }

  // Return specific explanation if available, otherwise use the optimal feedback
  if (moveExplanations[playerMove] && moveExplanations[playerMove][optimalMove]) {
    return moveExplanations[playerMove][optimalMove]
  }

  // Fallback: use the optimal feedback but frame it as why the player's move was wrong
  return optimalFeedback
}
