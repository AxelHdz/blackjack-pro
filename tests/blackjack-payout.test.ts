import { describe, expect, it } from "vitest"

import { settle } from "@/lib/settlement"
import { useGameEngine } from "@/hooks/use-game-engine"
import { act, renderHook } from "@testing-library/react"
import { type Card } from "@/lib/card-utils"

const card = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })

describe("Blackjack payout", () => {
  it("settle pays 3:2 for blackjack", () => {
    const payout = settle({ result: "win", baseBet: 20, isDoubled: false, isBlackjack: true })
    expect(payout).toBe(50)
  })

  it("engine resolves player blackjack with message and payout", () => {
    // Pop order: d1(9), d2(6), p1(A), p2(K)
    const deck = [card("K"), card("A"), card("6"), card("9")]
    const { result } = renderHook(() => useGameEngine({ deck }))

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 20, level: 1 })
    })

    expect(result.current.resolution?.message).toContain("Blackjack")
    expect(result.current.resolution?.payout).toBe(50)
    expect(result.current.resolution?.winAmount).toBe(30)
    expect(result.current.state.gameState).toBe("finished")
  })
})
