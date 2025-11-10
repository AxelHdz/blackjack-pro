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

export function calculateHandValue(hand: Card[]): number {
  if (!Array.isArray(hand) || hand.length === 0) return 0

  let value = 0
  let aces = 0

  for (const card of hand) {
    const cardValue = getCardValue(card)
    value += cardValue
    if (card.rank === "A") aces++
  }

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

export function getHandValueInfo(hand: Card[]): { value: number; isSoft: boolean; hardValue: number } {
  if (!Array.isArray(hand) || hand.length === 0) return { value: 0, isSoft: false, hardValue: 0 }

  let value = 0
  let aces = 0

  for (const card of hand) {
    const cardValue = getCardValue(card)
    value += cardValue
    if (card.rank === "A") aces++
  }

  const originalAces = aces

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  // It's soft if we have at least one ace counted as 11
  const isSoft = originalAces > 0 && aces > 0

  // Hard value is the current value minus 10 for each ace still counted as 11
  const hardValue = isSoft ? value - 10 : value

  return { value, isSoft, hardValue }
}

export function isSoftHand(hand: Card[]): boolean {
  if (!Array.isArray(hand) || hand.length === 0) return false

  let value = 0
  let aces = 0

  for (const card of hand) {
    value += getCardValue(card)
    if (card.rank === "A") aces++
  }

  // Adjust for aces if over 21
  let acesUsedAs11 = aces
  while (value > 21 && acesUsedAs11 > 0) {
    value -= 10
    acesUsedAs11--
  }

  // It's soft if we have at least one ace AND at least one ace is still counted as 11
  return aces > 0 && acesUsedAs11 > 0 && value <= 21
}

export function isPair(hand: Card[]): boolean {
  if (!Array.isArray(hand) || hand.length !== 2) return false
  return getCardValue(hand[0]) === getCardValue(hand[1])
}
