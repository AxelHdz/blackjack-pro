import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET: Get challenge details by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: challenge, error } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", params.id)
      .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
      .single()

    if (error || !challenge) {
      console.error("[v0] Challenge fetch error:", error)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    // Fetch user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", [challenge.challenger_id, challenge.challenged_id])

    if (profilesError) {
      console.error("[v0] User profiles fetch error:", profilesError)
    }

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])

    const challengerProfile = profilesMap.get(challenge.challenger_id)
    const challengedProfile = profilesMap.get(challenge.challenged_id)

    return NextResponse.json({
      id: challenge.id,
      challengerId: challenge.challenger_id,
      challengerName: challengerProfile?.display_name || `User ${challenge.challenger_id.slice(0, 8)}`,
      challengedId: challenge.challenged_id,
      challengedName: challengedProfile?.display_name || `User ${challenge.challenged_id.slice(0, 8)}`,
      wagerAmount: challenge.wager_amount,
      durationMinutes: challenge.duration_minutes,
      status: challenge.status,
      challengerBalanceStart: challenge.challenger_balance_start,
      challengedBalanceStart: challenge.challenged_balance_start,
      challengerBalanceEnd: challenge.challenger_balance_end,
      challengedBalanceEnd: challenge.challenged_balance_end,
      winnerId: challenge.winner_id,
      startedAt: challenge.started_at,
      expiresAt: challenge.expires_at,
      completedAt: challenge.completed_at,
      createdAt: challenge.created_at,
      updatedAt: challenge.updated_at,
    })
  } catch (err) {
    console.error("[v0] Challenge fetch error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT: Update challenge (accept or counter-offer)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, wagerAmount, durationMinutes } = body // action: 'accept' | 'counter-offer'

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

    // Verify user is authorized to update this challenge
    const isChallenger = challenge.challenger_id === user.id
    const isChallenged = challenge.challenged_id === user.id

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (action === "accept") {
      // Only challenged user can accept
      if (!isChallenged) {
        return NextResponse.json({ error: "Only the challenged user can accept" }, { status: 403 })
      }

      if (challenge.status !== "pending") {
        return NextResponse.json({ error: "Challenge is not pending" }, { status: 400 })
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

      // Calculate expiration time
      const startedAt = new Date()
      const expiresAt = new Date(startedAt.getTime() + challenge.duration_minutes * 60 * 1000)

      // Update challenge to active
      const { data: updatedChallenge, error: updateError } = await supabase
        .from("challenges")
        .update({
          status: "active",
          challenger_balance_start: challengerStats.total_money,
          challenged_balance_start: challengedStats.total_money,
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .select()
        .single()

      if (updateError) {
        console.error("[v0] Failed to accept challenge:", updateError)
        return NextResponse.json({ error: "Failed to accept challenge" }, { status: 500 })
      }

      return NextResponse.json({ challenge: updatedChallenge })
    } else if (action === "counter-offer") {
      // Only challenged user can counter-offer
      if (!isChallenged) {
        return NextResponse.json({ error: "Only the challenged user can counter-offer" }, { status: 403 })
      }

      if (challenge.status !== "pending") {
        return NextResponse.json({ error: "Challenge is not pending" }, { status: 400 })
      }

      if (!wagerAmount || !durationMinutes) {
        return NextResponse.json({ error: "Missing wager amount or duration" }, { status: 400 })
      }

      if (![15, 30].includes(durationMinutes)) {
        return NextResponse.json({ error: "Duration must be 15 or 30 minutes" }, { status: 400 })
      }

      if (wagerAmount <= 0) {
        return NextResponse.json({ error: "Wager amount must be positive" }, { status: 400 })
      }

      // Check if challenger has sufficient balance for new wager
      const { data: challengerStats, error: challengerStatsError } = await supabase
        .from("game_stats")
        .select("total_money")
        .eq("user_id", challenge.challenger_id)
        .single()

      if (challengerStatsError || !challengerStats) {
        console.error("[v0] Failed to fetch challenger stats:", challengerStatsError)
        return NextResponse.json({ error: "Failed to fetch challenger balance" }, { status: 500 })
      }

      // Calculate new wager difference
      const wagerDifference = wagerAmount - challenge.wager_amount

      if (challengerStats.total_money < wagerDifference) {
        return NextResponse.json({ error: "Challenger has insufficient balance for the new wager" }, { status: 400 })
      }

      // If new wager is higher, deduct difference from challenger
      // If new wager is lower, refund difference to challenger
      if (wagerDifference !== 0) {
        const { error: balanceUpdateError } = await supabase
          .from("game_stats")
          .update({ total_money: challengerStats.total_money - wagerDifference })
          .eq("user_id", challenge.challenger_id)

        if (balanceUpdateError) {
          console.error("[v0] Failed to update challenger balance:", balanceUpdateError)
          return NextResponse.json({ error: "Failed to update wager" }, { status: 500 })
        }
      }

      // Update challenge with counter-offer
      const { data: updatedChallenge, error: updateError } = await supabase
        .from("challenges")
        .update({
          wager_amount: wagerAmount,
          duration_minutes: durationMinutes,
          status: "pending", // Reset to pending for challenger to accept
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .select()
        .single()

      if (updateError) {
        console.error("[v0] Failed to counter-offer:", updateError)
        // Rollback balance change
        if (wagerDifference !== 0) {
          await supabase
            .from("game_stats")
            .update({ total_money: challengerStats.total_money })
            .eq("user_id", challenge.challenger_id)
        }
        return NextResponse.json({ error: "Failed to counter-offer" }, { status: 500 })
      }

      return NextResponse.json({ challenge: updatedChallenge })
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (err) {
    console.error("[v0] Challenge update error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Cancel challenge (only if pending)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Only challenger can cancel, and only if pending
    if (challenge.challenger_id !== user.id) {
      return NextResponse.json({ error: "Only the challenger can cancel" }, { status: 403 })
    }

    if (challenge.status !== "pending") {
      return NextResponse.json({ error: "Only pending challenges can be cancelled" }, { status: 400 })
    }

    // Refund wager to challenger
    const { data: challengerStats, error: statsError } = await supabase
      .from("game_stats")
      .select("total_money")
      .eq("user_id", user.id)
      .single()

    if (statsError || !challengerStats) {
      console.error("[v0] Failed to fetch challenger stats:", statsError)
      return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 })
    }

    const { error: refundError } = await supabase
      .from("game_stats")
      .update({ total_money: challengerStats.total_money + challenge.wager_amount })
      .eq("user_id", user.id)

    if (refundError) {
      console.error("[v0] Failed to refund wager:", refundError)
      return NextResponse.json({ error: "Failed to refund wager" }, { status: 500 })
    }

    // Delete challenge
    const { error: deleteError } = await supabase.from("challenges").delete().eq("id", params.id)

    if (deleteError) {
      console.error("[v0] Failed to delete challenge:", deleteError)
      // Rollback refund
      await supabase
        .from("game_stats")
        .update({ total_money: challengerStats.total_money })
        .eq("user_id", user.id)
      return NextResponse.json({ error: "Failed to cancel challenge" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Challenge cancellation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

