import { getOptimalMove, type GameAction } from "@/lib/blackjack-strategy"
import { type Card } from "@/lib/card-utils"
import { describe, expect, it } from "vitest"

const card = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })

const expectMove = (player: Card[], dealer: Card, expected: GameAction) => {
  expect(getOptimalMove(player, dealer)).toBe(expected)
}

describe("blackjack-strategy getOptimalMove", () => {
  it("hits hard 16 against strong dealer upcards", () => {
    expectMove([card("9"), card("7")], card("K"), "hit")
  })

  it("splits eights against a 10", () => {
    expectMove([card("8"), card("8")], card("Q"), "split")
  })

  it("doubles soft 18 against a weak dealer upcard", () => {
    expectMove([card("A"), card("7")], card("6"), "double")
  })

  it("hits soft 18 against strong dealer upcards", () => {
    expectMove([card("A"), card("7")], card("A"), "hit")
  })

  it("doubles hard 11 even versus an Ace", () => {
    expectMove([card("6"), card("5")], card("A"), "double")
  })

  it("falls back to a hit when doubling is not available after drawing", () => {
    expectMove([card("5"), card("3"), card("2")], card("9"), "hit")
  })

  it("uses fallback when doubling split aces is disallowed", () => {
    expect(getOptimalMove([card("A"), card("7")], card("6"), { handMeta: { isSplitAce: true } })).toBe("stand")
  })
})
