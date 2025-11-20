import { useEffect, useReducer, useCallback } from "react"
import { calculateHandValue, createDeck, getCardValue, isSoftHand, type Card as CardType } from "@/lib/card-utils"
import { settle } from "@/lib/settlement"
import { getOptimalMove, type GameAction } from "@/lib/blackjack-strategy"
import { resolveFeedback, type FeedbackContext } from "@/lib/drill-feedback"
import { getXPPerWinWithBet } from "@/lib/leveling-config"

type LearningMode = "guided" | "practice" | "expert"

type ModeStats = {
  handsPlayed: number
  correctMoves: number
  totalMoves: number
  wins: number
  losses: number
}

type GameState = {
  deck: CardType[]
  playerHand: CardType[]
  dealerHand: CardType[]
  gameState: "betting" | "playing" | "dealer" | "finished"
  currentBet: number
  balance: number | null
  totalWinnings: number
  levelWinnings: number
  handsPlayed: number
  showHint: boolean
  message: string
  dealerRevealed: boolean
  isDealing: boolean
  activeBet: number
  initialBet: number
  level: number
  xp: number
  isSplit: boolean
  splitHand: CardType[]
  currentHandIndex: number
  firstHandResult: { value: number; busted: boolean } | null
  firstHandCards: CardType[]
  learningMode: LearningMode
  showFeedback: boolean
  feedbackData:
    | {
        playerAction: GameAction
        optimalAction: GameAction
        isCorrect: boolean
        tip: string
        why: string
        originalPlayerHand: CardType[]
        moveCount: number
      }
    | null
  correctMoves: number
  totalMoves: number
  wins: number
  losses: number
  modeStats: Record<LearningMode, ModeStats>
  statsView: "overall" | "perMode"
  roundResult: { message: string; winAmount: number; newBalance: number } | null
  showModeSelector: boolean
  showLevelUp: boolean
  levelUpData: { newLevel: number; levelWinnings: number; cashBonus: number; accuracy: number } | null
  showBustMessage: boolean
  viewHandIndex: number
  isDoubled: boolean
  showFeedbackModal: boolean
  showLeaderboard: boolean
  leaderboardMetric: "balance" | "level"
  leaderboardScope: "global" | "friends"
  showChallengeResultModal: boolean
  requireChallengeDismissal: boolean
  completedChallengeResult: any
  showXpPopup: boolean
  showLogoutConfirm: boolean
  showModeSelectorDrawer?: boolean
}

// Minimal reducer scaffold for future expansion
type Action = { type: "SET_BALANCE"; balance: number | null } | { type: "SET_ROUND_RESULT"; round: GameState["roundResult"] }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_BALANCE":
      return { ...state, balance: action.balance }
    case "SET_ROUND_RESULT":
      return { ...state, roundResult: action.round }
    default:
      return state
  }
}

export function useGameEngine(initial: Partial<GameState> = {}) {
  const [state, dispatch] = useReducer(reducer, {
    deck: createDeck(),
    playerHand: [],
    dealerHand: [],
    gameState: "betting",
    currentBet: 0,
    balance: null,
    totalWinnings: 0,
    levelWinnings: 0,
    handsPlayed: 0,
    showHint: true,
    message: "",
    dealerRevealed: false,
    isDealing: false,
    activeBet: 0,
    initialBet: 0,
    level: 1,
    xp: 0,
    isSplit: false,
    splitHand: [],
    currentHandIndex: 0,
    firstHandResult: null,
    firstHandCards: [],
    learningMode: "guided",
    showFeedback: false,
    feedbackData: null,
    correctMoves: 0,
    totalMoves: 0,
    wins: 0,
    losses: 0,
    modeStats: {
      guided: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
      practice: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
      expert: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
    },
    statsView: "overall",
    roundResult: null,
    showModeSelector: false,
    showLevelUp: false,
    levelUpData: null,
    showBustMessage: false,
    viewHandIndex: 0,
    isDoubled: false,
    showFeedbackModal: false,
    showLeaderboard: false,
    leaderboardMetric: "balance",
    leaderboardScope: "global",
    showChallengeResultModal: false,
    requireChallengeDismissal: false,
    completedChallengeResult: null,
    showXpPopup: false,
    showLogoutConfirm: false,
    ...initial,
  })

  const setBalance = useCallback((balance: number | null) => dispatch({ type: "SET_BALANCE", balance }), [])
  const setRoundResult = useCallback((round: GameState["roundResult"]) => dispatch({ type: "SET_ROUND_RESULT", round }), [])

  return {
    state,
    dispatch,
    setBalance,
    setRoundResult,
  }
}
