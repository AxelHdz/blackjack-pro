import { useReducer, useCallback, useRef } from "react"
import { calculateHandValue, createDeck, getCardValue, type Card as CardType } from "@/lib/card-utils"
import {
  dealCard,
  dealerShouldHitH17,
  ensureDeckHasCards,
  resolveSingleHand,
  resolveSplitHands,
  type SingleHandResolution,
  type SplitHandResolution,
} from "@/lib/game-engine"
import { settle } from "@/lib/settlement"
import { getXPPerWinWithBet } from "@/lib/leveling-config"

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

export type RoundResolution = SingleHandResolution | SplitHandResolution

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

type EngineControllerOptions = {
  state: EngineGameState
  patchState: (payload: PatchPayload) => void
  level: number
  onRoundResolved: (resolution: RoundResolution) => void
}

/**
 * Domain actions for the blackjack engine. Purely manages cards/flow and emits
 * round resolutions; callers own money/stats side-effects.
 */
export function useGameEngineController({
  state,
  patchState,
  level,
  onRoundResolved,
}: EngineControllerOptions) {
  const isDoubledRef = useRef(false)

  const applyResolution = useCallback(
    (resolution: RoundResolution, extraPatch: PatchPayload = {}) => {
      patchState({ message: resolution.message, gameState: "finished", dealerRevealed: true, ...extraPatch })
      onRoundResolved(resolution)
    },
    [onRoundResolved, patchState],
  )

  const startHand = useCallback(
    (betAmount: number) => {
      patchState({
        gameState: "playing",
        isDealing: true,
        activeBet: betAmount,
        initialBet: betAmount,
        isSplit: false,
        splitHand: [],
        currentHandIndex: 0,
        firstHandResult: null,
        firstHandCards: [],
        showBustMessage: false,
        viewHandIndex: 0,
        isDoubled: false,
        dealerRevealed: false,
        message: "",
      })
      isDoubledRef.current = false

      let deckCopy = [...state.deck]
      if (deckCopy.length === 0) {
        deckCopy = createDeck()
      }

      setTimeout(() => {
        const [newDealerHand1, deck1] = dealCard([], deckCopy)
        const [newDealerHand2, deck2] = dealCard(newDealerHand1, deck1)
        const [newPlayerHand1, deck3] = dealCard([], deck2)
        const [newPlayerHand2, deck4] = dealCard(newPlayerHand1, deck3)

        patchState({
          dealerHand: newDealerHand2,
          playerHand: newPlayerHand2,
          deck: deck4,
          dealerRevealed: false,
          isDealing: false,
          message: "",
        })

        const dealerUpcard = newDealerHand2[0]
        const dealerUpcardValue = getCardValue(dealerUpcard)

        if (dealerUpcardValue === 11 || dealerUpcardValue === 10) {
          const dealerValue = calculateHandValue(newDealerHand2)
          const playerValue = calculateHandValue(newPlayerHand2)

          if (dealerValue === 21 && newDealerHand2.length === 2) {
            patchState({ dealerRevealed: true })

            if (playerValue === 21 && newPlayerHand2.length === 2) {
              const payout = settle({ result: "push", baseBet: betAmount, isDoubled: false, isBlackjack: true })
              const blackjackPush: SingleHandResolution = {
                result: "push",
                message: "Push! Both Have Blackjack",
                payout,
                totalBet: betAmount,
                winAmount: 0,
                winsDelta: 0,
                lossesDelta: 0,
                totalMovesDelta: 0,
                correctMovesDelta: 0,
                handsPlayedDelta: 1,
                xpGain: 0,
              }
              applyResolution(blackjackPush)
            } else {
              const blackjackLoss: SingleHandResolution = {
                result: "loss",
                message: "Dealer Blackjack! You Lose",
                payout: 0,
                totalBet: betAmount,
                winAmount: -betAmount,
                winsDelta: 0,
                lossesDelta: 1,
                totalMovesDelta: 0,
                correctMovesDelta: 0,
                handsPlayedDelta: 1,
                xpGain: 0,
              }
              applyResolution(blackjackLoss)
            }
            return
          }
        }

        const playerValue = calculateHandValue(newPlayerHand2)
        if (playerValue === 21 && newPlayerHand2.length === 2) {
          const payout = settle({ result: "win", baseBet: betAmount, isDoubled: false, isBlackjack: true })
          const profit = payout - betAmount
          const blackjackWin: SingleHandResolution = {
            result: "win",
            message: "Blackjack! You Win 3:2",
            payout,
            totalBet: betAmount,
            winAmount: profit,
            winsDelta: 1,
            lossesDelta: 0,
            totalMovesDelta: 1,
            correctMovesDelta: 1,
            handsPlayedDelta: 1,
            xpGain: getXPPerWinWithBet(level, betAmount),
          }
          applyResolution(blackjackWin)
        }
      }, 100)
    },
    [applyResolution, level, patchState, state.deck],
  )

  const finishSplitHand = useCallback(
    (firstHandCards: CardType[], secondHandCards: CardType[], finalDealerHand: CardType[]) => {
      const resolution = resolveSplitHands({
        firstHand: firstHandCards,
        secondHand: secondHandCards,
        dealerHand: finalDealerHand,
        betPerHand: state.activeBet,
        level,
      })
      applyResolution(resolution)
    },
    [applyResolution, level, state.activeBet],
  )

  const finishHand = useCallback(
    (finalPlayerHand: CardType[], finalDealerHand: CardType[]) => {
      const resolution = resolveSingleHand({
        playerHand: finalPlayerHand,
        dealerHand: finalDealerHand,
        baseBet: state.initialBet,
        isDoubled: isDoubledRef.current,
        level,
      })
      applyResolution(resolution)
    },
    [applyResolution, level, state.initialBet],
  )

  const playDealerHand = useCallback(
    (finalPlayerHand: CardType[], secondHandOverride?: CardType[]) => {
      let currentDealerHand = [...state.dealerHand]
      let currentDeck = ensureDeckHasCards([...state.deck])

      const dealerPlay = () => {
        const shouldHit = dealerShouldHitH17(currentDealerHand)

        if (!shouldHit) {
          const finalDealer = [...currentDealerHand]
          if (state.isSplit) {
            const secondHand =
              secondHandOverride ||
              (finalPlayerHand === state.firstHandCards ? state.splitHand : finalPlayerHand)
            finishSplitHand(state.firstHandCards, secondHand, finalDealer)
          } else {
            finishHand(finalPlayerHand, finalDealer)
          }
          return
        }

        setTimeout(() => {
          currentDeck = ensureDeckHasCards(currentDeck)
          const [newHand, newDeck] = dealCard(currentDealerHand, currentDeck)
          currentDealerHand = newHand
          currentDeck = newDeck
          patchState({ dealerHand: newHand, deck: newDeck })
          dealerPlay()
        }, 400)
      }

      dealerPlay()
    },
    [finishHand, finishSplitHand, patchState, state.deck, state.dealerHand, state.firstHandCards, state.isSplit, state.splitHand],
  )

  const stand = useCallback(
    (finalPlayerHand?: CardType[]) => {
      if (state.isSplit && state.currentHandIndex === 0) {
        const handToUse = finalPlayerHand || state.playerHand
        patchState({
          firstHandCards: handToUse,
          firstHandResult: { value: calculateHandValue(handToUse), busted: false },
          currentHandIndex: 1,
          playerHand: state.splitHand,
          message: "Playing second hand...",
        })
      } else {
        const handToUse = finalPlayerHand || state.playerHand || []
        const patchPayload: PatchPayload = { gameState: "dealer", dealerRevealed: true }
        if (state.isSplit && state.currentHandIndex === 1) {
          patchPayload.splitHand = handToUse
        }
        patchState(patchPayload)
        playDealerHand(handToUse)
      }
    },
    [patchState, playDealerHand, state.currentHandIndex, state.isSplit, state.playerHand, state.splitHand],
  )

  const hit = useCallback(() => {
    const deckCopy = ensureDeckHasCards([...state.deck])
    const [newHand, newDeck] = dealCard(state.playerHand, deckCopy)
    const patchPayload: PatchPayload = { playerHand: newHand, deck: newDeck }
    if (state.isSplit && state.currentHandIndex === 1) {
      patchPayload.splitHand = newHand
    }
    patchState(patchPayload)

    const value = calculateHandValue(newHand)
    if (value > 21) {
      if (state.isSplit && state.currentHandIndex === 0) {
        patchState({
          firstHandResult: { value, busted: true },
          firstHandCards: newHand,
          showBustMessage: true,
          message: "Hand 1 Busts!",
        })

        setTimeout(() => {
          patchState({
            showBustMessage: false,
            currentHandIndex: 1,
            playerHand: state.splitHand,
            message: "Playing second hand...",
          })
        }, 600)
      } else if (state.isSplit && state.currentHandIndex === 1) {
        const firstHandBusted = state.firstHandResult?.busted ?? false
        const splitBustPatch: PatchPayload = { dealerRevealed: true, splitHand: newHand }

        if (firstHandBusted) {
          patchState(splitBustPatch)
          const resolution = resolveSplitHands({
            firstHand: state.firstHandCards,
            secondHand: newHand,
            dealerHand: state.dealerHand,
            betPerHand: state.activeBet,
            level,
          })
          applyResolution(resolution)
        } else {
          patchState({ ...splitBustPatch, gameState: "dealer" })
          playDealerHand(state.firstHandCards, newHand)
        }
      } else {
        const bustResolution: SingleHandResolution = {
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
        applyResolution(bustResolution, { dealerRevealed: true })
      }
    } else if (value === 21) {
      stand(newHand)
    }
  }, [
    applyResolution,
    patchState,
    playDealerHand,
    stand,
    state.activeBet,
    state.currentHandIndex,
    state.dealerHand,
    state.deck,
    state.firstHandCards,
    state.firstHandResult?.busted,
    state.isSplit,
    state.playerHand,
    state.splitHand,
    level,
  ])

  const doubleDown = useCallback(() => {
    patchState({ isDoubled: true })
    isDoubledRef.current = true
    const newActiveBet = state.activeBet * 2
    patchState({ activeBet: newActiveBet })

    const deckCopy = ensureDeckHasCards([...state.deck])
    const [newHand, newDeck] = dealCard(state.playerHand, deckCopy)
    const patchPayload: PatchPayload = { playerHand: newHand, deck: newDeck }
    if (state.isSplit && state.currentHandIndex === 1) {
      patchPayload.splitHand = newHand
    }
    patchState(patchPayload)

    const value = calculateHandValue(newHand)
    if (value > 21) {
      const totalBetAmount = state.initialBet * 2
      const bustPatch: PatchPayload = { dealerRevealed: true }
      if (state.isSplit && state.currentHandIndex === 1) {
        bustPatch.splitHand = newHand
      }
      patchState(bustPatch)
      const bustResolution: SingleHandResolution = {
        result: "loss",
        message: "Bust! You Lose",
        payout: 0,
        totalBet: totalBetAmount,
        winAmount: -totalBetAmount,
        winsDelta: 0,
        lossesDelta: 1,
        totalMovesDelta: 1,
        correctMovesDelta: 0,
        handsPlayedDelta: 1,
        xpGain: 0,
      }
      applyResolution(bustResolution)
    } else {
      if (state.isSplit && state.currentHandIndex === 0) {
        patchState({
          firstHandCards: newHand,
          firstHandResult: { value: calculateHandValue(newHand), busted: false },
          currentHandIndex: 1,
          playerHand: state.splitHand,
          message: "Playing second hand...",
        })
      } else {
        const patchPayload: PatchPayload = { gameState: "dealer", dealerRevealed: true }
        if (state.isSplit && state.currentHandIndex === 1) {
          patchPayload.splitHand = newHand
        }
        patchState(patchPayload)
        playDealerHand(newHand)
      }
    }
  }, [
    applyResolution,
    patchState,
    playDealerHand,
    state.activeBet,
    state.currentHandIndex,
    state.deck,
    state.initialBet,
    state.isSplit,
    state.playerHand,
    state.splitHand,
  ])

  const canSplit = useCallback(
    (hand: CardType[]) => {
      if (hand.length !== 2) return false
      const v1 = getCardValue(hand[0])
      const v2 = getCardValue(hand[1])
      return v1 === v2
    },
    [],
  )

  const split = useCallback(() => {
    if (!canSplit(state.playerHand)) return

    const originalHand = [...state.playerHand]

    patchState({ isSplit: true })

    const firstHand = [state.playerHand[0]]
    const secondHand = [state.playerHand[1]]

    const deckCopy = ensureDeckHasCards([...state.deck])
    const [newFirstHand, deck1] = dealCard(firstHand, deckCopy)
    const [newSecondHand, deck2] = dealCard(secondHand, deck1)

    patchState({
      playerHand: newFirstHand,
      splitHand: newSecondHand,
      deck: deck2,
      currentHandIndex: 0,
      message: "Playing first hand...",
    })
  }, [canSplit, onRoundResolved, patchState, state.activeBet, state.deck, state.playerHand])

  return {
    startHand,
    hit,
    stand,
    doubleDown,
    split,
    canSplit,
    isDoubledRef,
  }
}
