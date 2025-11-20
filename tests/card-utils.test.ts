import { calculateHandValue, createDeck, isPair, isSoftHand, type Card } from "@/lib/card-utils"
import { describe, expect, it } from "vitest"

const makeCard = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })

describe("card-utils", () => {
  it("builds six full shuffled decks with even distribution", () => {
    const deck = createDeck()
    const counts = new Map<string, number>()

    for (const card of deck) {
      const key = `${card.rank}-${card.suit}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    expect(deck).toHaveLength(52 * 6)
    expect(counts.size).toBe(52)
    expect([...counts.values()].every((count) => count === 6)).toBe(true)
  })

  it("handles soft ace logic when calculating values", () => {
    const soft21 = [makeCard("A"), makeCard("9"), makeCard("A")]
    const hard20 = [makeCard("A"), makeCard("A"), makeCard("9"), makeCard("9")]

    expect(calculateHandValue(soft21)).toBe(21)
    expect(isSoftHand(soft21)).toBe(true)

    expect(calculateHandValue(hard20)).toBe(20)
    expect(isSoftHand(hard20)).toBe(false)
  })

  it("detects pairs based on value", () => {
    const tens = [makeCard("10"), makeCard("K")]
    const mixed = [makeCard("10"), makeCard("9")]

    expect(isPair(tens)).toBe(true)
    expect(isPair(mixed)).toBe(false)
  })
})
