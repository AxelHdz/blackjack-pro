import { type Card, calculateHandValue, getCardValue, isSoftHand } from "./card-utils"

export type GameAction = "hit" | "stand" | "double" | "split"

interface StrategyRule {
  action: GameAction
  fallback: GameAction | null
  tip: string
  feedback: string
}

// Get dealer card as string for rule matching
function getDealerCardString(card: Card): string {
  if (card.rank === "A") return "A"
  if (["J", "Q", "K"].includes(card.rank)) return "10"
  return card.rank
}

// Check if hand is a pair
function isPair(playerHand: Card[]): boolean {
  if (playerHand.length !== 2) return false
  const v1 = getCardValue(playerHand[0])
  const v2 = getCardValue(playerHand[1])
  return v1 === v2
}

export function getOptimalMove(playerHand: Card[], dealerUpCard: Card): GameAction {
  const rule = getStrategyRule(playerHand, dealerUpCard)
  const canDouble = playerHand.length === 2

  if (rule.action === "double" && !canDouble && rule.fallback) {
    return rule.fallback
  }

  return rule.action
}

export function getTipMessage(playerHand: Card[], dealerUpCard: Card): string {
  const rule = getStrategyRule(playerHand, dealerUpCard)
  return rule.tip
}

export function getFeedbackMessage(playerHand: Card[], dealerUpCard: Card): string {
  const rule = getStrategyRule(playerHand, dealerUpCard)
  return rule.feedback
}

function getStrategyRule(playerHand: Card[], dealerUpCard: Card): StrategyRule {
  const playerValue = calculateHandValue(playerHand)
  const dealerCard = getDealerCardString(dealerUpCard)
  const dealerValue = getCardValue(dealerUpCard)
  const isFirstTwoCards = playerHand.length === 2

  // Check pairs first
  if (isFirstTwoCards && isPair(playerHand)) {
    return getPairRule(playerHand[0], dealerCard, dealerValue)
  }

  // Check soft hands
  if (isSoftHand(playerHand)) {
    return getSoftHandRule(playerHand, playerValue, dealerCard, dealerValue, isFirstTwoCards)
  }

  // Hard hands
  return getHardHandRule(playerValue, dealerCard, dealerValue, isFirstTwoCards)
}

function getPairRule(card: Card, dealerCard: string, dealerValue: number): StrategyRule {
  const cardValue = getCardValue(card)
  const pair = `${card.rank},${card.rank}`

  // A,A
  if (cardValue === 11) {
    return {
      action: "split",
      fallback: null,
      tip: "Always split aces—two starts at 11 beat a single soft 12.",
      feedback: "Not splitting wastes the chance to make two 18–21 hands from aces.",
    }
  }

  // 10,10
  if (cardValue === 10) {
    return {
      action: "stand",
      fallback: null,
      tip: "Never split tens—20 already crushes the dealer.",
      feedback: "Splitting tens turns a top-tier 20 into two weaker hands.",
    }
  }

  // 9,9
  if (cardValue === 9) {
    if (dealerCard === "7" || dealerValue >= 10) {
      return {
        action: "stand",
        fallback: null,
        tip: "9,9 vs 7/10/A: stand on 18.",
        feedback: "Splitting into a strong dealer upcard performs worse than holding 18.",
      }
    }
    return {
      action: "split",
      fallback: null,
      tip: "Split 9s vs 2–6 and 8–9 to create two strong hands.",
      feedback: "Standing vs those upcards gives up value; splitting wins more often and for more.",
    }
  }

  // 8,8
  if (cardValue === 8) {
    return {
      action: "split",
      fallback: null,
      tip: "Always split 8s—16 is the worst hard total; splitting escapes it.",
      feedback: "Keeping 16 loses heavily; splitting 8s creates two hands with a real chance.",
    }
  }

  // 7,7
  if (cardValue === 7) {
    if (dealerValue >= 2 && dealerValue <= 7) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 7s vs 2–7 to fight on even ground.",
        feedback: "Hitting or standing yields worse outcomes here; splitting improves winning chances.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "7,7 vs 8–A: take a card; don't split into strength.",
      feedback: "Splitting against strong upcards underperforms; hitting is higher EV.",
    }
  }

  // 6,6
  if (cardValue === 6) {
    if (dealerValue >= 2 && dealerValue <= 6) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 6s vs 2–6 (with DAS) to avoid a weak hard 12.",
        feedback: "Playing 12 against a weak dealer wastes value; splitting performs better.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "6,6 vs 7–A: hit—don't split into strength.",
      feedback: "Splitting here creates two underdog hands; hitting keeps options open.",
    }
  }

  // 5,5 - Treat as hard 10
  if (cardValue === 5) {
    if (dealerValue >= 2 && dealerValue <= 9) {
      return {
        action: "double",
        fallback: "hit",
        tip: "Treat 5,5 as hard 10: double vs 2–9.",
        feedback: "Splitting 5s makes two weak 5s; doubling hard 10 wins more.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "5,5 vs 10/A: just hit.",
      feedback: "Doubling into the dealer's strongest upcards is negative EV.",
    }
  }

  // 4,4
  if (cardValue === 4) {
    if (dealerValue === 5 || dealerValue === 6) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 4s only vs 5–6 (with DAS).",
        feedback: "Against 5–6, splitting lets you double more often and out-earn hitting.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "4,4 vs other upcards: hit.",
      feedback: "Splitting 4s elsewhere underperforms; hitting keeps you flexible.",
    }
  }

  // 3,3
  if (cardValue === 3) {
    if (dealerValue >= 2 && dealerValue <= 7) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 3s vs 2–7 to create two competitive hands.",
        feedback: "Playing 6 vs 2–7 is weaker than splitting into two drawing hands.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "3,3 vs 8–A: hit.",
      feedback: "Splitting small cards into a strong dealer is negative EV.",
    }
  }

  // 2,2
  if (cardValue === 2) {
    if (dealerValue >= 2 && dealerValue <= 7) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 2s vs 2–7 (with DAS).",
        feedback: "Two small drawing hands beat one weak hard 4.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "2,2 vs 8–A: hit.",
      feedback: "Splitting 2s into strength performs poorly; take a card instead.",
    }
  }

  // Fallback
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your hand.",
    feedback: "This improves your winning chances.",
  }
}

function getSoftHandRule(
  playerHand: Card[],
  playerValue: number,
  dealerCard: string,
  dealerValue: number,
  canDouble: boolean,
): StrategyRule {
  // A,9 (Soft 20) or A,8 (Soft 19)
  if (playerValue === 20 || playerValue === 19) {
    return {
      action: "stand",
      fallback: null,
      tip: "A,8/A,9: stand—these are premium totals.",
      feedback: "Hitting soft 19/20 reduces a strong made hand to a worse one too often.",
    }
  }

  // A,7 (Soft 18)
  if (playerValue === 18) {
    if (dealerValue >= 3 && dealerValue <= 6) {
      return {
        action: "double",
        fallback: "stand",
        tip: "A,7 vs 3–6: double—capitalize on favorable spots.",
        feedback: "Soft 18 is good, but doubling vs 3–6 wins more money than standing.",
      }
    }
    if (dealerValue === 2 || dealerValue === 7 || dealerValue === 8) {
      return {
        action: "stand",
        fallback: null,
        tip: "A,7 vs 2,7,8: stand—your 18 is already strong.",
        feedback: "Hitting risks weakening a made hand; standing keeps your edge.",
      }
    }
    // Hit vs 9, 10, A
    return {
      action: "hit",
      fallback: null,
      tip: "A,7 vs 9–A: improve—18 often loses to strong dealer cards.",
      feedback: "Against 9–A, 18 isn't enough; hitting finds 19–21 or a competitive hard total.",
    }
  }

  // A,6 (Soft 17)
  if (playerValue === 17) {
    if (dealerValue >= 3 && dealerValue <= 6) {
      return {
        action: "double",
        fallback: "hit",
        tip: "A,6 vs 3–6: double—many ways to end at 18–21.",
        feedback: "Dealer weakness plus strong improvement chances make doubling optimal.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "A,6 vs 2 or 7–A: take a card.",
      feedback: "Standing leaves too many losses; hitting soft 17 is better unless doubling vs 3–6.",
    }
  }

  // A,5 (Soft 16) or A,4 (Soft 15)
  if (playerValue === 16 || playerValue === 15) {
    if (dealerValue >= 4 && dealerValue <= 6) {
      return {
        action: "double",
        fallback: "hit",
        tip:
          playerValue === 15 && dealerValue === 5
            ? "Soft 15 (A,4) vs 5: double—many ways to improve to 18-21."
            : "A,4/A,5 vs 4–6: double—excellent upgrade spots.",
        feedback:
          playerValue === 15 && dealerValue === 5
            ? "Soft 15 (A,4) vs 5 should double to maximize value. If doubling isn't allowed, hit."
            : "Soft 15/16 gains the most by pressing when the dealer is weak.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "A,4/A,5 vs stronger upcards: just hit.",
      feedback: "Doubling with soft 15/16 against strength lowers EV; hitting is safer and better.",
    }
  }

  // A,3 (Soft 14) or A,2 (Soft 13)
  if (playerValue === 14 || playerValue === 13) {
    if (dealerValue === 5 || dealerValue === 6) {
      return {
        action: "double",
        fallback: "hit",
        tip: "A,2/A,3 vs 5–6: double—great chance to land 18–21.",
        feedback: "Dealer is weak; doubling soft 13/14 vs 5–6 outperforms a simple hit.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "A,2/A,3 vs other upcards: improve first.",
      feedback: "Doubling here overextends a marginal hand; a hit keeps your options open.",
    }
  }

  // Fallback for other soft totals
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your soft total.",
    feedback: "Soft hands can't bust, so improve your total.",
  }
}

function getHardHandRule(
  playerValue: number,
  dealerCard: string,
  dealerValue: number,
  canDouble: boolean,
): StrategyRule {
  // 17-21: Always stand (never double)
  if (playerValue >= 17) {
    return {
      action: "stand",
      fallback: null,
      tip: "17+ is already competitive—don't risk a bust. Never double hard 18.",
      feedback: "Hitting 17+ turns many winning hands into busts with little upside. Doubling hard 18 worsens EV.",
    }
  }

  // 13-16 vs 2-6: Stand (dealer bust card - don't double)
  if (playerValue >= 13 && playerValue <= 16 && dealerValue >= 2 && dealerValue <= 6) {
    return {
      action: "stand",
      fallback: null,
      tip:
        playerValue === 15 && dealerValue === 5
          ? "Hard 15 vs 5: stand—dealer 5 is a bust card; doubling worsens EV."
          : "13–16 vs 2–6: stand; dealer is prone to busting with weak upcards.",
      feedback:
        playerValue === 15 && dealerValue === 5
          ? "Hard 15 vs 5 should stand. Doubling against this bust card worsens expected value."
          : "Hitting these totals vs 2–6 turns dealer busts into your busts; standing is higher EV.",
    }
  }

  // 13-16 vs 7-A: Hit
  if (playerValue >= 13 && playerValue <= 16 && dealerValue >= 7) {
    return {
      action: "hit",
      fallback: null,
      tip: "13–16 vs 7–A: you're likely behind—draw to improve.",
      feedback: "Standing against strong dealer upcards loses too often; hitting gives you more winning paths.",
    }
  }

  // 12 vs 4-6: Stand
  if (playerValue === 12 && dealerValue >= 4 && dealerValue <= 6) {
    return {
      action: "stand",
      fallback: null,
      tip: "12 vs 4–6: stand and let the dealer's weak upcard produce busts.",
      feedback: "Hitting 12 vs dealer 4–6 risks busting while the dealer is already likely to bust.",
    }
  }

  // 12 vs 2-3 or 7-A: Hit
  if (playerValue === 12) {
    return {
      action: "hit",
      fallback: null,
      tip: "12 vs 2–3 or 7–A: you're behind—take a card.",
      feedback: "Standing leaves you with too many losing outcomes; hitting increases your chance to reach 17–21.",
    }
  }

  // 11 vs 2-10: Double
  if (playerValue === 11 && dealerValue >= 2 && dealerValue <= 10) {
    return {
      action: "double",
      fallback: "hit",
      tip: "11 vs 2–10: best double in blackjack—any 10 makes 21.",
      feedback: "You're a clear favorite with 11 vs 2–10; doubling exploits the advantage.",
    }
  }

  // 11 vs A: Hit
  if (playerValue === 11) {
    return {
      action: "hit",
      fallback: null,
      tip: "11 vs Ace (S17): hit—doubling is weaker when the dealer has ace.",
      feedback: "Against an Ace in S17 games, doubling 11 loses value; hitting performs better on average.",
    }
  }

  // 10 vs 2-9: Double
  if (playerValue === 10 && dealerValue >= 2 && dealerValue <= 9) {
    return {
      action: "double",
      fallback: "hit",
      tip: "10 vs 2–9: one card often makes 18–20—double to maximize value.",
      feedback: "A single draw from 10 is favored against 2–9; doubling captures that edge better than a simple hit.",
    }
  }

  // 10 vs 10/A: Hit
  if (playerValue === 10) {
    return {
      action: "hit",
      fallback: null,
      tip: "10 vs 10/A: the dealer is too strong—don't overbet; hit.",
      feedback: "Doubling into a strong dealer upcard is negative EV; taking a hit preserves equity.",
    }
  }

  // 9 vs 3-6: Double
  if (playerValue === 9 && dealerValue >= 3 && dealerValue <= 6) {
    return {
      action: "double",
      fallback: "hit",
      tip: "9 vs 3–6: the dealer is weak—press your edge by doubling.",
      feedback: "Hitting leaves money on the table; doubling with 9 vs a weak dealer has higher expected value.",
    }
  }

  // 9 vs other: Hit
  if (playerValue === 9) {
    return {
      action: "hit",
      fallback: null,
      tip: "9 vs strong or neutral upcards: improve first, then compete.",
      feedback: "Doubling here overcommits against a stronger dealer; build your total by hitting.",
    }
  }

  // 4-8: Always hit
  if (playerValue <= 8) {
    return {
      action: "hit",
      fallback: null,
      tip: "Totals under 9 can't bust—keep drawing to build a hand.",
      feedback:
        "Standing with <9 gives the dealer too many free wins; hitting can't bust and increases your chance to reach a winning total.",
    }
  }

  // Fallback
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your hand.",
    feedback: "This improves your winning chances.",
  }
}
