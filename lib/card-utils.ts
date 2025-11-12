export type Suit = "♠" | "♥" | "♦" | "♣"
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K"

export interface Card {
  suit: Suit
  rank: Rank
}

export function createDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"]
  const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
  const deck: Card[] = []

  // Create 6 decks for more realistic casino play
  for (let i = 0; i < 6; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank })
      }
    }
  }

  // Shuffle the deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

export function getCardValue(card: Card): number {
  if (card.rank === "A") return 11
  if (["J", "Q", "K"].includes(card.rank)) return 10
  return Number.parseInt(card.rank)
}

function evaluateHandTotals(hand: Card[]): { total: number; softAces: number; aceCount: number } {
  if (!Array.isArray(hand) || hand.length === 0) {
    return { total: 0, softAces: 0, aceCount: 0 }
  }

  let total = 0
  let aceCount = 0

  for (const card of hand) {
    total += getCardValue(card)
    if (card.rank === "A") aceCount++
  }

  let softAces = aceCount
  while (total > 21 && softAces > 0) {
    total -= 10
    softAces--
  }

  return { total, softAces, aceCount }
}

export function calculateHandValue(hand: Card[]): number {
  return evaluateHandTotals(hand).total
}

export function getHandValueInfo(hand: Card[]): { value: number; isSoft: boolean; hardValue: number } {
  const { total, softAces, aceCount } = evaluateHandTotals(hand)
  const isSoft = aceCount > 0 && softAces > 0
  const hardValue = total - softAces * 10

  return { value: total, isSoft, hardValue }
}

export function isSoftHand(hand: Card[]): boolean {
  return evaluateHandTotals(hand).softAces > 0
}

export function isPair(hand: Card[]): boolean {
  if (!Array.isArray(hand) || hand.length !== 2) return false
  return getCardValue(hand[0]) === getCardValue(hand[1])
}
