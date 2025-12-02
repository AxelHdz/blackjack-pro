import { useReducer } from "react"

import { calculateHandValue, createDeck, getCardValue, type Card as CardType } from "@/lib/card-utils"
import {
  dealCard,
  dealerShouldHitH17,
  ensureDeckHasCards,
  resolveHands,
  type PlayerHandState,
  type SingleHandResolution,
  type SplitHandResolution,
} from "@/lib/game-engine"
import { canDouble, canSplit } from "@/lib/hand-actions"
import { tableRules } from "@/lib/strategy-config"
import { settle } from "@/lib/settlement"

export type EngineGameState = {
  deck: CardType[]
  dealerHand: CardType[]
  hands: PlayerHandState[]
  currentHandIndex: number
  gameState: "betting" | "playing" | "dealer" | "finished"
  initialBet: number
  dealerRevealed: boolean
  isDealing: boolean
  viewHandIndex: number
  message: string
  roundLevel: number
}

export type RoundResolution = SingleHandResolution | SplitHandResolution

type EngineContainer = {
  state: EngineGameState
  resolution: RoundResolution | null
}

export type EngineAction =
  | { type: "DEAL"; bet: number; level: number }
  | { type: "HIT" }
  | { type: "STAND" }
  | { type: "DOUBLE" }
  | { type: "SPLIT" }
  | { type: "HYDRATE"; payload: Partial<EngineGameState> }
  | { type: "SET_RESOLUTION"; resolution: RoundResolution; statePatch?: Partial<EngineGameState> }
  | { type: "CLEAR_RESOLUTION" }
  | { type: "RESET_ROUND" }

const initialEngineState: EngineGameState = {
  deck: createDeck(),
  dealerHand: [],
  hands: [],
  currentHandIndex: 0,
  gameState: "betting",
  initialBet: 0,
  dealerRevealed: false,
  isDealing: false,
  viewHandIndex: 0,
  message: "",
  roundLevel: 1,
}

function playDealerToEnd(dealerHand: CardType[], deck: CardType[]) {
  let currentDealer = [...dealerHand]
  let currentDeck = [...deck]

  while (dealerShouldHitH17(currentDealer)) {
    currentDeck = ensureDeckHasCards(currentDeck)
    const [newHand, newDeck] = dealCard(currentDealer, currentDeck)
    currentDealer = newHand
    currentDeck = newDeck
  }

  return { dealerHand: currentDealer, deck: currentDeck }
}

function allHandsBust(hands: PlayerHandState[]): boolean {
  return hands.every((hand) => calculateHandValue(hand.cards) > 21)
}

function resolveRoundImmediate(hands: PlayerHandState[], dealerHand: CardType[], roundLevel: number): RoundResolution {
  return resolveHands({ hands, dealerHand, level: roundLevel })
}

function handleDeal(state: EngineGameState, bet: number, level: number): EngineContainer {
  if (state.gameState !== "betting" || bet <= 0) {
    return { state, resolution: null }
  }

  let deckCopy = ensureDeckHasCards([...state.deck])

  const [dealerHand1, deck1] = dealCard([], deckCopy)
  const [dealerHand2, deck2] = dealCard(dealerHand1, deck1)
  const [playerHand1, deck3] = dealCard([], deck2)
  const [playerHand2, deck4] = dealCard(playerHand1, deck3)

  const newHand: PlayerHandState = {
    cards: playerHand2,
    bet,
    doubled: false,
  }

  const newState: EngineGameState = {
    ...state,
    deck: deck4,
    dealerHand: dealerHand2,
    hands: [newHand],
    currentHandIndex: 0,
    gameState: "playing",
    initialBet: bet,
    dealerRevealed: false,
    isDealing: false,
    viewHandIndex: 0,
    message: "",
    roundLevel: level,
  }

  const dealerValue = calculateHandValue(dealerHand2)
  const playerValue = calculateHandValue(playerHand2)
  const dealerHasBlackjack = dealerValue === 21 && dealerHand2.length === 2
  const playerHasBlackjack = playerValue === 21 && playerHand2.length === 2

  if (dealerHasBlackjack && playerHasBlackjack) {
    const payout = settle({ result: "push", baseBet: bet, isDoubled: false, isBlackjack: true })
    const resolution: SingleHandResolution = {
      result: "push",
      message: "Push! Both Have Blackjack",
      payout,
      totalBet: bet,
      winAmount: 0,
      winsDelta: 0,
      lossesDelta: 0,
      totalMovesDelta: 0,
      correctMovesDelta: 0,
      handsPlayedDelta: 1,
      xpGain: 0,
    }
    return {
      state: { ...newState, dealerRevealed: true, gameState: "finished", message: resolution.message },
      resolution,
    }
  }

  if (dealerHasBlackjack) {
    const resolution: SingleHandResolution = {
      result: "loss",
      message: "Dealer Blackjack! You Lose",
      payout: 0,
      totalBet: bet,
      winAmount: -bet,
      winsDelta: 0,
      lossesDelta: 1,
      totalMovesDelta: 0,
      correctMovesDelta: 0,
      handsPlayedDelta: 1,
      xpGain: 0,
    }
    return {
      state: { ...newState, dealerRevealed: true, gameState: "finished", message: resolution.message },
      resolution,
    }
  }

  if (playerHasBlackjack) {
    const payout = settle({ result: "win", baseBet: bet, isDoubled: false, isBlackjack: true })
    const totalBet = bet
    const winAmount = payout - totalBet
    const resolution: SingleHandResolution = {
      result: "win",
      message: "Blackjack! You Win 3:2",
      payout,
      totalBet,
      winAmount,
      winsDelta: 1,
      lossesDelta: 0,
      totalMovesDelta: 1,
      correctMovesDelta: 1,
      handsPlayedDelta: 1,
      xpGain: 0,
    }
    return {
      state: { ...newState, dealerRevealed: true, gameState: "finished", message: resolution.message },
      resolution,
    }
  }

  return { state: newState, resolution: null }
}

function advanceToNextHand(state: EngineGameState, hands: PlayerHandState[]) {
  const nextHandIndex = state.currentHandIndex + 1
  if (nextHandIndex < hands.length) {
    return {
      state: {
        ...state,
        hands,
        currentHandIndex: nextHandIndex,
        viewHandIndex: nextHandIndex,
        message: "Playing next hand...",
      },
      resolution: null,
    }
  }

  return {
    state: { ...state, hands, gameState: "dealer" as const },
    resolution: null,
  }
}

function handleHit(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container

  const currentHand = state.hands[state.currentHandIndex]
  const deckCopy = ensureDeckHasCards([...state.deck])
  const [newHandCards, newDeck] = dealCard(currentHand.cards, deckCopy)
  const updatedHand: PlayerHandState = { ...currentHand, cards: newHandCards }
  const updatedHands = state.hands.map((hand, idx) => (idx === state.currentHandIndex ? updatedHand : hand))

  const value = calculateHandValue(newHandCards)
  if (value > 21) {
    if (state.hands.length > 1 && state.currentHandIndex < state.hands.length - 1) {
      return {
        state: {
          ...state,
          deck: newDeck,
          hands: updatedHands,
          currentHandIndex: state.currentHandIndex + 1,
          viewHandIndex: state.currentHandIndex + 1,
          message: `Hand ${state.currentHandIndex + 1} Busts!`,
        },
        resolution: null,
      }
    }

    if (allHandsBust(updatedHands)) {
      const resolution = resolveRoundImmediate(updatedHands, state.dealerHand, state.roundLevel)
      return {
        state: {
          ...state,
          deck: newDeck,
          hands: updatedHands,
          dealerRevealed: true,
          gameState: "finished",
          message: resolution.message,
        },
        resolution,
      }
    }

    const { dealerHand: finalDealer, deck: finalDeck } = playDealerToEnd(state.dealerHand, newDeck)
    const resolution = resolveRoundImmediate(updatedHands, finalDealer, state.roundLevel)
    return {
      state: {
        ...state,
        deck: finalDeck,
        dealerHand: finalDealer,
        hands: updatedHands,
        dealerRevealed: true,
        gameState: "finished",
        message: resolution.message,
      },
      resolution,
    }
  }

  if (value === 21) {
    return advanceToNextHand({ ...state, deck: newDeck, hands: updatedHands }, updatedHands)
  }

  return { state: { ...state, deck: newDeck, hands: updatedHands }, resolution: null }
}

function handleStand(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container

  return advanceToNextHand(state, state.hands)
}

function handleDouble(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container

  const currentHand = state.hands[state.currentHandIndex]
  if (!canDouble(currentHand, { doubleOnSplitAces: tableRules.doubleOnSplitAces })) return container

  const deckCopy = ensureDeckHasCards([...state.deck])
  const [newHandCards, newDeck] = dealCard(currentHand.cards, deckCopy)
  const updatedHand: PlayerHandState = { ...currentHand, cards: newHandCards, doubled: true }
  const updatedHands = state.hands.map((hand, idx) => (idx === state.currentHandIndex ? updatedHand : hand))

  const value = calculateHandValue(newHandCards)
  if (value > 21) {
    if (updatedHands.length > 1 && state.currentHandIndex < updatedHands.length - 1) {
      return {
        state: {
          ...state,
          deck: newDeck,
          hands: updatedHands,
          currentHandIndex: state.currentHandIndex + 1,
          viewHandIndex: state.currentHandIndex + 1,
          message: `Hand ${state.currentHandIndex + 1} Busts!`,
        },
        resolution: null,
      }
    }

    if (allHandsBust(updatedHands)) {
      const resolution = resolveRoundImmediate(updatedHands, state.dealerHand, state.roundLevel)
      return {
        state: {
          ...state,
          deck: newDeck,
          hands: updatedHands,
          dealerRevealed: true,
          gameState: "finished",
          message: resolution.message,
        },
        resolution,
      }
    }

    const { dealerHand: finalDealer, deck: finalDeck } = playDealerToEnd(state.dealerHand, newDeck)
    const resolution = resolveRoundImmediate(updatedHands, finalDealer, state.roundLevel)
    return {
      state: {
        ...state,
        deck: finalDeck,
        dealerHand: finalDealer,
        hands: updatedHands,
        dealerRevealed: true,
        gameState: "finished",
        message: resolution.message,
      },
      resolution,
    }
  }

  return advanceToNextHand({ ...state, deck: newDeck, hands: updatedHands }, updatedHands)
}

function handleSplit(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container

  const currentHand = state.hands[state.currentHandIndex]
  if (!canSplit(currentHand.cards)) return container

  const isAcePair = currentHand.cards[0].rank === "A" && currentHand.cards[1].rank === "A"

  const firstHand: PlayerHandState = {
    cards: [currentHand.cards[0]],
    bet: currentHand.bet,
    doubled: false,
    isSplitAce: isAcePair,
  }
  const secondHand: PlayerHandState = {
    cards: [currentHand.cards[1]],
    bet: currentHand.bet,
    doubled: false,
    isSplitAce: isAcePair,
  }

  const deckCopy = ensureDeckHasCards([...state.deck])
  const [newFirstHandCards, deck1] = dealCard(firstHand.cards, deckCopy)
  const [newSecondHandCards, deck2] = dealCard(secondHand.cards, deck1)

  const updatedHands = [
    { ...firstHand, cards: newFirstHandCards },
    { ...secondHand, cards: newSecondHandCards },
  ]

  return {
    state: {
      ...state,
      deck: deck2,
      hands: updatedHands,
      currentHandIndex: 0,
      viewHandIndex: 0,
      message: "Playing first hand...",
    },
    resolution: null,
  }
}

function engineReducer(container: EngineContainer, action: EngineAction): EngineContainer {
  switch (action.type) {
    case "HYDRATE":
      return { state: { ...container.state, ...action.payload }, resolution: null }
    case "SET_RESOLUTION":
      return {
        state: {
          ...container.state,
          ...action.statePatch,
          dealerRevealed: true,
          gameState: "finished",
          message: action.resolution.message,
        },
        resolution: action.resolution,
      }
    case "CLEAR_RESOLUTION":
      return { ...container, resolution: null }
    case "DEAL":
      return handleDeal(container.state, action.bet, action.level)
    case "HIT":
      return handleHit(container)
    case "STAND":
      return handleStand(container)
    case "DOUBLE":
      return handleDouble(container)
    case "SPLIT":
      return handleSplit(container)
    case "RESET_ROUND":
      return { state: { ...initialEngineState, deck: ensureDeckHasCards(container.state.deck) }, resolution: null }
    default:
      return container
  }
}

export function useGameEngine(initial: Partial<EngineGameState> = {}) {
  const initialContainer: EngineContainer = {
    state: { ...initialEngineState, ...initial },
    resolution: null,
  }

  const [container, dispatch] = useReducer(engineReducer, initialContainer)

  return {
    state: container.state,
    resolution: container.resolution,
    dispatch,
  }
}

export function animateDealerPlay({
  state,
  dispatch,
  delayMs = 150,
}: {
  state: EngineGameState
  dispatch: React.Dispatch<EngineAction>
  delayMs?: number
}) {
  const steps: Array<{ dealerHand: CardType[]; deck: CardType[] }> = []
  let dealer = [...state.dealerHand]
  let deck = [...state.deck]

  while (dealerShouldHitH17(dealer)) {
    deck = ensureDeckHasCards(deck)
    const [newHand, newDeck] = dealCard(dealer, deck)
    dealer = newHand
    deck = newDeck
    steps.push({ dealerHand: dealer, deck })
  }

  const hasMultipleHands = state.hands.length > 1

  if (steps.length === 0) {
    const resolution = resolveHands({ hands: state.hands, dealerHand: state.dealerHand, level: state.roundLevel })

    dispatch({
      type: "SET_RESOLUTION",
      resolution,
      statePatch: {
        dealerHand: state.dealerHand,
        deck: state.deck,
        viewHandIndex: 0,
      },
    })
    return
  }

  steps.forEach((step, idx) => {
    setTimeout(() => {
      const isLast = idx === steps.length - 1
      dispatch({
        type: "HYDRATE",
        payload: {
          dealerHand: step.dealerHand,
          deck: step.deck,
          dealerRevealed: true,
          gameState: "dealer",
        },
      })

      if (isLast) {
        const resolution = resolveHands({ hands: state.hands, dealerHand: step.dealerHand, level: state.roundLevel })

        dispatch({
          type: "SET_RESOLUTION",
          resolution,
          statePatch: {
            dealerHand: step.dealerHand,
            deck: step.deck,
            viewHandIndex: 0,
          },
        })
      }
    }, delayMs * (idx + 1))
  })
}
