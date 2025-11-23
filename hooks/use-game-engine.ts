import { useReducer } from "react"
import {
  calculateHandValue,
  createDeck,
  getCardValue,
  type Card as CardType,
} from "@/lib/card-utils"
import {
  dealCard,
  dealerShouldHitH17,
  ensureDeckHasCards,
  resolveSingleHand,
  resolveSplitHands,
  type SingleHandResolution,
  type SplitHandResolution,
} from "@/lib/game-engine"
import { getXPPerWinWithBet } from "@/lib/leveling-config"
import { settle } from "@/lib/settlement"

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
  roundLevel: number
  firstHandBet?: number
  firstHandDoubled?: boolean
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

function resolveWithDealer(state: EngineGameState, isDoubled: boolean): { nextState: EngineGameState; resolution: RoundResolution } {
  const playerValue = calculateHandValue(state.playerHand)
  if (playerValue > 21) {
    const totalBet = isDoubled ? state.initialBet * 2 : state.initialBet
    const resolution: SingleHandResolution = {
      result: "loss",
      message: "Bust! You Lose",
      payout: 0,
      totalBet,
      winAmount: -totalBet,
      winsDelta: 0,
      lossesDelta: 1,
      totalMovesDelta: 1,
      correctMovesDelta: 0,
      handsPlayedDelta: 1,
      xpGain: 0,
    }
    return {
      nextState: {
        ...state,
        dealerRevealed: true,
        gameState: "finished",
        message: resolution.message,
      },
      resolution,
    }
  }

  const { dealerHand: finalDealerHand, deck: finalDeck } = playDealerToEnd(state.dealerHand, state.deck)
  let resolution: RoundResolution

  if (state.isSplit) {
    resolution = resolveSplitHands({
      firstHand: state.firstHandCards,
      secondHand: state.splitHand,
      dealerHand: finalDealerHand,
      betPerHand: state.activeBet,
      level: state.roundLevel,
    })
  } else {
    resolution = resolveSingleHand({
      playerHand: state.playerHand,
      dealerHand: finalDealerHand,
      baseBet: state.initialBet,
      isDoubled,
      level: state.roundLevel,
    })
  }

  const nextState: EngineGameState = {
    ...state,
    deck: finalDeck,
    dealerHand: finalDealerHand,
    dealerRevealed: true,
    gameState: "finished",
    message: resolution.message,
  }

  return { nextState, resolution }
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

  const newState: EngineGameState = {
    ...state,
    deck: deck4,
    dealerHand: dealerHand2,
    playerHand: playerHand2,
    activeBet: bet,
    initialBet: bet,
    isSplit: false,
    splitHand: [],
    firstHandCards: [],
    firstHandResult: null,
    currentHandIndex: 0,
    dealerRevealed: false,
    isDealing: false,
    showBustMessage: false,
    viewHandIndex: 0,
    isDoubled: false,
    message: "",
    gameState: "playing",
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
      xpGain: getXPPerWinWithBet(level, totalBet),
    }
    return {
      state: { ...newState, dealerRevealed: true, gameState: "finished", message: resolution.message },
      resolution,
    }
  }

  return { state: newState, resolution: null }
}

function handleHit(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container

  const isSecondHand = state.isSplit && state.currentHandIndex === 1
  const targetHand = isSecondHand ? state.splitHand : state.playerHand
  const deckCopy = ensureDeckHasCards([...state.deck])
  const [newHand, newDeck] = dealCard(targetHand, deckCopy)

  let nextState: EngineGameState = {
    ...state,
    deck: newDeck,
    playerHand: newHand,
    splitHand: isSecondHand ? newHand : state.splitHand,
  }

  const value = calculateHandValue(newHand)
  if (value > 21) {
    if (state.isSplit && state.currentHandIndex === 0) {
      nextState = {
        ...nextState,
        firstHandResult: { value, busted: true },
        firstHandCards: newHand,
        showBustMessage: true,
        message: "Hand 1 Busts!",
        currentHandIndex: 1,
        playerHand: state.splitHand,
      }
      return { state: nextState, resolution: null }
    }

    if (state.isSplit && state.currentHandIndex === 1) {
      const { dealerHand: finalDealer, deck: finalDeck } = playDealerToEnd(state.dealerHand, newDeck)
      const resolution = resolveSplitHands({
        firstHand: state.firstHandCards,
        secondHand: newHand,
        dealerHand: finalDealer,
        betPerHand: state.activeBet,
        level: state.roundLevel,
      })
      return {
        state: {
          ...nextState,
          deck: finalDeck,
          dealerHand: finalDealer,
          dealerRevealed: true,
          gameState: "finished",
          message: resolution.message,
        },
        resolution,
      }
    }

    const resolution: SingleHandResolution = {
      result: "loss",
      message: "Bust! You Lose",
      payout: 0,
      totalBet: state.activeBet,
      winAmount: -state.activeBet,
      winsDelta: 0,
      lossesDelta: 1,
      totalMovesDelta: 1,
      correctMovesDelta: 0,
      handsPlayedDelta: 1,
      xpGain: 0,
    }
    return {
      state: { ...nextState, dealerRevealed: true, gameState: "finished", message: resolution.message },
      resolution,
    }
  }

  if (value === 21) {
    if (state.isSplit && state.currentHandIndex === 0) {
      const firstValue = calculateHandValue(newHand)
      return {
        state: {
          ...nextState,
          firstHandCards: newHand,
          firstHandResult: { value: firstValue, busted: false },
          currentHandIndex: 1,
          playerHand: state.splitHand,
          message: "Playing second hand...",
        },
        resolution: null,
      }
    }
    return { state: { ...nextState, dealerRevealed: true, gameState: "dealer" }, resolution: null }
  }

  return { state: nextState, resolution: null }
}

function handleStand(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container

  const playerValue = calculateHandValue(state.playerHand)
  if (playerValue > 21) {
    if (state.isSplit && state.currentHandIndex === 1) {
      const resolution = resolveSplitHands({
        firstHand: state.firstHandCards,
        secondHand: state.playerHand,
        dealerHand: state.dealerHand,
        betPerHand: state.initialBet,
        level: state.roundLevel,
      })
      return {
        state: {
          ...state,
          dealerRevealed: true,
          gameState: "finished",
          message: resolution.message,
        },
        resolution,
      }
    } else {
      const totalBet = state.isDoubled ? state.initialBet * 2 : state.initialBet
      const resolution: SingleHandResolution = {
        result: "loss",
        message: "Bust! You Lose",
        payout: 0,
        totalBet,
        winAmount: -totalBet,
        winsDelta: 0,
        lossesDelta: 1,
        totalMovesDelta: 1,
        correctMovesDelta: 0,
        handsPlayedDelta: 1,
        xpGain: 0,
      }
      return {
        state: { ...state, dealerRevealed: true, gameState: "finished", message: resolution.message },
        resolution,
      }
    }
  }

  if (state.isSplit && state.currentHandIndex === 0) {
    const value = calculateHandValue(state.playerHand)
    const nextState: EngineGameState = {
      ...state,
      firstHandCards: state.playerHand,
      firstHandResult: { value, busted: false },
      currentHandIndex: 1,
      playerHand: state.splitHand,
      message: "Playing second hand...",
    }
    return { state: nextState, resolution: null }
  }

  return { state: { ...state, dealerRevealed: true, gameState: "dealer" }, resolution: null }
}

function handleDouble(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container
  // Splits currently do not model per-hand double payouts; block double on second split hand to avoid incorrect payouts
  if (state.isSplit && state.currentHandIndex === 1) return container

  const deckCopy = ensureDeckHasCards([...state.deck])
  const [newHand, newDeck] = dealCard(state.playerHand, deckCopy)
  const value = calculateHandValue(newHand)

  const doubledState: EngineGameState = {
    ...state,
    playerHand: newHand,
    deck: newDeck,
    activeBet: state.activeBet * 2,
    isDoubled: true,
  }

  if (state.isSplit && state.currentHandIndex === 0) {
    if (value > 21) {
      const nextState: EngineGameState = {
        ...doubledState,
        firstHandCards: newHand,
        firstHandResult: { value, busted: true },
        currentHandIndex: 1,
        playerHand: state.splitHand,
        message: "Playing second hand...",
        // Capture per-hand wager for correct split resolution
        firstHandBet: doubledState.activeBet,
        firstHandDoubled: true,
        activeBet: state.initialBet,
        isDoubled: false,
      }
      return { state: nextState, resolution: null }
    }

    const firstValue = calculateHandValue(newHand)
    const nextState: EngineGameState = {
      ...doubledState,
      firstHandCards: newHand,
      firstHandResult: { value: firstValue, busted: false },
      currentHandIndex: 1,
      playerHand: state.splitHand,
      message: "Playing second hand...",
      firstHandBet: doubledState.activeBet,
      firstHandDoubled: true,
      activeBet: state.initialBet, // reset for second hand
      isDoubled: false,
    }
    return { state: nextState, resolution: null }
  }

  if (value > 21) {
    const resolution: SingleHandResolution = {
      result: "loss",
      message: "Bust! You Lose",
      payout: 0,
      totalBet: state.activeBet,
      winAmount: -state.activeBet,
      winsDelta: 0,
      lossesDelta: 1,
      totalMovesDelta: 1,
      correctMovesDelta: 0,
      handsPlayedDelta: 1,
      xpGain: 0,
    }
    return {
      state: { ...doubledState, dealerRevealed: true, gameState: "finished", message: resolution.message },
      resolution,
    }
  }

  return { state: { ...doubledState, dealerRevealed: true, gameState: "dealer" }, resolution: null }
}

function handleSplit(container: EngineContainer): EngineContainer {
  const { state } = container
  if (state.gameState !== "playing") return container
  if (state.playerHand.length !== 2) return container

  const v1 = getCardValue(state.playerHand[0])
  const v2 = getCardValue(state.playerHand[1])
  if (v1 !== v2) return container

  const firstHand = [state.playerHand[0]]
  const secondHand = [state.playerHand[1]]

  const deckCopy = ensureDeckHasCards([...state.deck])
  const [newFirstHand, deck1] = dealCard(firstHand, deckCopy)
  const [newSecondHand, deck2] = dealCard(secondHand, deck1)

  const nextState: EngineGameState = {
    ...state,
    deck: deck2,
    playerHand: newFirstHand,
    splitHand: newSecondHand,
    isSplit: true,
    currentHandIndex: 0,
    firstHandCards: [],
    firstHandResult: null,
    message: "Playing first hand...",
  }

  return { state: nextState, resolution: null }
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
  delayMs =150,
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

  const splitBet = state.firstHandDoubled ? state.firstHandBet : state.initialBet

  if (steps.length === 0) {
    const resolution = state.isSplit
      ? resolveSplitHands({
          firstHand: state.firstHandCards,
          secondHand: state.splitHand,
          dealerHand: state.dealerHand,
          betPerHand: splitBet,
          level: state.roundLevel,
        })
      : resolveSingleHand({
          playerHand: state.playerHand,
          dealerHand: state.dealerHand,
          baseBet: state.initialBet,
          isDoubled: state.isDoubled,
          level: state.roundLevel,
        })

    dispatch({
      type: "SET_RESOLUTION",
      resolution,
      statePatch: {
        dealerHand: state.dealerHand,
        deck: state.deck,
        // Default to showing first hand after split resolution
        playerHand: state.isSplit ? state.firstHandCards : state.playerHand,
        viewHandIndex: state.isSplit ? 0 : state.viewHandIndex,
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
        const resolution = state.isSplit
          ? resolveSplitHands({
              firstHand: state.firstHandCards,
              secondHand: state.splitHand,
              dealerHand: step.dealerHand,
              betPerHand: splitBet,
              level: state.roundLevel,
            })
          : resolveSingleHand({
              playerHand: state.playerHand,
              dealerHand: step.dealerHand,
              baseBet: state.initialBet,
              isDoubled: state.isDoubled,
              level: state.roundLevel,
            })

        dispatch({
          type: "SET_RESOLUTION",
          resolution,
          statePatch: {
            dealerHand: step.dealerHand,
            deck: step.deck,
            playerHand: state.isSplit ? state.firstHandCards : state.playerHand,
            viewHandIndex: state.isSplit ? 0 : state.viewHandIndex,
          },
        })
      }
    }, delayMs * (idx + 1))
  })
}
