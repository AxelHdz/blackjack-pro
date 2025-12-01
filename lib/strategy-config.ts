import { type GameAction } from "./blackjack-strategy"

export type DealerKey = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "A"

export type RuleCase = {
  dealers: DealerKey[] | "any"
  action: GameAction
  fallback?: GameAction | null
  tip: string
  feedback: string
}

export type PairRule = {
  pairValue: number
  cases: RuleCase[]
}

export type SoftRule = {
  total: number
  cases: RuleCase[]
}

export type HardRule = {
  total: number
  cases: RuleCase[]
}

export type TableRules = {
  dealerHitsSoft17: boolean
  doubleAfterSplit: boolean
  doubleOnSplitAces: boolean
  surrenderAllowed: boolean
}

export const tableRules: TableRules = {
  dealerHitsSoft17: true,
  doubleAfterSplit: true,
  doubleOnSplitAces: false,
  surrenderAllowed: false,
}

const weakUpcards: DealerKey[] = [2, 3, 4, 5, 6]
const weakUpcardsFourToSix: DealerKey[] = [4, 5, 6]
const weakestUpcards: DealerKey[] = [5, 6]
const neutralSevenEight: DealerKey[] = [7, 8]
const strongUpcards: DealerKey[] = [7, 8, 9, 10, "A"]
const strongNinePlus: DealerKey[] = [9, 10, "A"]

export const pairRules: PairRule[] = [
  {
    pairValue: 11, // A,A
    cases: [
      {
        dealers: "any",
        action: "split",
        fallback: null,
        tip: "Always split aces—two hands starting at 11 beat a single soft 12. Doubling after split aces isn't allowed.",
        feedback:
          "Splitting aces creates two hands each starting at 11, which can each reach 18–21. This significantly increases your expected value compared to playing a single soft 12. Not splitting wastes the opportunity to make two strong hands from aces. Under these rules you cannot double after splitting aces.",
      },
    ],
  },
  {
    pairValue: 10, // 10,10
    cases: [
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "Never split tens—hard 20 already crushes the dealer.",
        feedback:
          "Hard 20 is one of the strongest hands in blackjack and beats most dealer outcomes. Splitting tens would turn this top-tier hand into two weaker hands starting from 10, significantly reducing your expected value. Always stand on 20.",
      },
    ],
  },
  {
    pairValue: 9, // 9,9
    cases: [
      {
        dealers: [7, 10, "A"],
        action: "stand",
        fallback: null,
        tip: "9,9 vs 7/10/A: stand on 18—splitting into strength reduces expected value.",
        feedback:
          "Against dealer 7, 10, or Ace, holding 18 is stronger than splitting. Splitting would create two hands starting from 9, which are weaker against these strong upcards. Standing preserves your advantage with 18.",
      },
      {
        dealers: "any",
        action: "split",
        fallback: null,
        tip: "Split 9s vs 2–6 and 8–9 to create two strong hands with better winning potential.",
        feedback:
          "Against weak dealer upcards (2–6) or neutral ones (8–9), splitting 9s creates two hands that can each reach 19–21. This significantly increases your expected value compared to standing on 18, as you can win both hands.",
      },
    ],
  },
  {
    pairValue: 8, // 8,8
    cases: [
      {
        dealers: "any",
        action: "split",
        fallback: null,
        tip: "Always split 8s—hard 16 is the worst hard total; splitting escapes it.",
        feedback:
          "Hard 16 is the worst hard total because it's too weak to stand but likely to bust if you hit. Splitting 8s creates two hands starting from 8, each with good potential to reach 17–21. This significantly outperforms hitting or standing on 16, which loses heavily.",
      },
    ],
  },
  {
    pairValue: 7, // 7,7
    cases: [
      {
        dealers: [2, 3, 4, 5, 6, 7],
        action: "split",
        fallback: null,
        tip: "Split 7s vs 2–7 to create two drawing hands instead of weak hard 14.",
        feedback:
          "Playing hard 14 against dealer 2–7 is weak. Splitting creates two hands starting from 7, each with good potential to reach 17–21. This significantly outperforms hitting (which risks busting) or standing (which loses too often).",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "7,7 vs 8–A: hit—don't split into strength.",
        feedback:
          "Splitting 7s against strong dealer upcards (8–A) creates two weak hands that are likely to lose. Hitting gives you a better chance to improve your total without committing to two losing positions.",
      },
    ],
  },
  {
    pairValue: 6, // 6,6
    cases: [
      {
        dealers: weakUpcards,
        action: "split",
        fallback: null,
        tip: "Split 6s vs 2–6 (with Double After Split (DAS); never after split aces) to avoid a weak hard 12 and create two drawing hands.",
        feedback:
          "Playing hard 12 against weak dealer upcards wastes value. Splitting lets you double after split (Double After Split (DAS)) on favorable draws—except after split aces—significantly improving expected value compared to hitting or standing.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "6,6 vs 7–A: hit—don't split into strength.",
        feedback:
          "Splitting 6s against strong dealer upcards creates two weak hands that are likely to lose. Hitting gives you a better chance to improve your total without committing to two losing hands.",
      },
    ],
  },
  {
    pairValue: 5, // 5,5 treated as hard 10
    cases: [
      {
        dealers: [2, 3, 4, 5, 6, 7, 8, 9],
        action: "double",
        fallback: "hit",
        tip: "Treat 5,5 as hard 10: double vs 2–9.",
        feedback:
          "Never split 5s. Treating 5,5 as hard 10 and doubling against dealer 2–9 maximizes expected value. Splitting would create two weak hands starting from 5, which perform much worse than doubling hard 10.",
      },
      {
        dealers: [10, "A"],
        action: "hit",
        fallback: null,
        tip: "5,5 vs 10/A: treat as hard 10 and hit—don't double into strength.",
        feedback:
          "Against strong dealer upcards (10, Ace), treating 5,5 as hard 10 and hitting is correct. Doubling would overcommit against the dealer's strongest upcards and is negative expected value.",
      },
    ],
  },
  {
    pairValue: 4, // 4,4
    cases: [
      {
        dealers: [5, 6],
        action: "split",
        fallback: null,
        tip: "Split 4s vs 5–6 (with Double After Split (DAS); never after split aces) to take advantage of dealer's weak upcards.",
        feedback:
          "Against dealer 5–6, splitting with Double After Split (DAS) allows you to double after favorable draws—except after split aces. This turns two weak 4s into potentially strong hands and significantly outperforms hitting hard 8, which is too weak to stand on.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "4,4 vs other upcards: hit—splitting doesn't improve expected value.",
        feedback:
          "Splitting 4s against dealer upcards other than 5–6 underperforms because the dealer is either too strong or not weak enough. Hitting hard 8 gives you flexibility to improve without committing to two weak hands.",
      },
    ],
  },
  {
    pairValue: 3, // 3,3
    cases: [
      {
        dealers: [2, 3, 4, 5, 6, 7],
        action: "split",
        fallback: null,
        tip: "Split 3s vs 2–7 (with Double After Split (DAS); never after split aces) to create two drawing hands instead of weak hard 6.",
        feedback:
          "Playing hard 6 against dealer 2–7 is weak. Splitting with Double After Split (DAS) allows you to double after favorable draws—except after split aces—turning two weak 3s into potentially strong hands. This significantly outperforms hitting or standing.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "3,3 vs 8–A: hit—don't split into strength.",
        feedback:
          "Splitting 3s against strong dealer upcards (8–A) creates two weak hands that are likely to lose. Hitting gives you a better chance to improve your total without committing to two losing positions.",
      },
    ],
  },
  {
    pairValue: 2, // 2,2
    cases: [
      {
        dealers: [2, 3, 4, 5, 6, 7],
        action: "split",
        fallback: null,
        tip: "Split 2s vs 2–7 (with Double After Split (DAS); never after split aces) to create two drawing hands instead of weak hard 4.",
        feedback:
          "Playing hard 4 against dealer 2–7 is very weak. Splitting with Double After Split (DAS) allows you to double after favorable draws—except after split aces—turning two weak 2s into potentially strong hands. This significantly outperforms hitting or standing.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "2,2 vs 8–A: hit—don't split into strength.",
        feedback:
          "Splitting 2s against strong dealer upcards (8–A) creates two very weak hands that are likely to lose. Hitting gives you a better chance to improve without committing to two losing positions.",
      },
    ],
  },
]

export const softRules: SoftRule[] = [
  {
    total: 20, // A,9
    cases: [
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "Soft 20 (A,9) always stands—it's already a premium total that beats most dealer outcomes.",
        feedback:
          "Soft 20 is one of the strongest hands in blackjack. Hitting would risk downgrading a made hand that wins against most dealer totals. Standing preserves your strong advantage.",
      },
    ],
  },
  {
    total: 19, // A,8
    cases: [
      {
        dealers: [6],
        action: "double",
        fallback: "stand",
        tip: "A,8 vs 6: double to maximize your huge edge against the weakest dealer upcard.",
        feedback:
          "Dealer 6 is the weakest upcard and busts frequently. Doubling soft 19 against 6 significantly increases your expected value compared to standing, as you're likely to improve to 20 or 21 while the dealer is likely to bust or make a weak hand.",
      },
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "A,8 vs other upcards: stand—soft 19 is already strong enough.",
        feedback:
          "Soft 19 is a strong hand that beats most dealer outcomes. Against dealer upcards other than 6, standing preserves your advantage. Hitting risks downgrading a winning hand without sufficient benefit.",
      },
    ],
  },
  {
    total: 18, // A,7
    cases: [
      {
        dealers: weakUpcards,
        action: "double",
        fallback: "stand",
        tip: "A,7 vs 2–6: double to maximize value against weak dealer upcards.",
        feedback:
          "Against weak dealer upcards (2–6), soft 18 has excellent potential to improve to 19–21 on one card. Doubling captures this advantage and significantly increases expected value compared to standing, as the dealer is likely to bust or make a weak hand.",
      },
      {
        dealers: neutralSevenEight,
        action: "stand",
        fallback: null,
        tip: "A,7 vs 7 or 8: stand—18 keeps pace with the dealer's neutral upcards.",
        feedback:
          "Against dealer 7 or 8, you're roughly even. Standing preserves your position without risking a bust. Hitting or doubling would overcommit against these neutral upcards where the dealer has a reasonable chance to make 17–21.",
      },
      {
        dealers: strongNinePlus,
        action: "hit",
        fallback: null,
        tip: "A,7 vs 9–A: hit—18 trails strong dealer upcards and needs improvement.",
        feedback:
          "Against strong dealer upcards (9, 10, Ace), soft 18 is behind. The dealer is likely to make 19–21, so you need to improve. Hitting gives you flexibility to reach 19–21 without overcommitting like doubling would.",
      },
    ],
  },
  {
    total: 17, // A,6
    cases: [
      {
        dealers: [3, 4, 5, 6],
        action: "double",
        fallback: "hit",
        tip: "A,6 vs 3–6: double to take advantage of dealer's weak upcards.",
        feedback:
          "Against weak dealer upcards (3–6), soft 17 has many live outs to improve to 18–21 on one card. Doubling maximizes your expected value since the dealer is likely to bust or make a weak hand. This significantly outperforms hitting or standing.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "A,6 vs 2 or 7–A: hit—soft 17 needs improvement against these upcards.",
        feedback:
          "Against dealer 2 or strong upcards (7–A), soft 17 is too weak to stand or double. Hitting gives you flexibility to improve to 18–21 without overcommitting. The dealer is likely to make a strong hand, so you need to improve your total.",
      },
    ],
  },
  {
    total: 16, // A,5
    cases: [
      {
        dealers: weakUpcardsFourToSix,
        action: "double",
        fallback: "hit",
        tip: "A,5 vs 4–6: double to maximize value against weak dealer upcards.",
        feedback:
          "Against weak dealer upcards (4–6), A,5 has good potential to improve to 17–21 on one card. Dealer 4–6 busts frequently, so doubling captures this advantage and significantly increases expected value compared to hitting or standing.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "A,4/A,5 vs other upcards: hit to improve without overcommitting.",
        feedback:
          "Against dealer upcards other than 4–6, doubling overcommits a fragile total. Hitting gives you flexibility to improve to 17–21 without risking too much. The dealer is either too strong or not weak enough to justify doubling.",
      },
    ],
  },
  {
    total: 15, // A,4
    cases: [
      {
        dealers: weakUpcardsFourToSix,
        action: "double",
        fallback: "hit",
        tip: "A,4 vs 4–6: double to maximize value against weak dealer upcards.",
        feedback:
          "Against weak dealer upcards (4–6), A,4 has good potential to improve to 17–21 on one card. Dealer 4–6 busts frequently, so doubling captures this advantage and significantly increases expected value compared to hitting or standing.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "A,4/A,5 vs other upcards: hit to improve without overcommitting.",
        feedback:
          "Against dealer upcards other than 4–6, doubling overcommits a fragile total. Hitting gives you flexibility to improve to 17–21 without risking too much. The dealer is either too strong or not weak enough to justify doubling.",
      },
    ],
  },
  {
    total: 14, // A,3
    cases: [
      {
        dealers: weakestUpcards,
        action: "double",
        fallback: "hit",
        tip: "A,3 vs 5–6: double to take advantage of dealer's weakest upcards.",
        feedback:
          "Against dealer 5–6 (the weakest upcards), A,3 has potential to improve to 15–21 on one card. Dealer 5–6 busts very frequently, so doubling maximizes your expected value. These are the only upcards where doubling soft 13/14 is profitable.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "A,2/A,3 vs other upcards: hit to improve without overcommitting.",
        feedback:
          "Against dealer upcards other than 5–6, doubling soft 13/14 overcommits a weak total. The dealer is either too strong or not weak enough to justify doubling. Hitting gives you flexibility to improve without risking too much.",
      },
    ],
  },
  {
    total: 13, // A,2
    cases: [
      {
        dealers: weakestUpcards,
        action: "double",
        fallback: "hit",
        tip: "A,2 vs 5–6: double to take advantage of dealer's weakest upcards.",
        feedback:
          "Against dealer 5–6 (the weakest upcards), A,2 has potential to improve to 15–21 on one card. Dealer 5–6 busts very frequently, so doubling maximizes your expected value. These are the only upcards where doubling soft 13/14 is profitable.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "A,2/A,3 vs other upcards: hit to improve without overcommitting.",
        feedback:
          "Against dealer upcards other than 5–6, doubling soft 13/14 overcommits a weak total. The dealer is either too strong or not weak enough to justify doubling. Hitting gives you flexibility to improve without risking too much.",
      },
    ],
  },
]

export const hardRules: HardRule[] = [
  {
    total: 21,
    cases: [
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "17+ is already competitive—don't risk a bust. Never double hard 18.",
        feedback:
          "Hard 17+ is a strong total that beats most dealer outcomes. Hitting would risk busting a winning hand with little chance of improvement. Doubling hard 18 is negative expected value because you're already ahead. Standing preserves your advantage.",
      },
    ],
  },
  {
    total: 20,
    cases: [
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "17+ is already competitive—don't risk a bust. Never double hard 18.",
        feedback:
          "Hard 17+ is a strong total that beats most dealer outcomes. Hitting would risk busting a winning hand with little chance of improvement. Doubling hard 18 is negative expected value because you're already ahead. Standing preserves your advantage.",
      },
    ],
  },
  {
    total: 19,
    cases: [
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "17+ is already competitive—don't risk a bust. Never double hard 18.",
        feedback:
          "Hard 17+ is a strong total that beats most dealer outcomes. Hitting would risk busting a winning hand with little chance of improvement. Doubling hard 18 is negative expected value because you're already ahead. Standing preserves your advantage.",
      },
    ],
  },
  {
    total: 18,
    cases: [
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "17+ is already competitive—don't risk a bust. Never double hard 18.",
        feedback:
          "Hard 17+ is a strong total that beats most dealer outcomes. Hitting would risk busting a winning hand with little chance of improvement. Doubling hard 18 is negative expected value because you're already ahead. Standing preserves your advantage.",
      },
    ],
  },
  {
    total: 17,
    cases: [
      {
        dealers: "any",
        action: "stand",
        fallback: null,
        tip: "17+ is already competitive—don't risk a bust. Never double hard 18.",
        feedback:
          "Hard 17+ is a strong total that beats most dealer outcomes. Hitting would risk busting a winning hand with little chance of improvement. Doubling hard 18 is negative expected value because you're already ahead. Standing preserves your advantage.",
      },
    ],
  },
  {
    total: 16,
    cases: [
      {
        dealers: weakUpcards,
        action: "stand",
        fallback: null,
        tip: "13–16 vs 2–6: stand and let the dealer's weak upcards produce busts.",
        feedback:
          "Against weak dealer upcards (2–6), hard 13–16 should stand. The dealer is likely to bust, so hitting would risk turning dealer busts into your own busts. Standing maximizes expected value by letting the dealer bust.",
      },
      {
        dealers: strongUpcards,
        action: "hit",
        fallback: null,
        tip: "13–16 vs 7–A: you're likely behind—draw to improve.",
        feedback:
          "Against strong dealer upcards (7–A), hard 13–16 is too weak to stand. The dealer is likely to make 17–21, so standing loses too often. Hitting gives you a chance to improve to 17–21 and compete, even though you risk busting.",
      },
    ],
  },
  {
    total: 15,
    cases: [
      {
        dealers: [5],
        action: "stand",
        fallback: null,
        tip: "Hard 15 vs 5: stand—dealer 5 is a bust card; doubling worsens EV.",
        feedback:
          "Hard 15 vs dealer 5 should stand. Dealer 5 busts frequently, so standing lets the dealer bust while avoiding your own bust. Doubling would overcommit and reduce expected value.",
      },
      {
        dealers: [2, 3, 4, 6],
        action: "stand",
        fallback: null,
        tip: "13–16 vs 2–6: stand and let the dealer's weak upcards produce busts.",
        feedback:
          "Against weak dealer upcards (2–6), hard 13–16 should stand. The dealer is likely to bust, so hitting would risk turning dealer busts into your own busts. Standing maximizes expected value by letting the dealer bust.",
      },
      {
        dealers: strongUpcards,
        action: "hit",
        fallback: null,
        tip: "13–16 vs 7–A: you're likely behind—draw to improve.",
        feedback:
          "Against strong dealer upcards (7–A), hard 13–16 is too weak to stand. The dealer is likely to make 17–21, so standing loses too often. Hitting gives you a chance to improve to 17–21 and compete, even though you risk busting.",
      },
    ],
  },
  {
    total: 14,
    cases: [
      {
        dealers: weakUpcards,
        action: "stand",
        fallback: null,
        tip: "13–16 vs 2–6: stand and let the dealer's weak upcards produce busts.",
        feedback:
          "Against weak dealer upcards (2–6), hard 13–16 should stand. The dealer is likely to bust, so hitting would risk turning dealer busts into your own busts. Standing maximizes expected value by letting the dealer bust.",
      },
      {
        dealers: strongUpcards,
        action: "hit",
        fallback: null,
        tip: "13–16 vs 7–A: you're likely behind—draw to improve.",
        feedback:
          "Against strong dealer upcards (7–A), hard 13–16 is too weak to stand. The dealer is likely to make 17–21, so standing loses too often. Hitting gives you a chance to improve to 17–21 and compete, even though you risk busting.",
      },
    ],
  },
  {
    total: 13,
    cases: [
      {
        dealers: weakUpcards,
        action: "stand",
        fallback: null,
        tip: "13–16 vs 2–6: stand and let the dealer's weak upcards produce busts.",
        feedback:
          "Against weak dealer upcards (2–6), hard 13–16 should stand. The dealer is likely to bust, so hitting would risk turning dealer busts into your own busts. Standing maximizes expected value by letting the dealer bust.",
      },
      {
        dealers: strongUpcards,
        action: "hit",
        fallback: null,
        tip: "13–16 vs 7–A: you're likely behind—draw to improve.",
        feedback:
          "Against strong dealer upcards (7–A), hard 13–16 is too weak to stand. The dealer is likely to make 17–21, so standing loses too often. Hitting gives you a chance to improve to 17–21 and compete, even though you risk busting.",
      },
    ],
  },
  {
    total: 12,
    cases: [
      {
        dealers: [4, 5, 6],
        action: "stand",
        fallback: null,
        tip: "12 vs 4–6: stand and let the dealer's weak upcard produce busts.",
        feedback:
          "Against weak dealer upcards (4–6), hard 12 should stand. The dealer is likely to bust, so hitting would risk turning dealer busts into your own bust. Standing maximizes expected value by letting the dealer bust.",
      },
      {
        dealers: [2, 3, 7, 8, 9, 10, "A"],
        action: "hit",
        fallback: null,
        tip: "12 vs 2–3 or 7–A: you're behind—take a card to improve.",
        feedback:
          "Against dealer 2–3 or strong upcards (7–A), hard 12 is too weak to stand. Standing leaves you with too many losing outcomes since the dealer is likely to make 17–21. Hitting gives you a chance to improve to 17–21, even though you risk busting.",
      },
    ],
  },
  {
    total: 11,
    cases: [
      {
        dealers: "any",
        action: "double",
        fallback: "hit",
        tip: "Hard 11 doubles vs every upcard including Ace—any ten gives you 21.",
        feedback:
          "Hard 11 is one of the strongest doubling opportunities. Any ten-value card (10, J, Q, K) gives you 21, and you have a high chance of improving to 18–21. Even against dealer Ace, doubling hard 11 has positive expected value and earns more than a simple hit over the long run.",
      },
    ],
  },
  {
    total: 10,
    cases: [
      {
        dealers: [2, 3, 4, 5, 6, 7, 8, 9],
        action: "double",
        fallback: "hit",
        tip: "10 vs 2–9: one card often makes 18–20—double to maximize value.",
        feedback:
          "Hard 10 has excellent potential to improve to 18–20 on one card. Against dealer 2–9, doubling maximizes your expected value by capturing this advantage. A single draw from 10 is favored against these upcards, and doubling captures that edge better than a simple hit.",
      },
      {
        dealers: [10, "A"],
        action: "hit",
        fallback: null,
        tip: "10 vs 10/A: the dealer is too strong—don't overbet; hit.",
        feedback:
          "Against strong dealer upcards (10, Ace), doubling hard 10 is negative expected value. The dealer is likely to make 17–21, so doubling overcommits. Hitting preserves equity and gives you flexibility to improve without risking too much.",
      },
    ],
  },
  {
    total: 9,
    cases: [
      {
        dealers: [3, 4, 5, 6],
        action: "double",
        fallback: "hit",
        tip: "9 vs 3–6: the dealer is weak—press your edge by doubling.",
        feedback:
          "Against weak dealer upcards (3–6), hard 9 has good potential to improve to 19–20 on one card. Doubling maximizes your expected value since the dealer is likely to bust or make a weak hand. Hitting would leave money on the table.",
      },
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "9 vs strong or neutral upcards: improve first, then compete.",
        feedback:
          "Against dealer upcards other than 3–6, doubling hard 9 overcommits against a stronger dealer. The dealer is likely to make a competitive hand, so doubling is negative expected value. Hitting gives you flexibility to improve without risking too much.",
      },
    ],
  },
  {
    total: 8,
    cases: [
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "Totals 8 or less can't bust—keep drawing to build a hand.",
        feedback:
          "Hard totals 8 or less are too weak to stand. Standing would give the dealer too many free wins since you can't beat most dealer outcomes. Hitting can't bust and gives you a chance to improve to 17–21, which are competitive totals.",
      },
    ],
  },
  {
    total: 7,
    cases: [
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "Totals 8 or less can't bust—keep drawing to build a hand.",
        feedback:
          "Hard totals 8 or less are too weak to stand. Standing would give the dealer too many free wins since you can't beat most dealer outcomes. Hitting can't bust and gives you a chance to improve to 17–21, which are competitive totals.",
      },
    ],
  },
  {
    total: 6,
    cases: [
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "Totals 8 or less can't bust—keep drawing to build a hand.",
        feedback:
          "Hard totals 8 or less are too weak to stand. Standing would give the dealer too many free wins since you can't beat most dealer outcomes. Hitting can't bust and gives you a chance to improve to 17–21, which are competitive totals.",
      },
    ],
  },
  {
    total: 5,
    cases: [
      {
        dealers: "any",
        action: "hit",
        fallback: null,
        tip: "Totals 8 or less can't bust—keep drawing to build a hand.",
        feedback:
          "Hard totals 8 or less are too weak to stand. Standing would give the dealer too many free wins since you can't beat most dealer outcomes. Hitting can't bust and gives you a chance to improve to 17–21, which are competitive totals.",
      },
    ],
  },
]
