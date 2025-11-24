import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import { animateDealerPlay, useGameEngine } from "@/hooks/use-game-engine"
import { type Card } from "@/lib/card-utils"

const card = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })

const createEngine = (deck: Card[]) => renderHook(() => useGameEngine({ deck }))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe("useGameEngine actions", () => {
  it("deals a hand and sets round metadata", () => {
    const deck = [card("5"), card("6"), card("9"), card("8")] // last -> dealer1
    const { result } = createEngine(deck)

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 10, level: 3 })
    })

    expect(result.current.state.gameState).toBe("playing")
    expect(result.current.state.activeBet).toBe(10)
    expect(result.current.state.roundLevel).toBe(3)
    expect(result.current.state.playerHand).toHaveLength(2)
    expect(result.current.state.dealerHand).toHaveLength(2)
  })

  it("handles double-down resolution", () => {
    // Pop order: d1(5), d2(6), p1(9), p2(2), double(9), dealerHit1(5), dealerHit2(9) => dealer bust
    const deck = [card("9"), card("5"), card("9"), card("2"), card("9"), card("6"), card("5")]
    const { result } = createEngine(deck)

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 10, level: 1 })
    })
    act(() => {
      result.current.dispatch({ type: "DOUBLE" })
    })
    act(() => {
      animateDealerPlay({ state: result.current.state, dispatch: result.current.dispatch, delayMs: 1 })
      vi.runAllTimers()
    })

    expect(result.current.resolution?.result).not.toBe("loss")
    expect(result.current.state.gameState).toBe("finished")
  })

  it("plays a split hand through dealer resolution", () => {
    // Pop order: d1(6), d2(10), p1(8), p2(8), split draw1(2), split draw2(3), dealerHit1(10), filler(5)
    const deck = [card("5"), card("10"), card("3"), card("2"), card("8"), card("8"), card("10"), card("6")]
    const { result } = createEngine(deck)

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 10, level: 1 })
    })
    act(() => {
      result.current.dispatch({ type: "SPLIT" })
    })
    act(() => {
      // finish both hands
      result.current.dispatch({ type: "STAND" })
      result.current.dispatch({ type: "STAND" })
    })
    act(() => {
      animateDealerPlay({ state: result.current.state, dispatch: result.current.dispatch, delayMs: 1 })
      vi.runAllTimers()
    })

    expect(result.current.state.gameState).toBe("finished")
    expect(result.current.resolution).toBeTruthy()
  })

  it("treats player bust as loss even if dealer has lower total", () => {
    // Player: 3,6,4,K (23) vs dealer 20
    const deck = [card("Q"), card("K"), card("K"), card("4"), card("6"), card("3")]
    const { result } = createEngine(deck)

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 25, level: 1 })
    })
    act(() => {
      result.current.dispatch({ type: "HIT" }) // draws 4
    })
    act(() => {
      result.current.dispatch({ type: "HIT" }) // draws K -> bust
    })

    expect(result.current.state.gameState).toBe("finished")
    expect(result.current.resolution?.result).toBe("loss")
    expect(result.current.resolution?.winAmount).toBe(-25)
  })

  it("does not draw dealer cards after a player bust, only reveals the hole card", () => {
    // Pop order: d1(6), d2(K), p1(Q), p2(4), hit(8 -> bust)
    const deck = [card("8"), card("4"), card("Q"), card("K"), card("6")]
    const { result } = createEngine(deck)

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 10, level: 1 })
    })
    act(() => {
      result.current.dispatch({ type: "HIT" }) // draws 8 -> bust at 22
    })

    expect(result.current.state.gameState).toBe("finished")
    expect(result.current.resolution?.result).toBe("loss")
    expect(result.current.state.dealerHand).toHaveLength(2)
    expect(result.current.state.dealerRevealed).toBe(true)
  })

  it("standing on a bust hand resolves as loss", () => {
    // Player: 5,8,10 (23) vs dealer 20
    const deck = [card("10"), card("5"), card("10"), card("8"), card("5"), card("J")]
    const { result } = createEngine(deck)

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 50, level: 1 })
    })
    act(() => {
      result.current.dispatch({ type: "HIT" }) // draws 8, total 23
    })
    act(() => {
      result.current.dispatch({ type: "STAND" })
    })

    expect(result.current.state.gameState).toBe("finished")
    expect(result.current.resolution?.result).toBe("loss")
    expect(result.current.resolution?.winAmount).toBe(-50)
  })

  it("double on first split hand busts only that hand then plays second", () => {
    // d1(6), d2(10), p1(8), p2(8), double draws K -> 18 (not bust), proceed to hand 2
    const deck = [card("5"), card("10"), card("K"), card("8"), card("8"), card("10"), card("6")]
    const { result } = createEngine(deck)

    act(() => {
      result.current.dispatch({ type: "DEAL", bet: 10, level: 1 })
    })
    act(() => {
      result.current.dispatch({ type: "SPLIT" })
    })
    act(() => {
      result.current.dispatch({ type: "DOUBLE" }) // first hand double
    })
    expect(result.current.state.currentHandIndex).toBe(1)
    expect(result.current.state.gameState).toBe("playing")
  })
})
