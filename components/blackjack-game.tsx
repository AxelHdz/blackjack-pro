"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlayingCard } from "@/components/playing-card"
import { getOptimalMove, type GameAction } from "@/lib/blackjack-strategy"
import {
  calculateHandValue,
  createDeck,
  getHandValueInfo,
  type Card as CardType,
  getCardValue,
  isSoftHand,
} from "@/lib/card-utils"
import { Lightbulb, X, GraduationCap, Target, Trophy, ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { BuybackDrillModal } from "@/components/buyback-drill-modal"
import { settle } from "@/lib/settlement" // Import the settlement helper
import { LeaderboardChip } from "@/components/leaderboard-chip"
import { LeaderboardModal } from "@/components/leaderboard-modal"
import { useToast } from "@/hooks/use-toast"

type LearningMode = "guided" | "practice" | "expert"

type ModeStats = {
  handsPlayed: number
  correctMoves: number
  totalMoves: number
  wins: number
  losses: number
}

type StatsView = "overall" | "perMode"

interface BlackjackGameProps {
  userId: string
  friendReferralId?: string // Add optional friend referral ID prop
}

export function BlackjackGame({ userId, friendReferralId }: BlackjackGameProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [statsLoaded, setStatsLoaded] = useState(false)

  const [deck, setDeck] = useState<CardType[]>([])
  const [playerHand, setPlayerHand] = useState<CardType[]>([])
  const [dealerHand, setDealerHand] = useState<CardType[]>([])
  const [gameState, setGameState] = useState<"betting" | "playing" | "dealer" | "finished">("betting")
  const [currentBet, setCurrentBet] = useState(0)
  const [balance, setBalance] = useState<number | null>(null)
  const [totalWinnings, setTotalWinnings] = useState(0)
  const [handsPlayed, setHandsPlayed] = useState(0)
  const [showHint, setShowHint] = useState(true)
  const [message, setMessage] = useState("")
  const [dealerRevealed, setDealerRevealed] = useState(false)
  const [isDealing, setIsDealing] = useState(false)
  const [activeBet, setActiveBet] = useState(0)
  const [initialBet, setInitialBet] = useState(0)
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)

  const [isSplit, setIsSplit] = useState(false)
  const [splitHand, setSplitHand] = useState<CardType[]>([])
  const [currentHandIndex, setCurrentHandIndex] = useState(0)
  const [firstHandResult, setFirstHandResult] = useState<{ value: number; busted: boolean } | null>(null)
  const [firstHandCards, setFirstHandCards] = useState<CardType[]>([])

  const [learningMode, setLearningMode] = useState<LearningMode>("guided")
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackData, setFeedbackData] = useState<{
    playerAction: GameAction
    optimalAction: GameAction
    isCorrect: boolean
    explanation: string
  } | null>(null)
  const [correctMoves, setCorrectMoves] = useState(0)
  const [totalMoves, setTotalMoves] = useState(0)

  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)

  const [modeStats, setModeStats] = useState<Record<LearningMode, ModeStats>>({
    guided: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
    practice: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
    expert: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
  })
  const [statsView, setStatsView] = useState<StatsView>("overall")

  const [showRoundSummary, setShowRoundSummary] = useState(false)
  const [roundResult, setRoundResult] = useState<{
    message: string
    winAmount: number
    newBalance: number
  } | null>(null)

  const [showModeSelector, setShowModeSelector] = useState(false)

  const [roundsSinceReview, setRoundsSinceReview] = useState(0)

  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{
    newLevel: number
    totalWinnings: number
    accuracy: number
  } | null>(null)

  const [showBustMessage, setShowBustMessage] = useState(false)

  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const [viewHandIndex, setViewHandIndex] = useState(0)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showBuybackDrill, setShowBuybackDrill] = useState(false)
  const [drillTier, setDrillTier] = useState(0) // Track which tier

  const [isDoubled, setIsDoubled] = useState(false) // Reset doubled flag
  const isDoubledRef = useRef(false) // Ref to track doubled status synchronously

  // Leaderboard state
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardMetric, setLeaderboardMetric] = useState<"balance" | "level">("balance")
  const [leaderboardScope, setLeaderboardScope] = useState<"global" | "friends">("global")

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  useEffect(() => {
    loadUserStats()
  }, [userId])

  useEffect(() => {
    if (friendReferralId && friendReferralId !== userId) {
      handleFriendReferral(friendReferralId)
    }
  }, [friendReferralId, userId])

  useEffect(() => {
    if (statsLoaded && balance !== null) {
      // Only save when stats are loaded and balance has a value
      saveUserStats()
    }
  }, [balance, level, xp, handsPlayed, correctMoves, totalMoves, wins, losses, modeStats, totalWinnings, learningMode])

  useEffect(() => {
    const newDeck = createDeck()
    setDeck(newDeck)
  }, [])

  const loadUserStats = async () => {
    try {
      console.log("[v0] Loading stats for user:", userId)
      const { data, error } = await supabase.from("game_stats").select("*").eq("user_id", userId).single()

      if (error) {
        console.error("[v0] Error loading stats:", error)
        if (error.code === "PGRST116") {
          // No rows found - create initial stats
          console.log("[v0] No stats found, creating initial stats")
          const { error: insertError } = await supabase.from("game_stats").insert({
            user_id: userId,
            total_money: 500,
            total_winnings: 0,
            level: 1,
            experience: 0,
            hands_played: 0,
            correct_moves: 0,
            total_moves: 0,
            wins: 0,
            losses: 0,
            drill_tier: 0,
            last_play_mode: "guided",
            learning_hands_played: 0,
            learning_correct_moves: 0,
            learning_total_moves: 0,
            learning_wins: 0,
            learning_losses: 0,
            practice_hands_played: 0,
            practice_correct_moves: 0,
            practice_total_moves: 0,
            practice_wins: 0,
            practice_losses: 0,
            expert_hands_played: 0,
            expert_correct_moves: 0,
            expert_total_moves: 0,
            expert_wins: 0,
            expert_losses: 0,
          })

          if (insertError) {
            console.error("[v0] Error creating initial stats:", insertError)
          } else {
            console.log("[v0] Successfully created initial stats")
          }
        }
        // Set default values and mark as loaded
        setBalance(500)
        setTotalWinnings(0)
        setLevel(1)
        setXp(0)
        setHandsPlayed(0)
        setCorrectMoves(0)
        setTotalMoves(0)
        setWins(0)
        setLosses(0)
        setDrillTier(0)
        setModeStats({
          guided: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
          practice: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
          expert: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
        })
        setStatsLoaded(true)
        return
      }

      if (data) {
        setBalance(data.total_money ?? 500)
        setTotalWinnings(data.total_winnings ?? 0)
        setLevel(data.level ?? 1)
        setXp(data.experience ?? 0)
        setHandsPlayed(data.hands_played ?? 0)
        setCorrectMoves(data.correct_moves ?? 0)
        setTotalMoves(data.total_moves ?? 0)
        setWins(data.wins ?? 0)
        setLosses(data.losses ?? 0)
        setDrillTier(data.drill_tier ?? 0) // Load drill tier
        
        // Load last play mode, defaulting to "guided" if not set or invalid
        const savedMode = data.last_play_mode
        if (savedMode === "guided" || savedMode === "practice" || savedMode === "expert") {
          setLearningMode(savedMode)
        }

        setModeStats({
          guided: {
            handsPlayed: data.learning_hands_played ?? 0,
            correctMoves: data.learning_correct_moves ?? 0,
            totalMoves: data.learning_total_moves ?? 0,
            wins: data.learning_wins ?? 0,
            losses: data.learning_losses ?? 0,
          },
          practice: {
            handsPlayed: data.practice_hands_played ?? 0,
            correctMoves: data.practice_correct_moves ?? 0,
            totalMoves: data.practice_total_moves ?? 0,
            wins: data.practice_wins ?? 0,
            losses: data.practice_losses ?? 0,
          },
          expert: {
            handsPlayed: data.expert_hands_played ?? 0,
            correctMoves: data.expert_correct_moves ?? 0,
            totalMoves: data.expert_total_moves ?? 0,
            wins: data.expert_wins ?? 0,
            losses: data.expert_losses ?? 0,
          },
        })
      } else {
        // If no data, initialize with default values and set statsLoaded to true
        setBalance(500)
        setTotalWinnings(0)
        setLevel(1)
        setXp(0)
        setHandsPlayed(0)
        setCorrectMoves(0)
        setTotalMoves(0)
        setWins(0)
        setLosses(0)
        setDrillTier(0) // Initialize drill tier
        setModeStats({
          guided: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
          practice: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
          expert: { handsPlayed: 0, correctMoves: 0, totalMoves: 0, wins: 0, losses: 0 },
        })
      }

      setStatsLoaded(true)
    } catch (err) {
      console.error("[v0] Error in loadUserStats:", err)
      setStatsLoaded(true) // Ensure loading state is updated
      setBalance(500) // Fallback balance
    }
  }

  const saveUserStats = async () => {
    if (balance === null) return // Don't save if balance is not yet loaded

    try {
      const { error } = await supabase
        .from("game_stats")
        .update({
          total_money: Math.floor(balance),
          total_winnings: Math.floor(totalWinnings),
          level: Math.floor(level),
          experience: Math.floor(xp),
          hands_played: Math.floor(handsPlayed),
          correct_moves: Math.floor(correctMoves),
          total_moves: Math.floor(totalMoves),
          wins: Math.floor(wins),
          losses: Math.floor(losses),
          drill_tier: Math.floor(drillTier),
          learning_hands_played: Math.floor(modeStats.guided.handsPlayed),
          learning_correct_moves: Math.floor(modeStats.guided.correctMoves),
          learning_total_moves: Math.floor(modeStats.guided.totalMoves),
          learning_wins: Math.floor(modeStats.guided.wins),
          learning_losses: Math.floor(modeStats.guided.losses),
          practice_hands_played: Math.floor(modeStats.practice.handsPlayed),
          practice_correct_moves: Math.floor(modeStats.practice.correctMoves),
          practice_total_moves: Math.floor(modeStats.practice.totalMoves),
          practice_wins: Math.floor(modeStats.practice.wins),
          practice_losses: Math.floor(modeStats.practice.losses),
          expert_hands_played: Math.floor(modeStats.expert.handsPlayed),
          expert_correct_moves: Math.floor(modeStats.expert.correctMoves),
          expert_total_moves: Math.floor(modeStats.expert.totalMoves),
          expert_wins: Math.floor(modeStats.expert.wins),
          expert_losses: Math.floor(modeStats.expert.losses),
          last_play_mode: learningMode,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)

      if (error) {
        console.error("[v0] Error saving stats:", error)
      }
    } catch (err) {
      console.error("[v0] Error in saveUserStats:", err)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const promptLogout = () => {
    setShowLogoutConfirm(true)
  }

  const cancelLogout = () => {
    setShowLogoutConfirm(false)
  }

  const confirmLogout = () => {
    setShowLogoutConfirm(false)
    handleLogout()
  }

  const dealCard = (hand: CardType[], deckCopy: CardType[]): [CardType[], CardType[]] => {
    const card = deckCopy.pop()!
    return [[...hand, card], deckCopy]
  }

  const startNewHand = () => {
    if (currentBet === 0) return
    if (balance === null || balance < currentBet) return // Check if balance is loaded and sufficient

    setGameState("playing")
    setIsDealing(true)
    const betAmount = currentBet
    const newBalance = balance - currentBet
    setBalance(newBalance)
    setActiveBet(betAmount)
    setInitialBet(betAmount)
    setShowFeedback(false)
    setFeedbackData(null)
    setIsSplit(false)
    setSplitHand([])
    setCurrentHandIndex(0)
    setFirstHandResult(null)
    setFirstHandCards([])
    setShowBustMessage(false)
    setViewHandIndex(0) // Reset view hand index
    setIsDoubled(false) // Reset doubled flag
    isDoubledRef.current = false // Reset ref
    isDoubledRef.current = false // Reset ref

    let deckCopy = [...deck]

    if (deckCopy.length < 20) {
      deckCopy = createDeck()
    }

    setTimeout(() => {
      // Deal all cards simultaneously
      const [newDealerHand1, deck1] = dealCard([], deckCopy)
      const [newDealerHand2, deck2] = dealCard(newDealerHand1, deck1)
      const [newPlayerHand1, deck3] = dealCard([], deck2)
      const [newPlayerHand2, deck4] = dealCard(newPlayerHand1, deck3)

      setDealerHand(newDealerHand2)
      setPlayerHand(newPlayerHand2)
      setDeck(deck4)
      setDealerRevealed(false)
      setMessage("")
      setIsDealing(false)

      const dealerUpcard = newDealerHand2[0]
      const dealerUpcardValue = getCardValue(dealerUpcard)

      if (dealerUpcardValue === 11 || dealerUpcardValue === 10) {
        // Dealer peeks for blackjack
        const dealerValue = calculateHandValue(newDealerHand2)
        const playerValue = calculateHandValue(newPlayerHand2)

        if (dealerValue === 21 && newDealerHand2.length === 2) {
          // Dealer has blackjack - resolve immediately
          setDealerRevealed(true)

          if (playerValue === 21 && newPlayerHand2.length === 2) {
            // Both have blackjack - push
            const payout = settle({ result: "push", baseBet: betAmount, isDoubled: false, isBlackjack: true })
            const msg = "Push! Both Have Blackjack"
            setMessage(msg)
            setBalance((prev) => (prev !== null ? prev + payout : payout))
            setRoundResult({
              message: msg,
              winAmount: 0,
              newBalance: newBalance + payout,
            })
          } else {
            // Dealer wins with blackjack
            const msg = "Dealer Blackjack! You Lose"
            setMessage(msg)
            setTotalWinnings((prev) => prev - betAmount)
            setRoundResult({
              message: msg,
              winAmount: -betAmount,
              newBalance: newBalance,
            })
            setLosses((prev) => prev + 1)
            setModeStats((prev) => ({
              ...prev,
              [learningMode]: {
                ...prev[learningMode],
                losses: prev[learningMode].losses + 1,
              },
            }))
          }

          setGameState("finished")
          setHandsPlayed((prev) => prev + 1)
          setModeStats((prev) => ({
            ...prev,
            [learningMode]: {
              ...prev[learningMode],
              handsPlayed: prev[learningMode].handsPlayed + 1,
            },
          }))
          addExperience(3)
          const newRoundCount = roundsSinceReview + 1
          setRoundsSinceReview(newRoundCount)
          if (newRoundCount >= 30) {
            setShowRoundSummary(true)
            setRoundsSinceReview(0)
          }
          return
        }
      }

      // Check for player blackjack (only if dealer doesn't have blackjack)
      const playerValue = calculateHandValue(newPlayerHand2)
      if (playerValue === 21 && newPlayerHand2.length === 2) {
        checkForBlackjack(newPlayerHand2, newDealerHand2, betAmount, newBalance)
      }
    }, 100)
  }

  const checkForBlackjack = (pHand: CardType[], dHand: CardType[], betAmount: number, currentBalance: number) => {
    const playerValue = calculateHandValue(pHand)

    if (playerValue === 21 && pHand.length === 2) {
      setDealerRevealed(true)
      const payout = settle({ result: "win", baseBet: betAmount, isDoubled: false, isBlackjack: true })
      const profit = payout - betAmount
      const msg = "Blackjack! You Win 3:2"

      setMessage(msg)
      setBalance((prev) => (prev !== null ? prev + payout : payout))
      setTotalWinnings((prev) => prev + profit)
      setRoundResult({
        message: msg,
        winAmount: profit,
        newBalance: currentBalance + payout,
      })
      setGameState("finished")
      addExperience(15)
      const newRoundCount = roundsSinceReview + 1
      setRoundsSinceReview(newRoundCount)
      if (newRoundCount >= 30) {
        setShowRoundSummary(true)
        setRoundsSinceReview(0)
      }

      setWins((prev) => prev + 1)
      setModeStats((prev) => ({
        ...prev,
        [learningMode]: {
          ...prev[learningMode],
          wins: prev[learningMode].wins + 1,
        },
      }))

      setCorrectMoves((prev) => prev + 1)
      setTotalMoves((prev) => prev + 1)

      setHandsPlayed((prev) => prev + 1)
      setModeStats((prev) => ({
        ...prev,
        [learningMode]: {
          ...prev[learningMode],
          handsPlayed: prev[learningMode].handsPlayed + 1,
        },
      }))
    }
  }

  const checkPlayerAction = (action: GameAction) => {
    if (learningMode === "guided") return true

    const optimal = getOptimalMove(playerHand, dealerHand[0])
    const isCorrect = action === optimal

    setTotalMoves((prev) => prev + 1)
    setModeStats((prev) => ({
      ...prev,
      [learningMode]: {
        ...prev[learningMode],
        totalMoves: prev[learningMode].totalMoves + 1,
        correctMoves: isCorrect ? prev[learningMode].correctMoves + 1 : prev[learningMode].correctMoves,
      },
    }))

    if (isCorrect) {
      setCorrectMoves((prev) => prev + 1)
    }

    if (learningMode === "practice") {
      setFeedbackData({
        playerAction: action,
        optimalAction: optimal,
        isCorrect,
        explanation: getActionExplanation(optimal),
      })
      setShowFeedback(true)
    }

    return isCorrect
  }

  const hit = () => {
    checkPlayerAction("hit")

    const [newHand, newDeck] = dealCard(playerHand, [...deck])
    setPlayerHand(newHand)
    setDeck(newDeck)

    const value = calculateHandValue(newHand)
    if (value > 21) {
      if (isSplit && currentHandIndex === 0) {
        setFirstHandResult({ value, busted: true })
        setFirstHandCards(newHand)
        setShowBustMessage(true)
        setMessage("Hand 1 Busts!")

        setTimeout(() => {
          setShowBustMessage(false)
          setCurrentHandIndex(1) // Switch to the second hand
          setPlayerHand(splitHand) // Load the second hand cards
          setMessage("Playing second hand...")
        }, 600)
      } else {
        const msg = "Bust! You Lose"
        setMessage(msg)
        setTotalWinnings((prev) => (prev !== null ? prev - activeBet : -activeBet))
        setRoundResult({
          message: msg,
          winAmount: -activeBet,
          newBalance: balance !== null ? balance - activeBet : activeBet, // Fallback if balance is null
        })
        setGameState("finished")
        setDealerRevealed(true)
        setHandsPlayed((prev) => prev + 1)

        setLosses((prev) => prev + 1)
        setModeStats((prev) => ({
          ...prev,
          [learningMode]: {
            ...prev[learningMode],
            handsPlayed: prev[learningMode].handsPlayed + 1,
            losses: prev[learningMode].losses + 1,
          },
        }))
        setTotalMoves((prev) => prev + 1)

        addExperience(3)
        const newRoundCount = roundsSinceReview + 1
        setRoundsSinceReview(newRoundCount)
        if (newRoundCount >= 30) {
          setShowRoundSummary(true)
          setRoundsSinceReview(0)
        }
      }
    } else if (value === 21) {
      stand(newHand)
    }
  }

  const stand = (finalPlayerHand?: CardType[]) => {
    checkPlayerAction("stand")

    if (isSplit && currentHandIndex === 0) {
      const handToUse = finalPlayerHand || playerHand
      setFirstHandCards(handToUse)
      setFirstHandResult({ value: calculateHandValue(handToUse), busted: false })
      setCurrentHandIndex(1) // Move to the second hand
      setPlayerHand(splitHand) // Load the second hand cards for playing
      setMessage("Playing second hand...")
      console.log("[v0] Finished Hand 1, cards:", handToUse, "value:", calculateHandValue(handToUse))
    } else {
      setGameState("dealer")
      setDealerRevealed(true)
      const handToUse = finalPlayerHand || playerHand || []
      console.log("[v0] Standing on Hand 2, cards:", handToUse, "value:", calculateHandValue(handToUse))
      playDealerHand(handToUse)
    }
  }

  const playDealerHand = (finalPlayerHand: CardType[]) => {
    let currentDealerHand = [...dealerHand]
    let currentDeck = [...deck]

    console.log(
      "[v0] playDealerHand called with player hand:",
      finalPlayerHand,
      "value:",
      calculateHandValue(finalPlayerHand),
    )

    const dealerPlay = () => {
      const dealerValue = calculateHandValue(currentDealerHand)
      const dealerIsSoft = isSoftHand(currentDealerHand)

      if (dealerValue >= 17) {
        console.log("[v0] Dealer finished, hand:", currentDealerHand, "value:", dealerValue, "soft:", dealerIsSoft)
        if (isSplit) {
          finishSplitHand(firstHandCards, playerHand, currentDealerHand)
        } else {
          finishHand(finalPlayerHand, currentDealerHand)
        }
        return
      }

      // Dealer must hit on 16 or less
      setTimeout(() => {
        const [newHand, newDeck] = dealCard(currentDealerHand, currentDeck)
        currentDealerHand = newHand
        currentDeck = newDeck
        setDealerHand(newHand)
        setDeck(newDeck)
        dealerPlay()
      }, 400)
    }

    dealerPlay()
  }

  const finishSplitHand = (firstHandCards: CardType[], secondHandCards: CardType[], finalDealerHand: CardType[]) => {
    const dealerValue = calculateHandValue(finalDealerHand)
    const firstHandValue = calculateHandValue(firstHandCards)
    const secondHandValue = calculateHandValue(secondHandCards)

    console.log("[v0] ===== FINISH SPLIT HAND =====")
    console.log("[v0] Dealer hand:", finalDealerHand, "Value:", dealerValue)
    console.log("[v0] First hand cards:", firstHandCards, "Value:", firstHandValue)
    console.log("[v0] Second hand cards:", secondHandCards, "Value:", secondHandValue)
    console.log("[v0] First hand result from state:", firstHandResult)

    let totalPayout = 0
    const results: string[] = []
    let winsCount = 0

    let handsWon = 0
    let handsLost = 0
    let handsTotal = 2

    console.log("[v0] Evaluating first hand - Value:", firstHandValue)
    if (firstHandValue > 21) {
      results.push("Hand 1: Lose")
      handsLost++
      console.log("[v0] First hand busted")
    } else if (dealerValue > 21) {
      results.push("Hand 1: Win")
      totalPayout += activeBet * 2
      winsCount++
      handsWon++
      console.log("[v0] Dealer busted, first hand wins")
    } else if (firstHandValue > dealerValue) {
      results.push("Hand 1: Win")
      totalPayout += activeBet * 2
      winsCount++
      handsWon++
      console.log("[v0] First hand wins:", firstHandValue, ">", dealerValue)
    } else if (firstHandValue < dealerValue) {
      results.push("Hand 1: Lose")
      handsLost++
      console.log("[v0] First hand loses:", firstHandValue, "<", dealerValue)
    } else {
      results.push("Hand 1: Push")
      totalPayout += activeBet
      handsTotal-- // Don't count pushes in win rate
      console.log("[v0] First hand pushes")
    }

    console.log("[v0] Evaluating second hand - Value:", secondHandValue, "vs Dealer:", dealerValue)
    if (secondHandValue > 21) {
      results.push("Hand 2: Lose")
      handsLost++
      console.log("[v0] Second hand busted")
    } else if (dealerValue > 21) {
      results.push("Hand 2: Win")
      totalPayout += activeBet * 2
      winsCount++
      handsWon++
      console.log("[v0] Dealer busted, second hand wins")
    } else if (secondHandValue > dealerValue) {
      results.push("Hand 2: Win")
      totalPayout += activeBet * 2
      winsCount++
      handsWon++
      console.log("[v0] Second hand wins:", secondHandValue, ">", dealerValue)
    } else if (secondHandValue < dealerValue) {
      results.push("Hand 2: Lose")
      handsLost++
      console.log("[v0] Second hand loses:", secondHandValue, "<", dealerValue)
    } else {
      results.push("Hand 2: Push")
      totalPayout += activeBet
      handsTotal-- // Don't count pushes in win rate
      console.log("[v0] Second hand pushes")
    }

    console.log("[v0] Total payout:", totalPayout, "Active bet per hand:", activeBet)
    console.log("[v0] Results:", results)

    const totalBetAmount = activeBet * 2
    const netWinAmount = totalPayout - totalBetAmount

    const newBalance = balance !== null ? balance + totalPayout : totalPayout
    setBalance(newBalance)

    const resultMessage = results.join(" | ")
    setMessage(resultMessage)
    setRoundResult({
      message: resultMessage,
      winAmount: netWinAmount,
      newBalance: newBalance,
    })
    setGameState("finished")
    setHandsPlayed((prev) => prev + 1)

    setWins((prev) => prev + handsWon)
    setLosses((prev) => prev + handsLost)
    setModeStats((prev) => ({
      ...prev,
      [learningMode]: {
        ...prev[learningMode],
        handsPlayed: prev[learningMode].handsPlayed + 1,
        wins: prev[learningMode].wins + handsWon,
        losses: prev[learningMode].losses + handsLost,
      },
    }))

    setCorrectMoves((prev) => prev + handsWon)
    setTotalMoves((prev) => prev + handsTotal)

    if (winsCount === 2) {
      addExperience(12)
    } else if (winsCount === 1) {
      addExperience(8)
    } else {
      addExperience(4)
    }

    const newRoundCount = roundsSinceReview + 1
    setRoundsSinceReview(newRoundCount)
    if (newRoundCount >= 30) {
      setShowRoundSummary(true)
      setRoundsSinceReview(0)
    }
  }

  const finishHand = (finalPlayerHand: CardType[], finalDealerHand: CardType[]) => {
    const safePlayerHand = Array.isArray(finalPlayerHand) && finalPlayerHand.length > 0 ? finalPlayerHand : playerHand
    const safeDealerHand = Array.isArray(finalDealerHand) && finalDealerHand.length > 0 ? finalDealerHand : dealerHand

    const playerValue = calculateHandValue(safePlayerHand)
    const dealerValue = calculateHandValue(safeDealerHand)

    console.log("[v0] ===== FINISH HAND =====")
    console.log("[v0] Player hand:", safePlayerHand, "Value:", playerValue)
    console.log("[v0] Dealer hand:", safeDealerHand, "Value:", dealerValue)

    let result: "win" | "push" | "loss"
    let resultMessage = ""
    let didWin = false

    if (dealerValue > 21) {
      result = "win"
      resultMessage = "Dealer Busts! You Win"
      didWin = true
    } else if (playerValue > dealerValue) {
      result = "win"
      resultMessage = "You Win!"
      didWin = true
    } else if (playerValue < dealerValue) {
      result = "loss"
      resultMessage = "Dealer Wins"
    } else {
      result = "push"
      resultMessage = "Push! It's A Tie"
    }

    // Use ref to check if doubled to avoid closure issues with async state updates
    const wasDoubled = isDoubledRef.current
    const payout = settle({ result, baseBet: initialBet, isDoubled: wasDoubled, isBlackjack: false })
    const totalBetAmount = wasDoubled ? initialBet * 2 : initialBet
    const winAmount = payout - totalBetAmount
    
    // Use functional update to ensure we have the latest balance (important after doubleDown)
    setBalance((prevBalance) => {
      const calculatedNewBalance = prevBalance !== null ? prevBalance + payout : payout
      setRoundResult({
        message: resultMessage,
        winAmount: winAmount,
        newBalance: calculatedNewBalance,
      })
      // Check if balance is zero after this update
      if (calculatedNewBalance === 0) {
        setTimeout(() => {
          setGameState("betting")
          setShowModeSelector(true)
        }, 2000)
      }
      return calculatedNewBalance
    })
    setMessage(resultMessage)
    setGameState("finished")
    setHandsPlayed((prev) => prev + 1)

    if (didWin) {
      setWins((prev) => prev + 1)
      setTotalWinnings((prev) => prev + winAmount)
    } else if (result === "loss") {
      setLosses((prev) => prev + 1)
      setTotalWinnings((prev) => prev + winAmount)
    }

    setModeStats((prev) => ({
      ...prev,
      [learningMode]: {
        ...prev[learningMode],
        handsPlayed: prev[learningMode].handsPlayed + 1,
        wins: didWin ? prev[learningMode].wins + 1 : prev[learningMode].wins,
        losses: result === "loss" ? prev[learningMode].losses + 1 : prev[learningMode].losses,
      },
    }))

    if (didWin) {
      setCorrectMoves((prev) => prev + 1)
    }
    if (result !== "push") {
      setTotalMoves((prev) => prev + 1)
    }

    if (didWin) {
      addExperience(10)
    } else if (result === "push") {
      addExperience(5)
    } else {
      addExperience(3)
    }

    const newRoundCount = roundsSinceReview + 1
    setRoundsSinceReview(newRoundCount)
    if (newRoundCount >= 30) {
      setShowRoundSummary(true)
      setRoundsSinceReview(0)
    }
  }

  const doubleDown = () => {
    checkPlayerAction("double")

    if (balance === null || balance < activeBet) return // Check if balance is loaded and sufficient

    setIsDoubled(true)
    isDoubledRef.current = true // Update ref synchronously
    const additionalBet = activeBet
    setBalance((prev) => (prev !== null ? prev - additionalBet : -additionalBet))
    const newActiveBet = activeBet * 2
    setActiveBet(newActiveBet)

    const [newHand, newDeck] = dealCard(playerHand, [...deck])
    setPlayerHand(newHand)
    setDeck(newDeck)

    const value = calculateHandValue(newHand)
    if (value > 21) {
      const msg = "Bust! You Lose"
      setMessage(msg)
      const totalBetAmount = initialBet * 2
      setTotalWinnings((prev) => prev - totalBetAmount)
      // Use functional update to ensure we have the latest balance (already reduced by additionalBet)
      setBalance((prevBalance) => {
        const calculatedBalance = prevBalance !== null ? prevBalance : 0
        setRoundResult({
          message: msg,
          winAmount: -totalBetAmount,
          newBalance: calculatedBalance,
        })
        return calculatedBalance
      })
      setGameState("finished")
      setDealerRevealed(true)
      setHandsPlayed((prev) => prev + 1)

      setLosses((prev) => prev + 1)
      setModeStats((prev) => ({
        ...prev,
        [learningMode]: {
          ...prev[learningMode],
          handsPlayed: prev[learningMode].handsPlayed + 1,
          losses: prev[learningMode].losses + 1,
        },
      }))

      addExperience(3)
      const newRoundCount = roundsSinceReview + 1
      setRoundsSinceReview(newRoundCount)
      if (newRoundCount >= 30) {
        setShowRoundSummary(true)
        setRoundsSinceReview(0)
      }
    } else {
      stand(newHand)
    }
  }

  const canSplit = (hand: CardType[]) => {
    if (hand.length !== 2) return false
    if (balance === null || balance < activeBet) return false // Need enough balance for second hand

    const v1 = getCardValue(hand[0])
    const v2 = getCardValue(hand[1])
    return v1 === v2
  }

  const split = () => {
    if (!canSplit(playerHand)) return
    if (balance === null || balance < activeBet) return

    // Deduct the additional bet for the second hand
    setBalance((prev) => (prev !== null ? prev - activeBet : -activeBet))
    setIsSplit(true)

    // Split the cards
    const firstHand = [playerHand[0]]
    const secondHand = [playerHand[1]]

    // Deal a new card to each hand
    const deckCopy = [...deck]
    const [newFirstHand, deck1] = dealCard(firstHand, deckCopy)
    const [newSecondHand, deck2] = dealCard(secondHand, deck1)

    setPlayerHand(newFirstHand)
    setSplitHand(newSecondHand)
    setDeck(deck2)
    setCurrentHandIndex(0)
    setMessage("Playing first hand...")

    checkPlayerAction("split")
  }

  const optimalMove =
    gameState === "playing" && playerHand.length > 0 && dealerHand.length > 0
      ? getOptimalMove(playerHand, dealerHand[0])
      : null

  const getActionExplanation = (action: GameAction) => {
    const playerValue = calculateHandValue(playerHand)
    const dealerCard = dealerHand[0]?.rank || ""

    switch (action) {
      case "hit":
        return `${playerValue} vs ${dealerCard} - need more cards`
      case "stand":
        return `${playerValue} vs ${dealerCard} - strong enough`
      case "double":
        return `${playerValue} vs ${dealerCard} - favorable spot`
      case "split":
        return `Splitting improves odds`
    }
  }

  const clearBet = () => setCurrentBet(0)
  const addToBet = (amount: number) => {
    const newBet = currentBet + amount
    setCurrentBet(Math.min(balance !== null ? balance : 0, newBet))
  }
  const setMaxBet = () => setCurrentBet(Math.min(balance !== null ? balance : 0, 25000))

  const continueToNextHand = () => {
    setShowRoundSummary(false)
    setRoundResult(null)
    setGameState("betting")
    setPlayerHand([])
    setDealerHand([])
    setCurrentBet(0)
    setShowFeedback(false)
    setFeedbackData(null)
    setIsSplit(false)
    setSplitHand([])
    setCurrentHandIndex(0)
    setFirstHandResult(null)
    setFirstHandCards([])
    setShowBustMessage(false)
    setViewHandIndex(0) // Reset view hand index
    setInitialBet(0) // Reset initial bet
  }

  const repeatBet = () => {
    setCurrentBet(initialBet)
    setRoundResult(null)
    setPlayerHand([])
    setDealerHand([])
    setShowFeedback(false)
    setFeedbackData(null)
    setIsSplit(false)
    setSplitHand([])
    setCurrentHandIndex(0)
    setFirstHandResult(null)
    setFirstHandCards([])
    setShowBustMessage(false)
    setViewHandIndex(0)
    setIsDoubled(false) // Reset doubled flag
    isDoubledRef.current = false // Reset ref

    if (initialBet > 0 && balance !== null && balance >= initialBet) {
      // Check if balance is loaded
      startNewHand()
    }
  }

  const addExperience = (amount: number) => {
    setXp((prevXp) => {
      const newXp = prevXp + amount
      if (newXp >= 100) {
        const newLevel = level + 1
        setLevel(newLevel)
        const accuracy = totalMoves > 0 ? Math.round((correctMoves / totalMoves) * 100) : 0
        setLevelUpData({
          newLevel,
          totalWinnings,
          accuracy,
        })
        setShowLevelUp(true)
        return newXp - 100
      }
      return newXp
    })
  }

  const closeLevelUp = () => {
    setShowLevelUp(false)
    setLevelUpData(null)
  }

  const getModeIcon = () => {
    switch (learningMode) {
      case "guided":
        return GraduationCap
      case "practice":
        return Target
      case "expert":
        return Trophy
      default:
        return Lightbulb
    }
  }

  const ModeIcon = getModeIcon()

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    if (!isSplit || gameState !== "finished") return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && viewHandIndex === 0) {
      setViewHandIndex(1)
      setPlayerHand(splitHand)
    }

    if (isRightSwipe && viewHandIndex === 1) {
      setViewHandIndex(0)
      setPlayerHand(firstHandCards)
    }
  }

  const switchToHand = (handIndex: number) => {
    if (!isSplit || gameState !== "finished") return
    setViewHandIndex(handIndex)
    if (handIndex === 0) {
      setPlayerHand(firstHandCards)
    } else {
      setPlayerHand(splitHand)
    }
  }

  const getDisplayStats = () => {
    if (statsView === "overall") {
      return {
        handsPlayed,
        accuracy: totalMoves > 0 ? Math.round((correctMoves / totalMoves) * 100) : 0,
        winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      }
    } else {
      const stats = modeStats[learningMode]
      return {
        handsPlayed: stats.handsPlayed,
        accuracy: stats.totalMoves > 0 ? Math.round((stats.correctMoves / stats.totalMoves) * 100) : 0,
        winRate: stats.wins + stats.losses > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0,
      }
    }
  }

  const displayStats = getDisplayStats()

  const getModeDisplayName = () => {
    switch (learningMode) {
      case "guided":
        return "Learning"
      case "practice":
        return "Practice"
      case "expert":
        return "Expert"
      default:
        return "This Mode"
    }
  }

  const startBuybackDrill = () => {
    setShowBuybackDrill(true)
  }

  const handleDrillSuccess = (amount: number) => {
    setBalance((prev) => (prev !== null ? prev + amount : amount))
    setDrillTier((prev) => Math.min(prev + 1, 2)) // Advance tier, max at tier 3 (index 2)
    setShowBuybackDrill(false)
  }

  const closeDrill = () => {
    setShowBuybackDrill(false)
  }

  const handleFriendReferral = async (referrerId: string) => {
    try {
      console.log("[v0] Processing friend referral from:", referrerId)

      const response = await fetch("/api/me/friends/auto-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUserId: referrerId }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        console.log("[v0] Friend referral processed successfully")
        
        // Fetch friend's username to display in toast
        try {
          const { data: profileData, error: profileError } = await supabase
            .from("user_profiles")
            .select("display_name")
            .eq("id", referrerId)
            .single()

          const friendName = profileData?.display_name || "your friend"
          
          toast({
            title: "Friend Added!",
            description: `You've successfully connected with ${friendName}!`,
          })
        } catch (profileError) {
          // If we can't fetch the username, show generic message
          console.error("[v0] Failed to fetch friend's profile:", profileError)
          toast({
            title: "Friend Added!",
            description: "You've successfully connected with your friend!",
          })
        }
      } else if (response.ok && !data.success) {
        // Handle case where friend is already added or other non-error response
        if (data.message === "Already friends") {
          toast({
            title: "Already Friends",
            description: "You're already connected with this friend.",
          })
        } else if (data.message === "Cannot add yourself") {
          // Don't show toast for this case
        } else {
          toast({
            title: "Notice",
            description: data.message || "Friend connection status updated.",
          })
        }
      } else {
        // Handle error response
        toast({
          title: "Error",
          description: data.error || "Failed to add friend",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Failed to process friend referral:", error)
      toast({
        title: "Error",
        description: "Failed to process friend connection",
        variant: "destructive",
      })
    }
  }

  if (!statsLoaded || balance === null) {
    return (
      <div className="h-dvh overflow-hidden flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-xl font-semibold text-white">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-black">
      {showBuybackDrill && (
        <BuybackDrillModal
          onClose={closeDrill}
          onSuccess={handleDrillSuccess}
          userId={userId}
          currentTier={drillTier}
        />
      )}

      <LeaderboardModal open={showLeaderboard} onOpenChange={setShowLeaderboard} userId={userId} />

      {showLogoutConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-sm w-full mx-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 text-center">Log Out?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-center">
              Are you sure you want to log out? Your progress has been saved.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={cancelLogout} variant="outline" className="flex-1 h-10 sm:h-11 bg-transparent text-sm sm:text-base">
                Cancel
              </Button>
              <Button onClick={confirmLogout} variant="destructive" className="flex-1 h-10 sm:h-11 text-sm sm:text-base">
                Log Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {showLevelUp && levelUpData && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="flex flex-col items-center justify-center w-full max-w-md">
            <div className="text-center space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-8">Level {levelUpData.newLevel}</div>

              {/* Stats Display */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full">
                {/* Total Winnings Stat */}
                <div className="bg-card/80 backdrop-blur border-2 border-primary/50 rounded-xl p-4 sm:p-6 w-full sm:min-w-[180px] transform hover:scale-105 transition-all duration-300">
                  <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">
                    ${levelUpData.totalWinnings.toLocaleString()}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">Total Winnings</div>
                </div>

                {/* Accuracy Stat */}
                <div className="bg-card/80 backdrop-blur border-2 border-primary/50 rounded-xl p-4 sm:p-6 w-full sm:min-w-[180px] transform hover:scale-105 transition-all duration-300">
                  <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">{levelUpData.accuracy}%</div>
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">Accuracy</div>
                </div>
              </div>

              {/* Continue Button */}
              <Button
                onClick={closeLevelUp}
                size="lg"
                className="mt-4 sm:mt-8 px-8 sm:px-12 h-12 sm:h-14 text-base sm:text-lg font-semibold animate-in fade-in duration-1000 delay-500 w-full sm:w-auto"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b border-border flex-shrink-0 transition-all duration-300">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-sm sm:text-base font-medium text-white">Level {level}</div>
              <div className="h-2 sm:h-2.5 w-16 sm:w-24 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-in-out"
                  style={{ width: `${xp}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-base sm:text-lg font-bold text-white transition-all duration-300">
            ${balance !== null ? balance.toLocaleString() : "..."}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 sm:h-9 sm:w-9 p-0 transition-all duration-200 hover:scale-110"
            onClick={() => setShowModeSelector(!showModeSelector)}
            disabled={showModeSelector || gameState === "betting"}
          >
            <ModeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 sm:h-9 sm:w-9 p-0 transition-all duration-200 hover:scale-110"
            onClick={promptLogout}
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>

      <div
        className={`flex-1 flex flex-col px-2 sm:px-3 py-2 sm:py-4 min-h-0 relative ${gameState === "betting" || showModeSelector ? "justify-center items-center" : "justify-evenly"}`}
      >
        {/* Dealer Section */}
        <div className="flex justify-center">
          {!showModeSelector && dealerHand.length > 0 && (
            <div className="text-center">
              <div className="text-xs sm:text-sm text-white mb-1 sm:mb-2">Dealer</div>
              {dealerRevealed ? (
                (() => {
                  const handInfo = getHandValueInfo(dealerHand)
                  return handInfo.isSoft ? (
                    <div className="flex gap-1.5 sm:gap-2 justify-center mb-2 sm:mb-4">
                      <Badge variant="secondary" className="text-base sm:text-lg font-bold px-2 sm:px-3 py-1 sm:py-1.5 min-w-[50px] sm:min-w-[60px]">
                        {handInfo.hardValue}
                      </Badge>
                      <Badge variant="default" className="text-base sm:text-lg font-bold px-2 sm:px-3 py-1 sm:py-1.5 min-w-[50px] sm:min-w-[60px] bg-primary">
                        {handInfo.value}
                      </Badge>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="mb-2 sm:mb-4 text-lg sm:text-xl font-bold px-2 sm:px-3 py-1 sm:py-1.5 min-w-[60px] sm:min-w-[70px]">
                      {handInfo.value}
                    </Badge>
                  )
                })()
              ) : (
                <Badge variant="secondary" className="mb-2 sm:mb-4 text-lg sm:text-xl font-bold px-2 sm:px-3 py-1 sm:py-1.5 min-w-[60px] sm:min-w-[70px]">
                  ?
                </Badge>
              )}
              <div className="flex justify-start">
                <div className={`flex justify-start ${dealerHand.length >= 4 ? "" : "gap-1.5 sm:gap-2"}`}>
                  {dealerHand.map((card, index) => (
                    <div key={index} className={dealerHand.length >= 4 && index > 0 ? "-ml-12 sm:-ml-20" : ""}>
                      <PlayingCard card={card} hidden={index === 1 && !dealerRevealed} delay={0} owner="dealer" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {gameState === "betting" || showModeSelector ? (
            <div className="w-full h-full flex items-center justify-center px-2 sm:px-4">
              <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center">
                <div className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-3 text-center">Select Play Mode</div>
                <div className="space-y-1.5 sm:space-y-2 w-full">
                  {[
                    {
                      mode: "guided" as LearningMode,
                      title: "Learning",
                      desc: "See optimal moves",
                      icon: GraduationCap,
                    },
                    { mode: "practice" as LearningMode, title: "Practice", desc: "Get feedback", icon: Target },
                    { mode: "expert" as LearningMode, title: "Expert", desc: "No hints", icon: Trophy },
                  ].map(({ mode, title, desc, icon: Icon }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setLearningMode(mode)
                        setShowModeSelector(false)
                      }}
                      className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm transition-all duration-200 ease-in-out ${
                        learningMode === mode
                          ? "bg-primary text-primary-foreground scale-[1.02]"
                          : "bg-card border border-border hover:bg-muted hover:scale-[1.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold">{title}</div>
                          <div className="text-xs opacity-80">{desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3 w-full">
                  <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">{displayStats.handsPlayed}</div>
                    <div className="text-xs text-muted-foreground mt-1">Hands Played</div>
                  </div>
                  <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">{displayStats.accuracy}%</div>
                    <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
                  </div>
                  <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">{displayStats.winRate}%</div>
                    <div className="text-xs text-muted-foreground mt-1">Win Rate</div>
                  </div>
                </div>

                <div className="mt-2 sm:mt-3 flex justify-center">
                  <div className="inline-flex rounded-lg border border-border p-0.5 sm:p-1 bg-card">
                    <button
                      onClick={() => setStatsView("perMode")}
                      className={`px-2 sm:px-3 py-1 text-xs font-medium rounded transition-all ${
                        statsView === "perMode"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {getModeDisplayName()}
                    </button>
                    <button
                      onClick={() => setStatsView("overall")}
                      className={`px-2 sm:px-3 py-1 text-xs font-medium rounded transition-all ${
                        statsView === "overall"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Overall
                    </button>
                  </div>
                </div>

                <div className="mt-2 sm:mt-3">
                  <LeaderboardChip
                    onClick={() => setShowLeaderboard(true)}
                    metric={leaderboardMetric}
                    scope={leaderboardScope}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {(gameState === "playing" || gameState === "dealer") && activeBet > 0 && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 text-xs sm:text-sm text-white bg-black/50 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-border">
            Bet:{" "}
            <span className="font-semibold text-foreground">
              ${isSplit ? (activeBet * 2).toLocaleString() : activeBet.toLocaleString()}
            </span>
          </div>
        )}

        {!showModeSelector && (
          <>
            {/* Message Section */}
            {(gameState === "finished" && roundResult) ||
            (learningMode === "guided" && showHint && optimalMove && gameState === "playing" && !isDealing) ||
            (showFeedback && feedbackData && learningMode === "practice" && gameState !== "finished") ? (
              <div className="flex items-center justify-center px-2 sm:px-3">
                <div className="w-full max-w-md">
                  <div className="border border-muted/30 rounded-lg min-h-[80px] sm:h-[100px] flex items-center justify-center relative backdrop-blur-sm overflow-hidden">
                  {/* Result Message - Combined with Feedback in Practice Mode */}
                  <div
                    className={`absolute inset-0 rounded-lg flex items-center justify-center transition-opacity duration-300 ease-in ${
                      gameState === "finished" && roundResult ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    {roundResult && (
                      <div className="text-center w-full">
                        {learningMode === "practice" && feedbackData ? (
                          <div className="flex items-stretch w-full gap-1.5 sm:gap-2 px-1.5 sm:px-2">
                            {/* Left: Feedback */}
                            <div
                              className={`flex-1 flex items-center py-2 sm:py-2.5 px-2 sm:px-3 rounded-l-lg ${
                                feedbackData.isCorrect ? "bg-success/10 border border-success" : "bg-error/10 border border-error"
                              }`}
                            >
                              <div className="text-xs sm:text-sm text-left w-full">
                                <p className="font-semibold leading-tight">{feedbackData.isCorrect ? "Correct!" : "Not Optimal"}</p>
                                <p className="text-xs opacity-80 leading-tight">
                                  {!feedbackData.isCorrect &&
                                    `Should be ${feedbackData.optimalAction.toUpperCase()}. `}
                                  {feedbackData.explanation}
                                </p>
                              </div>
                            </div>

                            {/* Vertical divider */}
                            <div className="w-px bg-border self-stretch" />

                            {/* Right: Result */}
                            <div
                              className={`flex-1 flex items-center justify-center py-2 sm:py-2.5 px-2 sm:px-3 rounded-r-lg ${
                                roundResult.winAmount > 0
                                  ? "bg-success/10 border border-success"
                                  : roundResult.winAmount < 0
                                    ? "bg-error/10 border border-error"
                                    : "bg-muted/10 border border-muted"
                              }`}
                            >
                              <div
                                className={`text-center ${
                                  roundResult.winAmount > 0
                                    ? "text-success"
                                    : roundResult.winAmount < 0
                                      ? "text-error"
                                      : "text-foreground"
                                }`}
                              >
                                <div className="text-xs sm:text-sm font-semibold">{roundResult.message}</div>
                                <div className="text-base sm:text-lg lg:text-xl font-bold mt-0.5">
                                  {roundResult.winAmount > 0 ? "+" : roundResult.winAmount < 0 ? "-" : ""}$
                                  {Math.abs(roundResult.winAmount).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Show result only in other modes
                          <div className="w-full flex items-center justify-center">
                            <div
                              className={`inline-flex items-center justify-center rounded-lg py-2 sm:py-3 px-3 sm:px-4 min-w-[200px] sm:min-w-[240px] ${
                                roundResult.winAmount > 0
                                  ? "bg-success/20 border border-success"
                                  : roundResult.winAmount < 0
                                    ? "bg-error/20 border border-error"
                                    : "bg-muted/20 border border-muted"
                              }`}
                            >
                              <div
                                className={`text-lg font-bold whitespace-nowrap ${
                                  roundResult.winAmount > 0
                                    ? "text-success"
                                    : roundResult.winAmount < 0
                                      ? "text-error"
                                      : "text-foreground"
                                }`}
                              >
                                {roundResult.message}{" "}
                                <span className="text-xl">
                                  {roundResult.winAmount > 0 ? "+" : ""}$
                                  {Math.abs(roundResult.winAmount).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Optimal Hint Message */}
                  <div
                    className={`absolute left-1.5 right-1.5 sm:left-2 sm:right-2 bottom-2 sm:bottom-4 bg-success/10 border border-success rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 flex items-center justify-center transition-opacity duration-300 ease-in ${
                      learningMode === "guided" && showHint && optimalMove && gameState === "playing" && !isDealing
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    {optimalMove && (
                      <div className="flex items-start gap-1 sm:gap-1.5">
                        <Lightbulb className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0 text-success" />
                        <div className="text-xs sm:text-sm">
                          <p className="font-semibold">Optimal: {optimalMove.toUpperCase()}</p>
                          <p className="text-xs opacity-80 leading-tight">{getActionExplanation(optimalMove)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Practice Mode Feedback */}
                  <div
                    className={`absolute left-1.5 right-1.5 sm:left-2 sm:right-2 bottom-2 sm:bottom-4 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 flex items-center justify-center transition-opacity duration-300 ease-in ${
                      showFeedback && feedbackData && learningMode === "practice" && gameState !== "finished"
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    } ${
                      feedbackData && feedbackData.isCorrect
                        ? "bg-success/10 border border-success"
                        : "bg-error/10 border border-error"
                    }`}
                  >
                    {feedbackData && (
                      <div className="flex items-start gap-1 sm:gap-1.5 w-full">
                        {feedbackData.isCorrect ? (
                          <Lightbulb className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0 text-success" />
                        ) : (
                          <X className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0 text-error" />
                        )}
                        <div className="text-xs sm:text-sm flex-1">
                          <p className="font-semibold">{feedbackData.isCorrect ? "Correct!" : "Not Optimal"}</p>
                          <p className="text-xs opacity-80 leading-tight">
                            {!feedbackData.isCorrect &&
                              `Should be ${feedbackData.optimalAction.toUpperCase()}. `}
                            {feedbackData.explanation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            ) : null}

            {/* Player Section */}
            <div className="flex justify-center items-center gap-3">
              {isSplit && gameState === "finished" && (
                <button
                  onClick={() => switchToHand(0)}
                  disabled={viewHandIndex === 0}
                  className="disabled:opacity-30 transition-all hover:scale-110 disabled:hover:scale-100"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </button>
              )}

              <div className="text-center">
                {playerHand.length > 0 && (
                  <>
                    <div className="text-xs sm:text-sm text-white mb-1 sm:mb-2 flex items-center justify-center gap-2">
                      {isSplit && gameState === "finished" ? `Hand ${viewHandIndex + 1}` : "Your Hand"}
                    </div>
                    {(() => {
                      const handInfo = getHandValueInfo(playerHand)
                      return handInfo.isSoft ? (
                        <div className="flex gap-1.5 sm:gap-2 justify-center mb-2 sm:mb-4">
                          <Badge variant="outline" className="text-base sm:text-lg font-bold px-2 sm:px-3 py-1 sm:py-1.5 min-w-[50px] sm:min-w-[60px]">
                            {handInfo.hardValue}
                          </Badge>
                          <Badge variant="default" className="text-base sm:text-lg font-bold px-2 sm:px-3 py-1 sm:py-1.5 min-w-[50px] sm:min-w-[60px] bg-primary">
                            {handInfo.value}
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="default" className="mb-2 sm:mb-4 text-lg sm:text-xl font-bold px-2 sm:px-3 py-1 sm:py-1.5 min-w-[60px] sm:min-w-[70px] bg-primary">
                          {handInfo.value}
                        </Badge>
                      )
                    })()}
                    <div
                      className="flex justify-start"
                      onTouchStart={onTouchStart}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onTouchEnd}
                    >
                      <div className={`flex justify-start ${playerHand.length >= 4 ? "" : "gap-1.5 sm:gap-2"}`}>
                        {playerHand.map((card, index) => (
                          <div key={index} className={playerHand.length >= 4 && index > 0 ? "-ml-12 sm:-ml-20" : ""}>
                            <PlayingCard card={card} delay={0} owner="player" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {isSplit && gameState === "finished" && (
                <button
                  onClick={() => switchToHand(1)}
                  disabled={viewHandIndex === 1}
                  className="disabled:opacity-30 transition-all hover:scale-110 disabled:hover:scale-100"
                >
                  <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {(gameState === "playing" || gameState === "dealer") && !showModeSelector && (
        <div className="px-2 sm:px-3 py-2 sm:py-3 flex justify-center gap-1.5 sm:gap-2 flex-shrink-0 border-t border-border">
          {canSplit(playerHand) && playerHand.length === 2 && !isSplit && (
            <Button
              onClick={split}
              disabled={isDealing || gameState === "dealer" || balance === null || balance < activeBet}
              variant={learningMode === "guided" && optimalMove === "split" ? "default" : "outline"}
              size="lg"
              className="flex-1 h-12 sm:h-14 text-sm sm:text-base transition-all duration-200 ease-in hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              Split
            </Button>
          )}
          <Button
            onClick={() => stand()}
            disabled={isDealing || gameState === "dealer"}
            variant={learningMode === "guided" && optimalMove === "stand" ? "default" : "secondary"}
            size="lg"
            className="flex-1 h-12 sm:h-14 text-sm sm:text-base transition-all duration-200 ease-in hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            Stand
          </Button>
          <Button
            onClick={hit}
            disabled={isDealing || gameState === "dealer"}
            variant={learningMode === "guided" && optimalMove === "hit" ? "default" : "outline"}
            size="lg"
            className="flex-1 h-12 sm:h-14 text-sm sm:text-base transition-all duration-200 ease-in hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            Hit
          </Button>
          {playerHand.length === 2 && !isSplit && (
            <Button
              onClick={doubleDown}
              disabled={isDealing || gameState === "dealer" || balance === null || balance < activeBet}
              variant={learningMode === "guided" && optimalMove === "double" ? "default" : "outline"}
              size="lg"
              className="flex-1 h-12 sm:h-14 text-sm sm:text-base transition-all duration-200 ease-in hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              Double
            </Button>
          )}
        </div>
      )}

      {gameState === "betting" && (
        <div className="px-2 sm:px-3 py-2 sm:py-2 flex-shrink-0 border-t border-border animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out">
          <div className="text-center mb-2">
            <div className="text-xs text-white mb-1">Place Your Bet</div>
            <div className="text-xl sm:text-2xl font-bold transition-all duration-500 ease-out">
              ${currentBet.toLocaleString()}
            </div>
          </div>

          <div className="flex justify-center gap-1.5 sm:gap-2 mb-2">
            <Button
              onClick={clearBet}
              variant="destructive"
              size="sm"
              className="h-9 sm:h-10 px-3 sm:px-4 text-sm sm:text-base transition-all duration-300 ease-out hover:scale-105 disabled:hover:scale-100"
            >
              Clear
            </Button>
            <Button
              onClick={startNewHand}
              disabled={currentBet === 0 || isDealing || balance === null || balance < currentBet}
              size="sm"
              className="h-9 sm:h-10 px-4 sm:px-6 text-sm sm:text-base transition-all duration-300 ease-out hover:scale-105 disabled:hover:scale-100 bg-success hover:bg-success/90"
            >
              Deal
            </Button>
          </div>

          {balance === 0 ? (
            <div className="flex justify-center">
              <Button
                onClick={startBuybackDrill}
                variant="default"
                size="lg"
                className="w-full h-14 sm:h-16 bg-primary hover:bg-primary/90 transition-all duration-300 ease-out hover:scale-105 text-base sm:text-lg font-semibold"
              >
                Start $0 Buyback Drill
              </Button>
            </div>
          ) : (
            <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap max-w-md mx-auto">
              {/* Replace $50 with user's balance if balance is less than $50 */}
              <Button
                onClick={() => addToBet(balance !== null && balance < 50 ? balance : 50)}
                disabled={balance === null || balance === 0}
                variant="outline"
                size="lg"
                className="h-14 sm:h-16 px-4 sm:px-8 bg-transparent transition-all duration-300 ease-out hover:scale-105 disabled:hover:scale-100 text-base sm:text-lg font-semibold"
              >
                ${balance !== null && balance < 50 ? balance : 50}
              </Button>
              <Button
                onClick={() => addToBet(100)}
                disabled={balance === null || 100 > balance}
                variant="outline"
                size="lg"
                className="h-14 sm:h-16 px-4 sm:px-8 bg-transparent transition-all duration-300 ease-out hover:scale-105 disabled:hover:scale-100 text-base sm:text-lg font-semibold"
              >
                $100
              </Button>
              <Button
                onClick={() => addToBet(500)}
                disabled={balance === null || 500 > balance}
                variant="outline"
                size="lg"
                className="h-14 sm:h-16 px-4 sm:px-8 bg-transparent transition-all duration-300 ease-out hover:scale-105 disabled:hover:scale-100 text-base sm:text-lg font-semibold"
              >
                $500
              </Button>
            </div>
          )}
        </div>
      )}

      {gameState === "finished" && !showRoundSummary && (
        <div className="px-2 sm:px-3 py-2 sm:py-3 flex-shrink-0 border-t border-border animate-in slide-in-from-bottom-4 fade-in duration-400 ease-out">
          {balance !== null && balance > 0 ? (
            <div className="flex gap-1.5 sm:gap-2">
              <Button
                onClick={continueToNextHand}
                variant="outline"
                className="flex-1 bg-transparent transition-all duration-200 hover:scale-[1.02] h-12 sm:h-14 px-4 sm:px-8 text-sm sm:text-base"
                size="lg"
              >
                Change Bet
              </Button>
              <Button
                onClick={repeatBet}
                className="flex-1 transition-all duration-200 hover:scale-[1.02] h-12 sm:h-14 px-4 sm:px-10 text-sm sm:text-base"
                size="lg"
                disabled={balance < initialBet}
              >
                Repeat Bet (${initialBet.toLocaleString()})
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button
                onClick={startBuybackDrill}
                variant="default"
                size="lg"
                className="w-full h-14 sm:h-16 bg-primary hover:bg-primary/90 transition-all duration-300 ease-out hover:scale-105 text-base sm:text-lg font-semibold"
              >
                Start $0 Buyback Drill
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
