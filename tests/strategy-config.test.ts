import { describe, it, expect } from "vitest"

import { getOptimalMove, getTipMessage, getFeedbackMessage } from "@/lib/blackjack-strategy"
import { type Card } from "@/lib/card-utils"

const card = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })
const up = (rank: Card["rank"]): Card => ({ rank, suit: "♦" })

describe("strategy config (H17)", () => {
  const cases: Array<{
    hand: Card[]
    dealer: Card
    expected: ReturnType<typeof getOptimalMove>
  }> = [
    // Hard
    { hand: [card("10"), card("2")], dealer: up("4"), expected: "stand" }, // 12 vs 4
    { hand: [card("10"), card("2")], dealer: up("2"), expected: "hit" }, // 12 vs 2
    { hand: [card("5"), card("4")], dealer: up("6"), expected: "double" }, // 9 vs 6
    { hand: [card("5"), card("4")], dealer: up("10"), expected: "hit" }, // 9 vs 10
    // Soft
    { hand: [card("A"), card("7")], dealer: up("6"), expected: "double" }, // A7 vs 6
    { hand: [card("A"), card("7")], dealer: up("9"), expected: "hit" }, // A7 vs 9
    // Pairs
    { hand: [card("8"), card("8")], dealer: up("10"), expected: "split" }, // 8,8 always split
    { hand: [card("9"), card("9")], dealer: up("7"), expected: "stand" }, // 9,9 vs 7 stand
    { hand: [card("4"), card("4")], dealer: up("6"), expected: "split" }, // 4,4 vs 6 split
  ]

  it.each(cases)("selects optimal move for %o", ({ hand, dealer, expected }) => {
    expect(getOptimalMove(hand, dealer)).toBe(expected)
  })

  it("injects double-unavailable wording when drawing past two cards", () => {
    const hand = [card("5"), card("4"), card("2")] // hard 11 but 3 cards
    const dealer = up("6")
    const tip = getTipMessage(hand, dealer)
    const feedback = getFeedbackMessage(hand, dealer)
    expect(tip.toLowerCase()).toContain("doubling isn't available")
    expect(feedback.toLowerCase()).toContain("doubling isn't available")
  })
})
