import { describe, expect, it } from "vitest"

import { settle } from "@/lib/settlement"

describe("settlement", () => {
  it("pays blackjack at 3:2 on the base bet", () => {
    expect(settle({ result: "win", baseBet: 20, isDoubled: false, isBlackjack: true })).toBe(50)
  })

  it("handles wins, pushes, and losses with doubles", () => {
    expect(settle({ result: "win", baseBet: 10, isDoubled: true, isBlackjack: false })).toBe(40)
    expect(settle({ result: "push", baseBet: 10, isDoubled: true, isBlackjack: false })).toBe(20)
    expect(settle({ result: "loss", baseBet: 10, isDoubled: true, isBlackjack: false })).toBe(0)
  })
})
