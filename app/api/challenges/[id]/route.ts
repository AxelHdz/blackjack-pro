import { createClient } from "@/lib/supabase/server"
import { formatChallengeResponse, deriveAwaitingUserId, type ChallengeRecord } from "@/lib/challenge-helpers"
import { type NextRequest, NextResponse } from "next/server"

const fetchChallengeById = (supabase: any, id: string) => {
  const query = supabase.from("challenges").select("*").eq("id", id)
  return query.maybeSingle()
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const challengeId = (await params).id

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: challenge, error } = await fetchChallengeById(supabase, challengeId)

    if (error || !challenge) {
      console.error("Challenge fetch error:", error)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    // Fetch user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", [challenge.challenger_id, challenge.challenged_id])

    if (profilesError) {
      console.error("User profiles fetch error:", profilesError)
    }

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])

    return NextResponse.json(formatChallengeResponse(challenge as ChallengeRecord, profilesMap))
  } catch (err) {
    console.error("Challenge fetch error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const challengeId = (await params).id

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, wagerAmount, durationMinutes } = body

    const { data: challenge, error: fetchError } = await fetchChallengeById(supabase, challengeId)

    if (fetchError || !challenge) {
      console.error("Challenge fetch error:", fetchError)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const isChallenger = challenge.challenger_id === user.id
    const isChallenged = challenge.challenged_id === user.id
    const awaitingUserId = deriveAwaitingUserId(challenge as ChallengeRecord)

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (action === "accept") {
      if (challenge.status !== "pending") {
        return NextResponse.json({ error: "Challenge is not pending" }, { status: 400 })
      }

      if (!awaitingUserId || awaitingUserId !== user.id) {
        return NextResponse.json({ error: "Awaiting opponent's response" }, { status: 403 })
      }

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
        console.error("Failed to fetch stats:", challengerStatsError || challengedStatsError)
        return NextResponse.json({ error: "Failed to fetch balances" }, { status: 500 })
      }

      if (challengedStats.total_money < challenge.wager_amount) {
        return NextResponse.json({ error: "Opponent does not have enough balance to accept" }, { status: 400 })
      }

      const challengedBalanceStart = challengedStats.total_money
      const { error: challengedDebitError } = await supabase
        .from("game_stats")
        .update({ total_money: challengedBalanceStart - challenge.wager_amount })
        .eq("user_id", challenge.challenged_id)

      if (challengedDebitError) {
        console.error("Failed to reserve challenged wager:", challengedDebitError)
        return NextResponse.json({ error: "Failed to reserve opponent wager" }, { status: 500 })
      }

      const startedAt = new Date()
      const expiresAt = new Date(startedAt.getTime() + challenge.duration_minutes * 60 * 1000)

      const challengeCredits = 500

      const { data: updatedChallenge, error: updateError } = await supabase
        .from("challenges")
        .update({
          status: "active",
          challenger_balance_start: challengerStats.total_money,
          challenged_balance_start: challengedBalanceStart,
          challenger_balance_paused: challengerStats.total_money,
          challenged_balance_paused: challengedBalanceStart - challenge.wager_amount,
          challenger_credit_balance: challengeCredits,
          challenged_credit_balance: challengeCredits,
          challenger_credit_experience: 0,
          challenged_credit_experience: 0,
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", challengeId)
        .select()
        .single()

      if (updateError) {
        console.error("Failed to accept challenge:", updateError)
        await supabase
          .from("game_stats")
          .update({ total_money: challengedBalanceStart })
          .eq("user_id", challenge.challenged_id)
        return NextResponse.json({ error: "Failed to accept challenge" }, { status: 500 })
      }

      return NextResponse.json({ challenge: updatedChallenge })
    } else if (action === "counter-offer") {
      if (!isChallenged) {
        return NextResponse.json({ error: "Only the challenged user can counter-offer" }, { status: 403 })
      }

      if (challenge.status !== "pending") {
        return NextResponse.json({ error: "Challenge is not pending" }, { status: 400 })
      }

      if (!wagerAmount || !durationMinutes) {
        return NextResponse.json({ error: "Missing wager amount or duration" }, { status: 400 })
      }

      if (![5, 10].includes(durationMinutes)) {
        return NextResponse.json({ error: "Duration must be 5 or 10 minutes" }, { status: 400 })
      }

      if (wagerAmount <= 0) {
        return NextResponse.json({ error: "Wager amount must be positive" }, { status: 400 })
      }

      const { data: challengerStats, error: challengerStatsError } = await supabase
        .from("game_stats")
        .select("total_money")
        .eq("user_id", challenge.challenger_id)
        .single()

      if (challengerStatsError || !challengerStats) {
        console.error("Failed to fetch challenger stats:", challengerStatsError)
        return NextResponse.json({ error: "Failed to fetch challenger balance" }, { status: 500 })
      }

      const { data: challengedStats, error: challengedStatsError } = await supabase
        .from("game_stats")
        .select("total_money")
        .eq("user_id", challenge.challenged_id)
        .single()

      if (challengedStatsError || !challengedStats) {
        console.error("Failed to fetch challenged stats:", challengedStatsError)
        return NextResponse.json({ error: "Failed to fetch challenged balance" }, { status: 500 })
      }

      if (challengedStats.total_money < wagerAmount) {
        return NextResponse.json({ error: "Wager cannot exceed your balance" }, { status: 400 })
      }

      const wagerDifference = wagerAmount - challenge.wager_amount

      if (wagerDifference > 0 && challengerStats.total_money < wagerDifference) {
        return NextResponse.json({ error: "Challenger has insufficient balance for the new wager" }, { status: 400 })
      }

      if (wagerDifference !== 0) {
        const { error: balanceUpdateError } = await supabase
          .from("game_stats")
          .update({ total_money: challengerStats.total_money - wagerDifference })
          .eq("user_id", challenge.challenger_id)

        if (balanceUpdateError) {
          console.error("Failed to update challenger balance:", balanceUpdateError)
          return NextResponse.json({ error: "Failed to update wager" }, { status: 500 })
        }
      }

      const { data: updatedChallenge, error: updateError } = await supabase
        .from("challenges")
        .update({
          wager_amount: wagerAmount,
          duration_minutes: durationMinutes,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", challengeId)
        .select()
        .single()

      if (updateError) {
        console.error("Failed to counter-offer:", updateError)
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
    console.error("Challenge update error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const challengeId = (await params).id

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await fetchChallengeById(supabase, challengeId)
    const { data: challenge, error: fetchError } = result

    if (fetchError) {
      console.error("Challenge fetch error:", fetchError)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found or access denied" }, { status: 404 })
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
      console.error("Failed to fetch challenger stats:", statsError)
      return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 })
    }

    const refundedBalance = challengerStats.total_money + challenge.wager_amount

    const { error: refundError } = await supabase
      .from("game_stats")
      .update({ total_money: refundedBalance })
      .eq("user_id", user.id)

    if (refundError) {
      console.error("Failed to refund wager:", refundError)
      return NextResponse.json({ error: "Failed to refund wager" }, { status: 500 })
    }

    const nowIso = new Date().toISOString()

    const { data: cancelledChallenge, error: cancelError } = await supabase
      .from("challenges")
      .update({
        status: "cancelled",
        challenger_balance_end: refundedBalance,
        updated_at: nowIso,
      })
      .eq("id", challengeId)
      .select("*")
      .single()

    if (cancelError || !cancelledChallenge) {
      console.error("Failed to cancel challenge:", cancelError)
      await supabase.from("game_stats").update({ total_money: challengerStats.total_money }).eq("user_id", user.id)
      return NextResponse.json({ error: "Failed to cancel challenge" }, { status: 500 })
    }

    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", [challenge.challenger_id, challenge.challenged_id])

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])

    return NextResponse.json({
      challenge: formatChallengeResponse(cancelledChallenge as ChallengeRecord, profilesMap),
    })
  } catch (err) {
    console.error("Challenge cancellation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
