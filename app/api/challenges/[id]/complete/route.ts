import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

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
    // Get current challenge
    const { data: challenge, error: fetchError } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", params.id)
      .single()

    if (fetchError || !challenge) {
      console.error("[v0] Challenge fetch error:", fetchError)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    // Verify user is part of this challenge
    const isChallenger = challenge.challenger_id === user.id
    const isChallenged = challenge.challenged_id === user.id

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (challenge.status !== "active") {
      return NextResponse.json({ error: "Challenge is not active" }, { status: 400 })
    }

    // Check if challenge has expired
    if (challenge.expires_at) {
      const expiresAt = new Date(challenge.expires_at)
      const now = new Date()
      if (now < expiresAt) {
        return NextResponse.json({ error: "Challenge has not expired yet" }, { status: 400 })
      }
    }

    // Get current balances
    const { data: challengerStats, error: challengerStatsError } = await supabase
      .from("game_stats")
      .select("total_money")
      .eq("user_id", challenge.challenger_id)
      .single()

    const { data: challengedStats, error: challengedStatsError } = await supabase
      .from("game_stats")
      .select("total_money")
      .eq("user_id", challenge.challenged_id)
      .single()

    if (challengerStatsError || !challengerStats || challengedStatsError || !challengedStats) {
      console.error("[v0] Failed to fetch stats:", challengerStatsError || challengedStatsError)
      return NextResponse.json({ error: "Failed to fetch balances" }, { status: 500 })
    }

    // Calculate balance changes
    const challengerBalanceChange = challengerStats.total_money - (challenge.challenger_balance_start || 0)
    const challengedBalanceChange = challengedStats.total_money - (challenge.challenged_balance_start || 0)

    // Determine winner (player with higher balance change)
    let winnerId: string | null = null
    if (challengerBalanceChange > challengedBalanceChange) {
      winnerId = challenge.challenger_id
    } else if (challengedBalanceChange > challengerBalanceChange) {
      winnerId = challenge.challenged_id
    }
    // If tie (equal balance changes), winnerId remains null

    // Transfer wager to winner (or refund both if tie)
    if (winnerId) {
      const { data: winnerStats, error: winnerStatsError } = await supabase
        .from("game_stats")
        .select("total_money")
        .eq("user_id", winnerId)
        .single()

      if (winnerStatsError || !winnerStats) {
        console.error("[v0] Failed to fetch winner stats:", winnerStatsError)
        return NextResponse.json({ error: "Failed to fetch winner balance" }, { status: 500 })
      }

      const { error: transferError } = await supabase
        .from("game_stats")
        .update({ total_money: winnerStats.total_money + challenge.wager_amount })
        .eq("user_id", winnerId)

      if (transferError) {
        console.error("[v0] Failed to transfer wager:", transferError)
        return NextResponse.json({ error: "Failed to transfer wager" }, { status: 500 })
      }
    } else {
      // Tie - refund wager to challenger
      const { data: challengerCurrentStats, error: challengerCurrentStatsError } = await supabase
        .from("game_stats")
        .select("total_money")
        .eq("user_id", challenge.challenger_id)
        .single()

      if (challengerCurrentStatsError || !challengerCurrentStats) {
        console.error("[v0] Failed to fetch challenger stats for refund:", challengerCurrentStatsError)
        return NextResponse.json({ error: "Failed to fetch challenger balance" }, { status: 500 })
      }

      const { error: refundError } = await supabase
        .from("game_stats")
        .update({ total_money: challengerCurrentStats.total_money + challenge.wager_amount })
        .eq("user_id", challenge.challenger_id)

      if (refundError) {
        console.error("[v0] Failed to refund wager:", refundError)
        return NextResponse.json({ error: "Failed to refund wager" }, { status: 500 })
      }
    }

    // Update challenge to completed
    const { data: updatedChallenge, error: updateError } = await supabase
      .from("challenges")
      .update({
        status: "completed",
        challenger_balance_end: challengerStats.total_money,
        challenged_balance_end: challengedStats.total_money,
        winner_id: winnerId,
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

    // Fetch user profiles for response
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
      challengerBalanceChange,
      challengedBalanceChange,
      isTie: winnerId === null,
    })
  } catch (err) {
    console.error("[v0] Challenge completion error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

