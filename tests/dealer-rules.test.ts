import { describe, expect, it } from "vitest"

import { type Card } from "@/lib/card-utils"
import { getDealerAction } from "@/lib/dealer-rules"

const card = (rank: Card["rank"], suit: Card["suit"] = "♠"): Card => ({ rank, suit })

describe("dealer action (H17/S17)", () => {
  it("stands on hard 17 in H17", () => {
    const hand: Card[] = [card("K"), card("7")]
    expect(getDealerAction(hand, "H17")).toBe("stand")
  })

  it("hits on soft 17 in H17", () => {
    const hand: Card[] = [card("A"), card("6")]
    expect(getDealerAction(hand, "H17")).toBe("hit")
  })

  it("hits below 17 regardless of softness", () => {
    const softHand: Card[] = [card("A"), card("5")]
    const hardHand: Card[] = [card("9"), card("6")]

    expect(getDealerAction(softHand, "H17")).toBe("hit")
    expect(getDealerAction(hardHand, "H17")).toBe("hit")
  })

  it("stands on 18+ including soft totals", () => {
    const soft18: Card[] = [card("A"), card("7")]
    const hard19: Card[] = [card("10"), card("9")]

    expect(getDealerAction(soft18, "H17")).toBe("stand")
    expect(getDealerAction(hard19, "H17")).toBe("stand")
  })

  it("stands on soft 17 in S17 tables", () => {
    const hand: Card[] = [card("A"), card("6")]
    expect(getDealerAction(hand, "S17")).toBe("stand")
  })
})
