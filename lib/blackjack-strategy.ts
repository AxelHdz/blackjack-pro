import { type Card, calculateHandValue, getCardValue, isSoftHand } from "./card-utils"
import { canDouble } from "./hand-actions"
import {
  hardRules,
  pairRules,
  softRules,
  tableRules,
  type DealerKey,
  type RuleCase,
  type TableRules,
} from "./strategy-config"

export type GameAction = "hit" | "stand" | "double" | "split"

interface StrategyRule {
  action: GameAction
  fallback: GameAction | null
  tip: string
  feedback: string
}

export type StrategyContext = {
  handMeta?: {
    doubled?: boolean
    isSplitAce?: boolean
  }
  rules?: Pick<TableRules, "doubleOnSplitAces">
}

type DoubleAvailability = {
  canDouble: boolean
  reason?: "post-draw" | "split-aces" | "already-doubled"
}

function getDealerKey(card: Card): DealerKey {
  if (card.rank === "A") return "A"
  if (["J", "Q", "K", "10"].includes(card.rank)) return 10
  return Number.parseInt(card.rank) as DealerKey
}

function isPair(playerHand: Card[]): boolean {
  if (playerHand.length !== 2) return false
  const v1 = getCardValue(playerHand[0])
  const v2 = getCardValue(playerHand[1])
  return v1 === v2
}

export function getOptimalMove(playerHand: Card[], dealerUpCard: Card, context: StrategyContext = {}): GameAction {
  const rule = getStrategyRule(playerHand, dealerUpCard)
  const doubleAvailability = getDoubleAvailability(playerHand, context)

  if (rule.action === "double" && !doubleAvailability.canDouble && rule.fallback) {
    return rule.fallback
  }

  return rule.action
}

export function getTipMessage(playerHand: Card[], dealerUpCard: Card, context: StrategyContext = {}): string {
  const rule = getStrategyRule(playerHand, dealerUpCard)
  const doubleAvailability = getDoubleAvailability(playerHand, context)
  return adjustMessageForDoubleAvailability(rule.tip, rule, doubleAvailability)
}

export function getFeedbackMessage(playerHand: Card[], dealerUpCard: Card, context: StrategyContext = {}): string {
  const rule = getStrategyRule(playerHand, dealerUpCard)
  const doubleAvailability = getDoubleAvailability(playerHand, context)
  return adjustMessageForDoubleAvailability(rule.feedback, rule, doubleAvailability)
}

function adjustMessageForDoubleAvailability(message: string, rule: StrategyRule, availability: DoubleAvailability): string {
  if (rule.action === "double" && !availability.canDouble && rule.fallback) {
    const fallbackAction = rule.fallback
    const fallbackDirective =
      fallbackAction === "stand"
        ? "stand instead."
        : fallbackAction === "hit"
          ? "hit instead."
          : `${fallbackAction} instead.`
    const restriction =
      availability.reason === "split-aces"
        ? "Doubling isn't allowed after splitting aces at this table"
        : availability.reason === "already-doubled"
          ? "Doubling again isn't available on this hand"
          : "Doubling isn't available after drawing cards"
    return `${message} ${restriction}, so ${fallbackDirective}`
  }

  return message
}

function getDoubleAvailability(playerHand: Card[], context: StrategyContext): DoubleAvailability {
  const rules = context.rules ?? { doubleOnSplitAces: tableRules.doubleOnSplitAces }
  const handMeta = context.handMeta ?? {}
  const allowed = canDouble(
    { cards: playerHand, doubled: handMeta.doubled, isSplitAce: handMeta.isSplitAce },
    rules,
  )

  if (allowed) {
    return { canDouble: true }
  }

  if (playerHand.length !== 2) {
    return { canDouble: false, reason: "post-draw" }
  }

  if (handMeta.doubled) {
    return { canDouble: false, reason: "already-doubled" }
  }

  if (!rules.doubleOnSplitAces && handMeta.isSplitAce) {
    return { canDouble: false, reason: "split-aces" }
  }

  return { canDouble: false }
}

function getStrategyRule(playerHand: Card[], dealerUpCard: Card): StrategyRule {
  const playerValue = calculateHandValue(playerHand)
  const dealerKey = getDealerKey(dealerUpCard)
  const isFirstTwoCards = playerHand.length === 2

  // Check pairs first
  if (isFirstTwoCards && isPair(playerHand)) {
    return getPairRule(playerHand[0], dealerKey)
  }

  // Check soft hands
  if (isSoftHand(playerHand)) {
    return getSoftHandRule(playerValue, dealerKey)
  }

  // Hard hands
  return getHardHandRule(playerValue, dealerKey)
}

function dealerMatches(cases: RuleCase[], dealerKey: DealerKey): RuleCase | undefined {
  return cases.find((c) => c.dealers === "any" || c.dealers.includes(dealerKey))
}

function toStrategyRule(matched: RuleCase): StrategyRule {
  return { action: matched.action, fallback: matched.fallback ?? null, tip: matched.tip, feedback: matched.feedback }
}

function getPairRule(card: Card, dealerKey: DealerKey): StrategyRule {
  const cardValue = getCardValue(card)
  const rule = pairRules.find((r) => r.pairValue === cardValue)
  const matched = rule ? dealerMatches(rule.cases, dealerKey) : undefined
  return matched ? toStrategyRule(matched) : defaultRule()
}

function getSoftHandRule(playerValue: number, dealerKey: DealerKey): StrategyRule {
  const rule = softRules.find((r) => r.total === playerValue)
  const matched = rule ? dealerMatches(rule.cases, dealerKey) : undefined
  if (matched) {
    return toStrategyRule(matched)
  }

  // Fallback for any other soft total
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your soft total—soft hands can't bust on one card.",
    feedback:
      "Soft hands can't bust on one card, so hitting gives you flexibility to build a winning total without risk. Keep drawing until you reach a strong total or the situation changes.",
  }
}

function getHardHandRule(playerValue: number, dealerKey: DealerKey): StrategyRule {
  const cappedValue = playerValue > 21 ? 21 : playerValue
  const rule = hardRules.find((r) => r.total === cappedValue)
  const matched = rule ? dealerMatches(rule.cases, dealerKey) : undefined
  if (matched) {
    return toStrategyRule(matched)
  }

  // Fallback
  return defaultRule()
}

function defaultRule(): StrategyRule {
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your hand.",
    feedback:
      "Hitting gives you a chance to improve your total and compete with the dealer. This increases your winning chances compared to standing on a weak hand.",
  }
}
