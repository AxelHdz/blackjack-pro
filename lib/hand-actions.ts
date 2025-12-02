import { getCardValue, type Card } from "./card-utils"
import { tableRules, type TableRules } from "./strategy-config"

type HasHandMeta = {
  cards: Card[]
  doubled?: boolean
  isSplitAce?: boolean
}

export function isPairHand(hand: Card[]): boolean {
  return hand.length === 2 && getCardValue(hand[0]) === getCardValue(hand[1])
}

export function canSplit(hand: Card[]): boolean {
  return isPairHand(hand)
}

export function canDouble(
  hand: HasHandMeta,
  rules: Pick<TableRules, "doubleOnSplitAces"> = { doubleOnSplitAces: tableRules.doubleOnSplitAces },
): boolean {
  if (hand.cards.length !== 2) return false
  if (hand.doubled) return false
  if (!rules.doubleOnSplitAces && hand.isSplitAce) return false
  return true
}
