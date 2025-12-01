import { describe, expect, it } from "vitest"

import {
  dealCard,
  dealerShouldHitH17,
  ensureDeckHasCards,
  resolveSingleHand,
  resolveSplitHands,
} from "@/lib/game-engine"
import { getXPPerWinWithBet } from "@/lib/leveling-config"
import { type Card } from "@/lib/card-utils"

const card = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })

describe("game-engine helpers", () => {
  it("dealerShouldHitH17 follows H17 rules", () => {
    expect(dealerShouldHitH17([card("A"), card("6")])).toBe(true) // Soft 17 hits
    expect(dealerShouldHitH17([card("10"), card("7")])).toBe(false) // Hard 17 stands
    expect(dealerShouldHitH17([card("9"), card("7")])).toBe(true) // Hard 16 hits
    expect(dealerShouldHitH17([card("10"), card("8")])).toBe(false) // 18 stands
  })

  it("ensureDeckHasCards returns existing deck or reshuffles when empty", () => {
    const deck = [card("2"), card("3")]
    expect(ensureDeckHasCards(deck)).toBe(deck)

    const reshuffled = ensureDeckHasCards([])
    expect(reshuffled.length).toBeGreaterThan(0)
  })

  it("dealCard adds a card without mutating the original deck", () => {
    const deck = [card("2"), card("3")]
    const hand: Card[] = []
    const [newHand, newDeck] = dealCard(hand, deck)

    expect(newHand).toHaveLength(1)
    expect(newDeck).toHaveLength(deck.length - 1)
    expect(deck).toHaveLength(2) // original deck intact
  })
})

describe("resolveSingleHand", () => {
  it("resolves a player win with payout and xp", () => {
    const res = resolveSingleHand({
      playerHand: [card("10"), card("Q")],
      dealerHand: [card("9"), card("8")],
      baseBet: 10,
      isDoubled: false,
      level: 1,
    })

    expect(res.result).toBe("win")
    expect(res.payout).toBe(20)
    expect(res.totalBet).toBe(10)
    expect(res.winAmount).toBe(10)
    expect(res.winsDelta).toBe(1)
    expect(res.lossesDelta).toBe(0)
    expect(res.totalMovesDelta).toBe(1)
    expect(res.correctMovesDelta).toBe(1)
    expect(res.xpGain).toBe(getXPPerWinWithBet(1, 10))
  })

  it("resolves push without move delta or xp", () => {
    const res = resolveSingleHand({
      playerHand: [card("9"), card("8")],
      dealerHand: [card("10"), card("7")],
      baseBet: 10,
      isDoubled: false,
      level: 1,
    })

    expect(res.result).toBe("push")
    expect(res.winAmount).toBe(0)
    expect(res.totalMovesDelta).toBe(0)
    expect(res.xpGain).toBe(0)
  })

  it("treats player bust as loss even if dealer also busts", () => {
    const res = resolveSingleHand({
      playerHand: [card("Q"), card("4"), card("8")], // 22
      dealerHand: [card("K"), card("8"), card("6")], // 24
      baseBet: 10,
      isDoubled: false,
      level: 1,
    })

    expect(res.result).toBe("loss")
    expect(res.message).toBe("Bust! You Lose")
    expect(res.winAmount).toBe(-10)
  })

  it("resolves a doubled loss", () => {
    const res = resolveSingleHand({
      playerHand: [card("8"), card("8")],
      dealerHand: [card("10"), card("9")],
      baseBet: 15,
      isDoubled: true,
      level: 1,
    })

    expect(res.result).toBe("loss")
    expect(res.payout).toBe(0)
    expect(res.totalBet).toBe(30)
    expect(res.winAmount).toBe(-30)
    expect(res.lossesDelta).toBe(1)
    expect(res.xpGain).toBe(0)
  })
})

describe("resolveSplitHands", () => {
  it("handles mixed outcomes with correct payout, deltas, and xp", () => {
    const res = resolveSplitHands({
      hands: [
        { cards: [card("K"), card("8"), card("5")], bet: 10, doubled: false }, // bust
        { cards: [card("10"), card("9")], bet: 10, doubled: false }, // 19
      ],
      dealerHand: [card("10"), card("8")], // 18
      level: 1,
    })

    expect(res.message).toContain("Hand 1: Lose")
    expect(res.message).toContain("Hand 2: Win")
    expect(res.payout).toBe(20)
    expect(res.totalBet).toBe(20)
    expect(res.winAmount).toBe(0)
    expect(res.winsDelta).toBe(1)
    expect(res.lossesDelta).toBe(1)
    expect(res.totalMovesDelta).toBe(2)
    expect(res.correctMovesDelta).toBe(1)
    expect(res.xpGain).toBe(getXPPerWinWithBet(1, 10))
    expect(res.handsPlayedDelta).toBe(1)
  })
})
