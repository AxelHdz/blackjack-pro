import { formatChallengeResponse, type ChallengeRecord } from "@/lib/challenge-helpers"
import { getCashBonusWithCap, getXPNeeded, LEVELING_CONFIG } from "@/lib/leveling-config"

type XpRewardResult = {
  xpApplied: number
  levelsGained: number
  cashBonus: number
  newLevel: number
}

type ChallengeOutcome = "win" | "loss" | "tie"

// Supabase server client shape (typed loosely to avoid circular imports in helpers)
type SupabaseClient = any

const buildChallengeOutcomeUpdates = (
  stats:
    | {
        completed_challenges?: number | null
        won_challenges?: number | null
        lost_challenges?: number | null
        tied_challenges?: number | null
      }
    | null,
  outcome: ChallengeOutcome,
) => {
  const completed = stats?.completed_challenges ?? 0
  const won = stats?.won_challenges ?? 0
  const lost = stats?.lost_challenges ?? 0
  const tied = stats?.tied_challenges ?? 0

  return {
    completed_challenges: completed + 1,
    won_challenges: won + (outcome === "win" ? 1 : 0),
    lost_challenges: lost + (outcome === "loss" ? 1 : 0),
    tied_challenges: tied + (outcome === "tie" ? 1 : 0),
    updated_at: new Date().toISOString(),
  }
}

const applyChallengeXpReward = async (
  supabase: SupabaseClient,
  userId: string,
  xpGain: number,
): Promise<XpRewardResult> => {
  if (!xpGain || xpGain <= 0) {
    return { xpApplied: 0, levelsGained: 0, cashBonus: 0, newLevel: 0 }
  }

  const { data: stats, error } = await supabase
    .from("game_stats")
    .select("experience, level, total_money, level_winnings")
    .eq("user_id", userId)
    .single()

  if (error || !stats) {
    console.error("Failed to load stats for XP reward:", error)
    return { xpApplied: 0, levelsGained: 0, cashBonus: 0, newLevel: 0 }
  }

  let experience = stats.experience ?? 0
  let level = stats.level ?? 1
  let totalMoney = stats.total_money ?? 0
  let levelWinnings = stats.level_winnings ?? 0
  let xpPool = Math.round(xpGain)
  let levelsGained = 0
  let cashBonus = 0

  while (xpPool > 0) {
    const xpNeeded = getXPNeeded(level)
    if (xpPool < xpNeeded) {
      experience += xpPool
      xpPool = 0
      break
    }

    xpPool -= xpNeeded
    const completedLevel = level
    level += 1
    levelsGained += 1
    const bonus = getCashBonusWithCap(completedLevel, LEVELING_CONFIG.cash_cap)
    cashBonus += bonus
    totalMoney += bonus
    experience = 0
    levelWinnings = 0
  }

  const updates = {
    experience,
    level,
    total_money: totalMoney,
    level_winnings: levelWinnings,
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase.from("game_stats").update(updates).eq("user_id", userId)

  if (updateError) {
    console.error("Failed to apply XP reward:", updateError)
    return { xpApplied: 0, levelsGained: 0, cashBonus: 0, newLevel: level }
  }

  return {
    xpApplied: Math.round(xpGain),
    levelsGained,
    cashBonus,
    newLevel: level,
  }
}

type FinalizeChallengeOptions = {
  supabase: SupabaseClient
  challenge: ChallengeRecord
  winnerId: string | null
  challengerCredits?: number
  challengedCredits?: number
  allowTie?: boolean
}

export const finalizeChallenge = async ({
  supabase,
  challenge,
  winnerId,
  challengerCredits,
  challengedCredits,
  allowTie = false,
}: FinalizeChallengeOptions) => {
  const challengerXpGain = challenge.challenger_credit_experience || 0
  const challengedXpGain = challenge.challenged_credit_experience || 0

  const { data: challengerStats, error: challengerStatsError } = await supabase
    .from("game_stats")
    .select(
      "total_money, experience, level, level_winnings, completed_challenges, won_challenges, lost_challenges, tied_challenges",
    )
    .eq("user_id", challenge.challenger_id)
    .single()

  const { data: challengedStats, error: challengedStatsError } = await supabase
    .from("game_stats")
    .select(
      "total_money, experience, level, level_winnings, completed_challenges, won_challenges, lost_challenges, tied_challenges",
    )
    .eq("user_id", challenge.challenged_id)
    .single()

  if (challengerStatsError || !challengerStats || challengedStatsError || !challengedStats) {
    console.error("Failed to fetch stats:", challengerStatsError || challengedStatsError)
    return { error: "Failed to fetch balances" as const }
  }

  const wagerAmount = challenge.wager_amount
  let challengerFinalBalance = challengerStats.total_money
  let challengedFinalBalance = challengedStats.total_money

  const isTie = allowTie && !winnerId

  if (isTie) {
    const { error: challengerRefundError } = await supabase
      .from("game_stats")
      .update({ total_money: challengerFinalBalance + wagerAmount })
      .eq("user_id", challenge.challenger_id)

    const { error: challengedRefundError } = await supabase
      .from("game_stats")
      .update({ total_money: challengedFinalBalance + wagerAmount })
      .eq("user_id", challenge.challenged_id)

    if (challengerRefundError || challengedRefundError) {
      console.error("Failed to refund wager:", challengerRefundError || challengedRefundError)
      return { error: "Failed to refund wager" as const }
    }

    challengerFinalBalance += wagerAmount
    challengedFinalBalance += wagerAmount
  } else if (winnerId === challenge.challenger_id) {
    const { error: transferError } = await supabase
      .from("game_stats")
      .update({ total_money: challengerFinalBalance + wagerAmount * 2 })
      .eq("user_id", challenge.challenger_id)

    if (transferError) {
      console.error("Failed to pay challenger winnings:", transferError)
      return { error: "Failed to pay winnings" as const }
    }

    challengerFinalBalance += wagerAmount * 2
  } else if (winnerId === challenge.challenged_id) {
    const { error: transferError } = await supabase
      .from("game_stats")
      .update({ total_money: challengedFinalBalance + wagerAmount * 2 })
      .eq("user_id", challenge.challenged_id)

    if (transferError) {
      console.error("Failed to pay challenged winnings:", transferError)
      return { error: "Failed to pay winnings" as const }
    }

    challengedFinalBalance += wagerAmount * 2
  } else {
    return { error: "Winner required" as const }
  }

  const [challengerXpResult, challengedXpResult] = await Promise.all([
    applyChallengeXpReward(supabase, challenge.challenger_id, challengerXpGain),
    applyChallengeXpReward(supabase, challenge.challenged_id, challengedXpGain),
  ])

  const challengerOutcomeUpdates = buildChallengeOutcomeUpdates(
    challengerStats,
    isTie ? "tie" : winnerId === challenge.challenger_id ? "win" : "loss",
  )
  const challengedOutcomeUpdates = buildChallengeOutcomeUpdates(
    challengedStats,
    isTie ? "tie" : winnerId === challenge.challenged_id ? "win" : "loss",
  )

  const [{ error: challengerOutcomeError }, { error: challengedOutcomeError }] = await Promise.all([
    supabase.from("game_stats").update(challengerOutcomeUpdates).eq("user_id", challenge.challenger_id),
    supabase.from("game_stats").update(challengedOutcomeUpdates).eq("user_id", challenge.challenged_id),
  ])

  if (challengerOutcomeError || challengedOutcomeError) {
    console.error("Failed to record challenge outcomes:", challengerOutcomeError || challengedOutcomeError)
  }

  const { data: updatedChallenge, error: updateError } = await supabase
    .from("challenges")
    .update({
      status: "completed",
      challenger_balance_end: challengerFinalBalance,
      challenged_balance_end: challengedFinalBalance,
      winner_id: isTie ? null : winnerId,
      challenger_credit_experience: 0,
      challenged_credit_experience: 0,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      challenger_credit_balance: challengerCredits ?? challenge.challenger_credit_balance,
      challenged_credit_balance: challengedCredits ?? challenge.challenged_credit_balance,
    })
    .eq("id", challenge.id)
    .select()
    .single()

  if (updateError || !updatedChallenge) {
    console.error("Failed to complete challenge:", updateError)
    return { error: "Failed to complete challenge" as const }
  }

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .in("id", [challenge.challenger_id, challenge.challenged_id])

  const profilesMap = new Map<string, { display_name?: string | null }>(
    (profiles ?? []).map((profile: { id: string; display_name?: string | null }) => [profile.id, profile]),
  )
  const formattedChallenge = formatChallengeResponse(updatedChallenge as ChallengeRecord, profilesMap)
  const winnerProfile = formattedChallenge.winnerId ? profilesMap.get(formattedChallenge.winnerId) : null

  return {
    formattedChallenge,
    updatedChallenge: updatedChallenge as ChallengeRecord,
    winnerId: formattedChallenge.winnerId,
    winnerName: winnerProfile?.display_name || null,
    xpResults: {
      challenger: challengerXpResult,
      challenged: challengedXpResult,
    },
    isTie,
    challengerCredits: challengerCredits ?? challenge.challenger_credit_balance ?? 0,
    challengedCredits: challengedCredits ?? challenge.challenged_credit_balance ?? 0,
  }
}
