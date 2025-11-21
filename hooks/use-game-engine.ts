import { useReducer, useCallback } from "react"
import { createDeck, type Card as CardType } from "@/lib/card-utils"

export type EngineGameState = {
  deck: CardType[]
  playerHand: CardType[]
  dealerHand: CardType[]
  splitHand: CardType[]
  firstHandResult: { value: number; busted: boolean } | null
  firstHandCards: CardType[]
  gameState: "betting" | "playing" | "dealer" | "finished"
  activeBet: number
  initialBet: number
  isSplit: boolean
  currentHandIndex: number
  dealerRevealed: boolean
  isDealing: boolean
  showBustMessage: boolean
  viewHandIndex: number
  isDoubled: boolean
  message: string
}

type PatchPayload = Partial<EngineGameState>

type EngineAction =
  | { type: "PATCH"; payload: PatchPayload }
  | { type: "RESET_ROUND" }
  | { type: "RESET_ALL" }

const initialEngineState: EngineGameState = {
  deck: createDeck(),
  playerHand: [],
  dealerHand: [],
  splitHand: [],
  firstHandResult: null,
  firstHandCards: [],
  gameState: "betting",
  activeBet: 0,
  initialBet: 0,
  isSplit: false,
  currentHandIndex: 0,
  dealerRevealed: false,
  isDealing: false,
  showBustMessage: false,
  viewHandIndex: 0,
  isDoubled: false,
  message: "",
}

function engineReducer(state: EngineGameState, action: EngineAction): EngineGameState {
  switch (action.type) {
    case "PATCH":
      return { ...state, ...action.payload }
    case "RESET_ROUND":
      return {
        ...state,
        playerHand: [],
        dealerHand: [],
        splitHand: [],
        firstHandResult: null,
        firstHandCards: [],
        activeBet: 0,
        initialBet: 0,
        isSplit: false,
        currentHandIndex: 0,
        dealerRevealed: false,
        isDealing: false,
        showBustMessage: false,
        viewHandIndex: 0,
        isDoubled: false,
        gameState: "betting",
        message: "",
      }
    case "RESET_ALL":
      return { ...initialEngineState, deck: createDeck() }
    default:
      return state
  }
}

export function useGameEngine(initial: Partial<EngineGameState> = {}) {
  const [state, dispatch] = useReducer(engineReducer, { ...initialEngineState, ...initial })

  const patchState = useCallback((payload: PatchPayload) => dispatch({ type: "PATCH", payload }), [])
  const resetRoundState = useCallback(() => dispatch({ type: "RESET_ROUND" }), [])
  const resetAll = useCallback(() => dispatch({ type: "RESET_ALL" }), [])

  return {
    state,
    patchState,
    resetRoundState,
    resetAll,
  }
}
