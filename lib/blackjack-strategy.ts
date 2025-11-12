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
  return adjustMessageForDoubleAvailability(rule.tip, rule, playerHand.length === 2)
}

export function getFeedbackMessage(playerHand: Card[], dealerUpCard: Card): string {
  const rule = getStrategyRule(playerHand, dealerUpCard)
  return adjustMessageForDoubleAvailability(rule.feedback, rule, playerHand.length === 2)
}

function adjustMessageForDoubleAvailability(message: string, rule: StrategyRule, canDouble: boolean): string {
  if (rule.action === "double" && !canDouble && rule.fallback) {
    const fallbackAction = rule.fallback
    const fallbackDirective =
      fallbackAction === "stand"
        ? "stand instead."
        : fallbackAction === "hit"
          ? "hit instead."
          : `${fallbackAction} instead.`
    return `${message} Doubling isn't available after drawing cards, so ${fallbackDirective}`
  }

  return message
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

  // A,A
  if (cardValue === 11) {
    return {
      action: "split",
      fallback: null,
      tip: "Always split aces—two hands starting at 11 beat a single soft 12.",
      feedback: "Splitting aces creates two hands each starting at 11, which can each reach 18–21. This significantly increases your expected value compared to playing a single soft 12. Not splitting wastes the opportunity to make two strong hands from aces.",
    }
  }

  // 10,10
  if (cardValue === 10) {
    return {
      action: "stand",
      fallback: null,
      tip: "Never split tens—hard 20 already crushes the dealer.",
      feedback: "Hard 20 is one of the strongest hands in blackjack and beats most dealer outcomes. Splitting tens would turn this top-tier hand into two weaker hands starting from 10, significantly reducing your expected value. Always stand on 20.",
    }
  }

  // 9,9
  if (cardValue === 9) {
    // Split vs 2-6 or 8-9; stand vs 7,10,A
    if (dealerCard === "7" || dealerValue >= 10) {
      return {
        action: "stand",
        fallback: null,
        tip: "9,9 vs 7/10/A: stand on 18—splitting into strength reduces expected value.",
        feedback: "Against dealer 7, 10, or Ace, holding 18 is stronger than splitting. Splitting would create two hands starting from 9, which are weaker against these strong upcards. Standing preserves your advantage with 18.",
      }
    }
    return {
      action: "split",
      fallback: null,
      tip: "Split 9s vs 2–6 and 8–9 to create two strong hands with better winning potential.",
      feedback: "Against weak dealer upcards (2–6) or neutral ones (8–9), splitting 9s creates two hands that can each reach 19–21. This significantly increases your expected value compared to standing on 18, as you can win both hands.",
    }
  }

  // 8,8
  if (cardValue === 8) {
    return {
      action: "split",
      fallback: null,
      tip: "Always split 8s—hard 16 is the worst hard total; splitting escapes it.",
      feedback: "Hard 16 is the worst hard total because it's too weak to stand but likely to bust if you hit. Splitting 8s creates two hands starting from 8, each with good potential to reach 17–21. This significantly outperforms hitting or standing on 16, which loses heavily.",
    }
  }

  // 7,7
  if (cardValue === 7) {
    // Split vs 2-7; otherwise hit
    if (dealerValue >= 2 && dealerValue <= 7) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 7s vs 2–7 to create two drawing hands instead of weak hard 14.",
        feedback: "Playing hard 14 against dealer 2–7 is weak. Splitting creates two hands starting from 7, each with good potential to reach 17–21. This significantly outperforms hitting (which risks busting) or standing (which loses too often).",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "7,7 vs 8–A: hit—don't split into strength.",
      feedback: "Splitting 7s against strong dealer upcards (8–A) creates two weak hands that are likely to lose. Hitting gives you a better chance to improve your total without committing to two losing positions.",
    }
  }

  // 6,6
  if (cardValue === 6) {
    // Split vs 3-6; vs 2 only if Double After Split (DAS) (assume Double After Split (DAS) available)
    if (dealerValue >= 2 && dealerValue <= 6) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 6s vs 2–6 (with Double After Split (DAS)) to avoid a weak hard 12 and create two drawing hands.",
        feedback: "Playing hard 12 against weak dealer upcards wastes value. Splitting lets you double after split (Double After Split (DAS)) on favorable draws, significantly improving expected value compared to hitting or standing.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "6,6 vs 7–A: hit—don't split into strength.",
      feedback: "Splitting 6s against strong dealer upcards creates two weak hands that are likely to lose. Hitting gives you a better chance to improve your total without committing to two losing hands.",
    }
  }

  // 5,5 - Treat as hard 10
  if (cardValue === 5) {
    // Never split 5,5; play as hard 10
    if (dealerValue >= 2 && dealerValue <= 9) {
      return {
        action: "double",
        fallback: "hit",
        tip: "Treat 5,5 as hard 10: double vs 2–9.",
        feedback: "Never split 5s. Treating 5,5 as hard 10 and doubling against dealer 2–9 maximizes expected value. Splitting would create two weak hands starting from 5, which perform much worse than doubling hard 10.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "5,5 vs 10/A: treat as hard 10 and hit—don't double into strength.",
      feedback: "Against strong dealer upcards (10, Ace), treating 5,5 as hard 10 and hitting is correct. Doubling would overcommit against the dealer's strongest upcards and is negative expected value.",
    }
  }

  // 4,4
  if (cardValue === 4) {
    // Split only if Double After Split (DAS) vs 5-6 (assume Double After Split (DAS) available); otherwise hit
    if (dealerValue === 5 || dealerValue === 6) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 4s vs 5–6 (with Double After Split (DAS)) to take advantage of dealer's weak upcards.",
        feedback: "Against dealer 5–6, splitting with Double After Split (DAS) allows you to double after favorable draws. This turns two weak 4s into potentially strong hands and significantly outperforms hitting hard 8, which is too weak to stand on.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "4,4 vs other upcards: hit—splitting doesn't improve expected value.",
      feedback: "Splitting 4s against dealer upcards other than 5–6 underperforms because the dealer is either too strong or not weak enough. Hitting hard 8 gives you flexibility to improve without committing to two weak hands.",
    }
  }

  // 3,3
  if (cardValue === 3) {
    // Split vs 4-7; vs 2-3 split only if Double After Split (DAS) (assume Double After Split (DAS) available)
    if (dealerValue >= 2 && dealerValue <= 7) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 3s vs 2–7 (with Double After Split (DAS)) to create two drawing hands instead of weak hard 6.",
        feedback: "Playing hard 6 against dealer 2–7 is weak. Splitting with Double After Split (DAS) allows you to double after favorable draws, turning two weak 3s into potentially strong hands. This significantly outperforms hitting or standing.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "3,3 vs 8–A: hit—don't split into strength.",
      feedback: "Splitting 3s against strong dealer upcards (8–A) creates two weak hands that are likely to lose. Hitting gives you a better chance to improve without committing to two losing positions.",
    }
  }

  // 2,2
  if (cardValue === 2) {
    // Split vs 4-7; vs 2-3 split only if Double After Split (DAS) (assume Double After Split (DAS) available)
    if (dealerValue >= 2 && dealerValue <= 7) {
      return {
        action: "split",
        fallback: null,
        tip: "Split 2s vs 2–7 (with Double After Split (DAS)) to create two drawing hands instead of weak hard 4.",
        feedback: "Playing hard 4 against dealer 2–7 is very weak. Splitting with Double After Split (DAS) allows you to double after favorable draws, turning two weak 2s into potentially strong hands. This significantly outperforms hitting or standing.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "2,2 vs 8–A: hit—don't split into strength.",
      feedback: "Splitting 2s against strong dealer upcards (8–A) creates two very weak hands that are likely to lose. Hitting gives you a better chance to improve without committing to two losing positions.",
    }
  }

  // Fallback
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your hand.",
    feedback: "Hitting gives you a chance to improve your total and compete with the dealer. This increases your winning chances compared to standing on a weak hand.",
  }
}

function getSoftHandRule(
  _playerHand: Card[],
  playerValue: number,
  _dealerCard: string,
  dealerValue: number,
  _canDouble: boolean,
): StrategyRule {
  // Soft 20 (A,9)
  if (playerValue === 20) {
    return {
      action: "stand",
      fallback: null,
      tip: "Soft 20 (A,9) always stands—it's already a premium total that beats most dealer outcomes.",
      feedback: "Soft 20 is one of the strongest hands in blackjack. Hitting would risk downgrading a made hand that wins against most dealer totals. Standing preserves your strong advantage.",
    }
  }

  // Soft 19 (A,8)
  if (playerValue === 19) {
    // Stand (vs 6 double if allowed, else stand)
    if (dealerValue === 6) {
      return {
        action: "double",
        fallback: "stand",
        tip: "A,8 vs 6: double to maximize your huge edge against the weakest dealer upcard.",
        feedback: "Dealer 6 is the weakest upcard and busts frequently. Doubling soft 19 against 6 significantly increases your expected value compared to standing, as you're likely to improve to 20 or 21 while the dealer is likely to bust or make a weak hand.",
      }
    }
    return {
      action: "stand",
      fallback: null,
      tip: "A,8 vs other upcards: stand—soft 19 is already strong enough.",
      feedback: "Soft 19 is a strong hand that beats most dealer outcomes. Against dealer upcards other than 6, standing preserves your advantage. Hitting risks downgrading a winning hand without sufficient benefit.",
    }
  }

  // Soft 18 (A,7)
  if (playerValue === 18) {
    // Double vs 2-6 (else stand); hit vs 9/10/A
    if (dealerValue >= 2 && dealerValue <= 6) {
      return {
        action: "double",
        fallback: "stand",
        tip: "A,7 vs 2–6: double to maximize value against weak dealer upcards.",
        feedback: "Against weak dealer upcards (2–6), soft 18 has excellent potential to improve to 19–21 on one card. Doubling captures this advantage and significantly increases expected value compared to standing, as the dealer is likely to bust or make a weak hand.",
      }
    }
    if (dealerValue === 7 || dealerValue === 8) {
      return {
        action: "stand",
        fallback: null,
        tip: "A,7 vs 7 or 8: stand—18 keeps pace with the dealer's neutral upcards.",
        feedback: "Against dealer 7 or 8, you're roughly even. Standing preserves your position without risking a bust. Hitting or doubling would overcommit against these neutral upcards where the dealer has a reasonable chance to make 17–21.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "A,7 vs 9–A: hit—18 trails strong dealer upcards and needs improvement.",
      feedback: "Against strong dealer upcards (9, 10, Ace), soft 18 is behind. The dealer is likely to make 19–21, so you need to improve. Hitting gives you flexibility to reach 19–21 without overcommitting like doubling would.",
    }
  }

  // Soft 17 (A,6)
  if (playerValue === 17) {
    // Double vs 3-6; else hit
    if (dealerValue >= 3 && dealerValue <= 6) {
      return {
        action: "double",
        fallback: "hit",
        tip: "A,6 vs 3–6: double to take advantage of dealer's weak upcards.",
        feedback: "Against weak dealer upcards (3–6), soft 17 has many live outs to improve to 18–21 on one card. Doubling maximizes your expected value since the dealer is likely to bust or make a weak hand. This significantly outperforms hitting or standing.",
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "A,6 vs 2 or 7–A: hit—soft 17 needs improvement against these upcards.",
      feedback: "Against dealer 2 or strong upcards (7–A), soft 17 is too weak to stand or double. Hitting gives you flexibility to improve to 18–21 without overcommitting. The dealer is likely to make a strong hand, so you need to improve your total.",
    }
  }

  // Soft 16 (A,5) and Soft 15 (A,4)
  if (playerValue === 16 || playerValue === 15) {
    // Double vs 4-6; else hit
    if (dealerValue >= 4 && dealerValue <= 6) {
      const descriptor = playerValue === 16 ? "A,5" : "A,4"
      return {
        action: "double",
        fallback: "hit",
        tip: `${descriptor} vs 4–6: double to maximize value against weak dealer upcards.`,
        feedback: `Against weak dealer upcards (4–6), ${descriptor} has good potential to improve to 17–21 on one card. Dealer 4–6 busts frequently, so doubling captures this advantage and significantly increases expected value compared to hitting or standing.`,
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "A,4/A,5 vs other upcards: hit to improve without overcommitting.",
      feedback: "Against dealer upcards other than 4–6, doubling overcommits a fragile total. Hitting gives you flexibility to improve to 17–21 without risking too much. The dealer is either too strong or not weak enough to justify doubling.",
    }
  }

  // Soft 14 (A,3) and Soft 13 (A,2)
  if (playerValue === 14 || playerValue === 13) {
    // Double vs 5-6; else hit
    if (dealerValue === 5 || dealerValue === 6) {
      const descriptor = playerValue === 14 ? "A,3" : "A,2"
      return {
        action: "double",
        fallback: "hit",
        tip: `${descriptor} vs 5–6: double to take advantage of dealer's weakest upcards.`,
        feedback: `Against dealer 5–6 (the weakest upcards), ${descriptor} has potential to improve to 15–21 on one card. Dealer 5–6 busts very frequently, so doubling maximizes your expected value. These are the only upcards where doubling soft 13/14 is profitable.`,
      }
    }
    return {
      action: "hit",
      fallback: null,
      tip: "A,2/A,3 vs other upcards: hit to improve without overcommitting.",
      feedback: "Against dealer upcards other than 5–6, doubling soft 13/14 overcommits a weak total. The dealer is either too strong or not weak enough to justify doubling. Hitting gives you flexibility to improve without risking too much.",
    }
  }

  // Fallback for any other soft total
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your soft total—soft hands can't bust on one card.",
    feedback: "Soft hands can't bust on one card, so hitting gives you flexibility to build a winning total without risk. Keep drawing until you reach a strong total or the situation changes.",
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
      feedback: "Hard 17+ is a strong total that beats most dealer outcomes. Hitting would risk busting a winning hand with little chance of improvement. Doubling hard 18 is negative expected value because you're already ahead. Standing preserves your advantage.",
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
          : "13–16 vs 2–6: stand and let the dealer's weak upcards produce busts.",
      feedback:
        playerValue === 15 && dealerValue === 5
          ? "Hard 15 vs dealer 5 should stand. Dealer 5 busts frequently, so standing lets the dealer bust while avoiding your own bust. Doubling would overcommit and reduce expected value."
          : "Against weak dealer upcards (2–6), hard 13–16 should stand. The dealer is likely to bust, so hitting would risk turning dealer busts into your own busts. Standing maximizes expected value by letting the dealer bust.",
    }
  }

  // 13-16 vs 7-A: Hit
  if (playerValue >= 13 && playerValue <= 16 && dealerValue >= 7) {
    return {
      action: "hit",
      fallback: null,
      tip: "13–16 vs 7–A: you're likely behind—draw to improve.",
      feedback: "Against strong dealer upcards (7–A), hard 13–16 is too weak to stand. The dealer is likely to make 17–21, so standing loses too often. Hitting gives you a chance to improve to 17–21 and compete, even though you risk busting.",
    }
  }

  // 12 vs 4-6: Stand
  if (playerValue === 12 && dealerValue >= 4 && dealerValue <= 6) {
    return {
      action: "stand",
      fallback: null,
      tip: "12 vs 4–6: stand and let the dealer's weak upcard produce busts.",
      feedback: "Against weak dealer upcards (4–6), hard 12 should stand. The dealer is likely to bust, so hitting would risk turning dealer busts into your own bust. Standing maximizes expected value by letting the dealer bust.",
    }
  }

  // 12 vs 2-3 or 7-A: Hit
  if (playerValue === 12) {
    return {
      action: "hit",
      fallback: null,
      tip: "12 vs 2–3 or 7–A: you're behind—take a card to improve.",
      feedback: "Against dealer 2–3 or strong upcards (7–A), hard 12 is too weak to stand. Standing leaves you with too many losing outcomes since the dealer is likely to make 17–21. Hitting gives you a chance to improve to 17–21, even though you risk busting.",
    }
  }

  if (playerValue === 11) {
    return {
      action: "double",
      fallback: "hit",
      tip: "Hard 11 doubles vs every upcard including Ace—any ten gives you 21.",
      feedback: "Hard 11 is one of the strongest doubling opportunities. Any ten-value card (10, J, Q, K) gives you 21, and you have a high chance of improving to 18–21. Even against dealer Ace, doubling hard 11 has positive expected value and earns more than a simple hit over the long run.",
    }
  }

  // 10 vs 2-9: Double
  if (playerValue === 10 && dealerValue >= 2 && dealerValue <= 9) {
    return {
      action: "double",
      fallback: "hit",
      tip: "10 vs 2–9: one card often makes 18–20—double to maximize value.",
      feedback: "Hard 10 has excellent potential to improve to 18–20 on one card. Against dealer 2–9, doubling maximizes your expected value by capturing this advantage. A single draw from 10 is favored against these upcards, and doubling captures that edge better than a simple hit.",
    }
  }

  // 10 vs 10/A: Hit
  if (playerValue === 10) {
    return {
      action: "hit",
      fallback: null,
      tip: "10 vs 10/A: the dealer is too strong—don't overbet; hit.",
      feedback: "Against strong dealer upcards (10, Ace), doubling hard 10 is negative expected value. The dealer is likely to make 17–21, so doubling overcommits. Hitting preserves equity and gives you flexibility to improve without risking too much.",
    }
  }

  // 9 vs 3-6: Double
  if (playerValue === 9 && dealerValue >= 3 && dealerValue <= 6) {
    return {
      action: "double",
      fallback: "hit",
      tip: "9 vs 3–6: the dealer is weak—press your edge by doubling.",
      feedback: "Against weak dealer upcards (3–6), hard 9 has good potential to improve to 19–20 on one card. Doubling maximizes your expected value since the dealer is likely to bust or make a weak hand. Hitting would leave money on the table.",
    }
  }

  // 9 vs other: Hit
  if (playerValue === 9) {
    return {
      action: "hit",
      fallback: null,
      tip: "9 vs strong or neutral upcards: improve first, then compete.",
      feedback: "Against dealer upcards other than 3–6, doubling hard 9 overcommits against a stronger dealer. The dealer is likely to make a competitive hand, so doubling is negative expected value. Hitting gives you flexibility to improve without risking too much.",
    }
  }

  // 4-8: Always hit
  if (playerValue <= 8) {
    return {
      action: "hit",
      fallback: null,
      tip: "Totals 8 or less can't bust—keep drawing to build a hand.",
      feedback:
        "Hard totals 8 or less are too weak to stand. Standing would give the dealer too many free wins since you can't beat most dealer outcomes. Hitting can't bust and gives you a chance to improve to 17–21, which are competitive totals.",
    }
  }

  // Fallback
  return {
    action: "hit",
    fallback: null,
    tip: "Hit to improve your hand.",
    feedback: "Hitting gives you a chance to improve your total and compete with the dealer. This increases your winning chances compared to standing on a weak hand.",
  }
}
