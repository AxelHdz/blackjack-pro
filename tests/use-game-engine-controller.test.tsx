import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { useGameEngine, useGameEngineController, type RoundResolution } from "@/hooks/use-game-engine"
import { type Card } from "@/lib/card-utils"

const card = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })

const buildEngineWithController = (deck: Card[]) => {
  const resolutions: RoundResolution[] = []
  const hook = renderHook(() => {
    const engine = useGameEngine({ deck })
    const controller = useGameEngineController({
      state: engine.state,
      patchState: engine.patchState,
      level: 1,
      onRoundResolved: (res) => resolutions.push(res),
    })
    return { engine, controller }
  })

  return { ...hook, resolutions }
}

describe("useGameEngineController", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("wins a double-down hand and finishes the round", () => {
    // Deck pop order (from end): d1(5), d2(6) => 11; p1(9), p2(2) => 11; double(9) => 20; dealerHit1(5) =>16; dealerHit2(9) =>25 bust
    const deck = [card("9"), card("5"), card("9"), card("2"), card("9"), card("6"), card("5")]
    const { result, resolutions } = buildEngineWithController(deck)

    act(() => {
      result.current.controller.startHand(10)
    })
    act(() => vi.runAllTimers())

    act(() => {
      result.current.controller.doubleDown()
    })
    act(() => vi.runAllTimers())

    const lastResolution = resolutions[resolutions.length - 1]
    expect(lastResolution).toBeDefined()
    expect(lastResolution?.result).not.toBe("loss")
    expect(lastResolution?.totalBet).toBe(20)
    expect(result.current.engine.state.gameState).toBe("finished")
  })

  it("resolves split hands and plays out dealer", () => {
    // Deck pop order: d1(6), d2(10) =>16; p1(8), p2(8); split draw1(2), split draw2(3); dealerHit1(10) =>26 bust; spare card to avoid reshuffle
    const deck = [card("Q"), card("10"), card("3"), card("2"), card("8"), card("8"), card("10"), card("6")]
    const { result, resolutions } = buildEngineWithController(deck)

    act(() => {
      result.current.controller.startHand(10)
    })
    act(() => vi.runAllTimers())

    act(() => {
      result.current.controller.split()
    })
    act(() => {
      // Finish first hand
      result.current.controller.stand()
    })
    act(() => {
      // Finish second hand and trigger dealer play
      result.current.controller.stand()
    })
    act(() => vi.runAllTimers())

    expect(result.current.engine.state.gameState).toBe("finished")
    expect(result.current.engine.state.dealerRevealed).toBe(true)
  })

  it("auto-resolves a player blackjack on the initial deal", () => {
    // Pop order: dealer1, dealer2, player1, player2
    const deck = [card("K"), card("A"), card("8"), card("9")]
    const { result, resolutions } = buildEngineWithController(deck)

    act(() => {
      result.current.controller.startHand(10)
    })
    act(() => {
      vi.runAllTimers()
    })

    expect(resolutions).toHaveLength(1)
    const resolution = resolutions[0]
    expect(resolution.result).toBe("win")
    expect(resolution.message).toContain("Blackjack")
    expect(resolution.payout).toBeGreaterThan(10)
    expect(result.current.engine.state.gameState).toBe("finished")
  })

  it("resolves a bust when hitting over 21", () => {
    // Initial cards: dealer 9/5, player 10/6 -> hit draws K for 26
    const deck = [card("K"), card("6"), card("10"), card("5"), card("9")]
    const { result, resolutions } = buildEngineWithController(deck)

    act(() => {
      result.current.controller.startHand(5)
    })
    act(() => {
      vi.runAllTimers()
    })

    act(() => {
      result.current.controller.hit()
    })

    const lastResolution = resolutions[resolutions.length - 1]
    expect(lastResolution?.result).toBe("loss")
    expect(lastResolution?.message).toContain("Bust")
    expect(result.current.engine.state.gameState).toBe("finished")
  })
})
