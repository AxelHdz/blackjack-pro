import { calculateHandValue, createDeck, isSoftHand, type Card } from "@/lib/card-utils"
import { settle } from "@/lib/settlement"
import { getXPPerWinWithBet } from "@/lib/leveling-config"

export type SingleHandResolutionInput = {
  playerHand: Card[]
  dealerHand: Card[]
  baseBet: number
  isDoubled: boolean
  level: number
}

export type SingleHandResolution = {
  result: "win" | "loss" | "push"
  message: string
  payout: number
  totalBet: number
  winAmount: number
  winsDelta: number
  lossesDelta: number
  totalMovesDelta: number
  correctMovesDelta: number
  handsPlayedDelta: number
  xpGain: number
}

export type SplitHandResolutionInput = {
  firstHand: Card[]
  secondHand: Card[]
  dealerHand: Card[]
  betPerHand: number
  level: number
}

export type SplitHandResolution = {
  message: string
  payout: number
  totalBet: number
  winAmount: number
  winsDelta: number
  lossesDelta: number
  totalMovesDelta: number
  correctMovesDelta: number
  handsPlayedDelta: number
  xpGain: number
}

export function ensureDeckHasCards(deck: Card[]): Card[] {
  return deck.length > 0 ? deck : createDeck()
}

export function dealCard(hand: Card[], deck: Card[]): [Card[], Card[]] {
  const deckWithCards = ensureDeckHasCards([...deck])
  const card = deckWithCards.pop()!
  return [[...hand, card], deckWithCards]
}

export function dealerShouldHitH17(hand: Card[]): boolean {
  const dealerValue = calculateHandValue(hand)
  const soft = isSoftHand(hand)
  if (dealerValue > 17) return false
  if (dealerValue === 17) return soft
  return true
}

export function resolveSingleHand({
  playerHand,
  dealerHand,
  baseBet,
  isDoubled,
  level,
}: SingleHandResolutionInput): SingleHandResolution {
  const playerValue = calculateHandValue(playerHand)
  const dealerValue = calculateHandValue(dealerHand)

  let result: "win" | "loss" | "push"
  let message: string

  if (dealerValue > 21) {
    result = "win"
    message = "Dealer Busts! You Win"
  } else if (playerValue > dealerValue) {
    result = "win"
    message = "You Win!"
  } else if (playerValue < dealerValue) {
    result = "loss"
    message = "Dealer Wins"
  } else {
    result = "push"
    message = "Push! It's A Tie"
  }

  const payout = settle({ result, baseBet, isDoubled, isBlackjack: false })
  const totalBet = isDoubled ? baseBet * 2 : baseBet
  const winAmount = payout - totalBet
  const winsDelta = result === "win" ? 1 : 0
  const lossesDelta = result === "loss" ? 1 : 0
  const totalMovesDelta = result === "push" ? 0 : 1
  const correctMovesDelta = winsDelta
  const xpGain = winsDelta ? getXPPerWinWithBet(level, totalBet) : 0

  return {
    result,
    message,
    payout,
    totalBet,
    winAmount,
    winsDelta,
    lossesDelta,
    totalMovesDelta,
    correctMovesDelta,
    handsPlayedDelta: 1,
    xpGain,
  }
}

export function resolveSplitHands({
  firstHand,
  secondHand,
  dealerHand,
  betPerHand,
  level,
}: SplitHandResolutionInput): SplitHandResolution {
  const dealerValue = calculateHandValue(dealerHand)
  const firstValue = calculateHandValue(firstHand)
  const secondValue = calculateHandValue(secondHand)

  const handOutcomes: Array<"win" | "loss" | "push"> = []
  const results: string[] = []
  let payout = 0
  let winsDelta = 0
  let lossesDelta = 0
  let totalMovesDelta = 2

  const evaluateHand = (label: string, playerValue: number) => {
    if (playerValue > 21) {
      results.push(`${label}: Lose`)
      handOutcomes.push("loss")
      lossesDelta += 1
      return
    }

    if (dealerValue > 21) {
      results.push(`${label}: Win`)
      handOutcomes.push("win")
      winsDelta += 1
      payout += betPerHand * 2
      return
    }

    if (playerValue > dealerValue) {
      results.push(`${label}: Win`)
      handOutcomes.push("win")
      winsDelta += 1
      payout += betPerHand * 2
      return
    }

    if (playerValue < dealerValue) {
      results.push(`${label}: Lose`)
      handOutcomes.push("loss")
      lossesDelta += 1
      return
    }

    results.push(`${label}: Push`)
    handOutcomes.push("push")
    payout += betPerHand
    totalMovesDelta -= 1 // Don't count pushes in move totals
  }

  evaluateHand("Hand 1", firstValue)
  evaluateHand("Hand 2", secondValue)

  const totalBet = betPerHand * 2
  const winAmount = payout - totalBet
  const correctMovesDelta = winsDelta
  const xpGain = winsDelta > 0 ? getXPPerWinWithBet(level, betPerHand) * winsDelta : 0

  return {
    message: results.join(" | "),
    payout,
    totalBet,
    winAmount,
    winsDelta,
    lossesDelta,
    totalMovesDelta,
    correctMovesDelta,
    handsPlayedDelta: 1,
    xpGain,
  }
}
