import { createClient } from "@/lib/supabase/server"
import { getCashBonusWithCap, getXPNeeded, LEVELING_CONFIG } from "@/lib/leveling-config"
import { type NextRequest, NextResponse } from "next/server"

type XpRewardResult = {
  xpApplied: number
  levelsGained: number
  cashBonus: number
  newLevel: number
}

async function applyChallengeXpReward(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  xpGain: number,
): Promise<XpRewardResult> {
  if (!xpGain || xpGain <= 0) {
    return { xpApplied: 0, levelsGained: 0, cashBonus: 0, newLevel: 0 }
  }

  const { data: stats, error } = await supabase
    .from("game_stats")
    .select("experience, level, total_money, level_winnings")
    .eq("user_id", userId)
    .single()

  if (error || !stats) {
    console.error("[v0] Failed to load stats for XP reward:", error)
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
    console.error("[v0] Failed to apply XP reward:", updateError)
    return { xpApplied: 0, levelsGained: 0, cashBonus: 0, newLevel: level }
  }

  return {
    xpApplied: Math.round(xpGain),
    levelsGained,
    cashBonus,
    newLevel: level,
  }
}

// POST: Complete challenge (called when timer expires)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: challenge, error: fetchError } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", params.id)
      .single()

    if (fetchError || !challenge) {
      console.error("[v0] Challenge fetch error:", fetchError)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const isChallenger = challenge.challenger_id === user.id
    const isChallenged = challenge.challenged_id === user.id

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (challenge.status !== "active") {
      return NextResponse.json({ error: "Challenge is not active" }, { status: 400 })
    }

    if (challenge.expires_at) {
      const expiresAt = new Date(challenge.expires_at)
      if (new Date() < expiresAt) {
        return NextResponse.json({ error: "Challenge has not expired yet" }, { status: 400 })
      }
    }

    const challengerCredits = challenge.challenger_credit_balance ?? 0
    const challengedCredits = challenge.challenged_credit_balance ?? 0

    let winnerId: string | null = null
    if (challengerCredits > challengedCredits) {
      winnerId = challenge.challenger_id
    } else if (challengedCredits > challengerCredits) {
      winnerId = challenge.challenged_id
    }

    const { data: challengerStats, error: challengerStatsError } = await supabase
      .from("game_stats")
      .select("total_money, experience, level, level_winnings")
      .eq("user_id", challenge.challenger_id)
      .single()

    const { data: challengedStats, error: challengedStatsError } = await supabase
      .from("game_stats")
      .select("total_money, experience, level, level_winnings")
      .eq("user_id", challenge.challenged_id)
      .single()

    if (challengerStatsError || !challengerStats || challengedStatsError || !challengedStats) {
      console.error("[v0] Failed to fetch stats:", challengerStatsError || challengedStatsError)
      return NextResponse.json({ error: "Failed to fetch balances" }, { status: 500 })
    }

    const wagerAmount = challenge.wager_amount
    let challengerFinalBalance = challengerStats.total_money
    let challengedFinalBalance = challengedStats.total_money

    if (winnerId === challenge.challenger_id) {
      const { error: transferError } = await supabase
        .from("game_stats")
        .update({ total_money: challengerFinalBalance + wagerAmount * 2 })
        .eq("user_id", challenge.challenger_id)

      if (transferError) {
        console.error("[v0] Failed to pay challenger winnings:", transferError)
        return NextResponse.json({ error: "Failed to pay winnings" }, { status: 500 })
      }

      challengerFinalBalance += wagerAmount * 2
    } else if (winnerId === challenge.challenged_id) {
      const { error: transferError } = await supabase
        .from("game_stats")
        .update({ total_money: challengedFinalBalance + wagerAmount * 2 })
        .eq("user_id", challenge.challenged_id)

      if (transferError) {
        console.error("[v0] Failed to pay challenged winnings:", transferError)
        return NextResponse.json({ error: "Failed to pay winnings" }, { status: 500 })
      }

      challengedFinalBalance += wagerAmount * 2
    } else {
      const { error: challengerRefundError } = await supabase
        .from("game_stats")
        .update({ total_money: challengerFinalBalance + wagerAmount })
        .eq("user_id", challenge.challenger_id)

      if (challengerRefundError) {
        console.error("[v0] Failed to refund challenger:", challengerRefundError)
        return NextResponse.json({ error: "Failed to refund challenger" }, { status: 500 })
      }

      challengerFinalBalance += wagerAmount

      const { error: challengedRefundError } = await supabase
        .from("game_stats")
        .update({ total_money: challengedFinalBalance + wagerAmount })
        .eq("user_id", challenge.challenged_id)

      if (challengedRefundError) {
        console.error("[v0] Failed to refund challenged user:", challengedRefundError)
        return NextResponse.json({ error: "Failed to refund challenged user" }, { status: 500 })
      }

      challengedFinalBalance += wagerAmount
    }

    const challengerXpGain = challenge.challenger_credit_experience || 0
    const challengedXpGain = challenge.challenged_credit_experience || 0

    const [challengerXpResult, challengedXpResult] = await Promise.all([
      applyChallengeXpReward(supabase, challenge.challenger_id, challengerXpGain),
      applyChallengeXpReward(supabase, challenge.challenged_id, challengedXpGain),
    ])

    const { data: updatedChallenge, error: updateError } = await supabase
      .from("challenges")
      .update({
        status: "completed",
        challenger_balance_end: challengerFinalBalance,
        challenged_balance_end: challengedFinalBalance,
        winner_id: winnerId,
        challenger_credit_experience: 0,
        challenged_credit_experience: 0,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single()

    if (updateError) {
      console.error("[v0] Failed to complete challenge:", updateError)
      return NextResponse.json({ error: "Failed to complete challenge" }, { status: 500 })
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", [challenge.challenger_id, challenge.challenged_id])

    if (profilesError) {
      console.error("[v0] User profiles fetch error:", profilesError)
    }

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])
    const winnerProfile = winnerId ? profilesMap.get(winnerId) : null

    return NextResponse.json({
      challenge: updatedChallenge,
      winnerId,
      winnerName: winnerProfile?.display_name || null,
      challengerCredits,
      challengedCredits,
      xpResults: {
        challenger: challengerXpResult,
        challenged: challengedXpResult,
      },
      isTie: winnerId === null,
    })
  } catch (err) {
    console.error("[v0] Challenge completion error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
